import { db, functions } from "./firebase";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// 익명 로그인 제거: 서버는 empNo 기반으로 동작하고 uid는 선택적 메타데이터일 뿐이라,
// 매 호출마다 (익명인증 비활성 시) 실패하는 sign-in 왕복이 지연만 유발했음.

export async function drawCard({ empNo, name, forceGrade }) {
  const fn = httpsCallable(functions, "drawCard");
  const res = await fn({ empNo, name, forceGrade });
  return res.data;
}

export async function getStatus({ empNo, name }) {
  const fn = httpsCallable(functions, "getStatus");
  const res = await fn({ empNo, name });
  return res.data;
}

/** 최근 1~3등 당첨자 (확성기 티커용) */
export async function getRecentWinners(empNo) {
  const fn = httpsCallable(functions, "getRecentWinners");
  const res = await fn({ empNo: empNo || undefined });
  return res.data?.winners || [];
}

export async function getPublicResult() {
  const fn = httpsCallable(functions, "getPublicResult");
  const res = await fn({});
  return res.data || { rosterCount: 0, participantCount: 0, participationRate: 0, commonCount: 0, gradeTotals: {}, hall: [] };
}

/** 응원전: 응원 댓글 목록(좋아요순) + 내 좋아요 사용 현황 */
export async function getCheers(empNo) {
  const fn = httpsCallable(functions, "getCheers");
  const res = await fn({ empNo });
  return res.data || { cheers: [], likedIds: [], likesUsed: 0, likesMax: 3 };
}

/** 응원 댓글 등록 (팀/이름/한마디 직접 입력) */
export async function postCheer({ empNo, team, name, message }) {
  const fn = httpsCallable(functions, "postCheer");
  const res = await fn({ empNo, team, name, message });
  return res.data;
}

/** 응원 댓글 좋아요 */
export async function likeCheer({ empNo, cheerId }) {
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

/** 뽑기 기록 전체 초기화 (데모 계정 0000 전용) */
export async function resetAllDraws(empNo) {
  const fn = httpsCallable(functions, "resetAllDraws");
  const res = await fn({ empNo });
  return res.data;
}

// ── 관리자(admin) ──
export async function adminLoad(masterKey) {
  const fn = httpsCallable(functions, "adminLoad");
  const res = await fn({ masterKey });
  return res.data;
}
export async function adminUpdate(masterKey, section, data) {
  const fn = httpsCallable(functions, "adminUpdate");
  const res = await fn({ masterKey, section, data });
  return res.data;
}
export async function adminAction(masterKey, action, data) {
  const fn = httpsCallable(functions, "adminAction");
  const res = await fn({ masterKey, action, data });
  return res.data;
}
