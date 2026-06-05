import { auth, db, functions } from "./firebase";
import { signInAnonymously } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

/** 콜러블 호출 시 자동으로 익명 로그인 보장 (서버 호출 컨텍스트 확보용) */
async function ensureAuth() {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      // 익명 로그인 비활성화 등 — 치명적이지 않으면 무시하고 진행
      console.warn("anon sign-in failed", e);
    }
  }
}

export async function drawCard({ empNo, name, forceGrade }) {
  await ensureAuth();
  const fn = httpsCallable(functions, "drawCard");
  const res = await fn({ empNo, name, forceGrade });
  return res.data;
}

export async function getStatus({ empNo, name }) {
  await ensureAuth();
  const fn = httpsCallable(functions, "getStatus");
  const res = await fn({ empNo, name });
  return res.data;
}

/** 최근 1~3등 당첨자 (확성기 티커용) */
export async function getRecentWinners() {
  await ensureAuth();
  const fn = httpsCallable(functions, "getRecentWinners");
  const res = await fn({});
  return res.data?.winners || [];
}

/** 응원전: 응원 댓글 목록(좋아요순) + 내 좋아요 사용 현황 */
export async function getCheers(empNo) {
  const fn = httpsCallable(functions, "getCheers");
  const res = await fn({ empNo });
  return res.data || { cheers: [], likedIds: [], likesUsed: 0, likesMax: 3 };
}

/** 응원 댓글 등록 (팀/이름/한마디 직접 입력) */
export async function postCheer({ empNo, team, name, message }) {
  await ensureAuth();
  const fn = httpsCallable(functions, "postCheer");
  const res = await fn({ empNo, team, name, message });
  return res.data;
}

/** 응원 댓글 좋아요 */
export async function likeCheer({ empNo, cheerId }) {
  await ensureAuth();
  const fn = httpsCallable(functions, "likeCheer");
  const res = await fn({ empNo, cheerId });
  return res.data;
}

/** 등급 + 카드 도감 + 이벤트 설정(공개 읽기) 로드 */
export async function loadCatalog() {
  const [gradesSnap, cardsSnap, configSnap, teamsSnap] = await Promise.all([
    getDocs(collection(db, "grades")),
    getDocs(collection(db, "cards")),
    getDoc(doc(db, "config", "event")),
    getDocs(collection(db, "teams")),
  ]);
  const grades = gradesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.rank - b.rank);
  const cards = cardsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const config = configSnap.exists() ? configSnap.data() : {};
  const teams = teamsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return { grades, cards, config, teams };
}
