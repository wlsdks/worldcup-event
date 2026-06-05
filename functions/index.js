/**
 * 고놈 월드컵 카드뽑기 이벤트 — Cloud Functions
 *
 * 핵심 원칙: 확률 / 재고 / 하루1회 제한은 100% 서버에서 처리한다.
 * 클라이언트는 결과를 "받기만" 한다. (확률·재고 조작 불가)
 *
 * drawCard  : 뽑기 실행 (Firestore 트랜잭션으로 원자적 처리)
 * getStatus : 내 뽑기 현황 조회 (도감/오늘 뽑기 가능 여부)
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// 서울 리전 고정
setGlobalOptions({ region: "asia-northeast3", maxInstances: 10 });

/** KST(Asia/Seoul) 기준 오늘 날짜 'YYYY-MM-DD' */
function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // en-CA => YYYY-MM-DD
}

function cleanStr(v) {
  return (typeof v === "string" ? v : "").trim();
}

/** 이름 마스킹: '윤도현' → '윤○○', '홍길' → '홍○' */
function maskName(name) {
  const n = cleanStr(name);
  if (n.length <= 1) return n || "익명";
  return n[0] + "○".repeat(n.length - 1);
}

/**
 * 하루 할당제: '오늘까지 누적 할당량 − 누적 소진량 > 0' 이면 오늘 이 등급 당첨 가능.
 * 미사용분은 다음 날로 이월되며, 전체 합(=inventoryTotal)을 절대 넘지 않는다.
 */
function availableTodayCount(g, today) {
  if (g.unlimited === true) return Infinity;
  const dq = g.dailyQuota || {};
  let cumulative = 0;
  for (const d in dq) if (d <= today) cumulative += dq[d] || 0;
  const consumed = (g.inventoryTotal || 0) - (g.inventoryRemaining || 0);
  return Math.max(0, cumulative - consumed);
}
function gradeAvailableToday(g, today) {
  return g.unlimited === true || availableTodayCount(g, today) > 0;
}

/**
 * 참여자 명단(roster) 검증: 사번이 명단에 있고 이름이 일치해야 통과.
 * cfg.rosterRequired !== true 면 검사하지 않음.
 * snap = roster/{empNo} 문서 스냅샷 (트랜잭션 t.get 또는 db.get 결과).
 */
function assertRoster(cfg, empNo, name, snap) {
  if (!cfg || cfg.rosterRequired !== true) return;
  if (!snap || !snap.exists) {
    throw new HttpsError("permission-denied", "등록되지 않은 사번입니다. 관리자에게 문의해 주세요.");
  }
  const rosterName = cleanStr(snap.data().name);
  if (rosterName !== cleanStr(name)) {
    throw new HttpsError("permission-denied", "사번과 이름이 일치하지 않습니다.");
  }
}

/** 이벤트 설정을 읽고 현재 응모 가능 상태인지 판정 */
function evalEvent(cfg, today) {
  if (!cfg || cfg.active !== true) {
    return { ok: false, reason: "inactive" };
  }
  if (cfg.startDate && today < cfg.startDate) return { ok: false, reason: "not_started" };
  if (cfg.endDate && today > cfg.endDate) return { ok: false, reason: "ended" };
  return { ok: true };
}

// ───────────────────────────────────────── 뽑기 ─────────────────────────────────────────
export const drawCard = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  const name = cleanStr(request.data?.name);
  const uid = request.auth?.uid || null;

  if (!empNo || !name) {
    throw new HttpsError("invalid-argument", "사번과 이름을 입력해 주세요.");
  }
  if (empNo.length > 30 || name.length > 30) {
    throw new HttpsError("invalid-argument", "입력값이 너무 깁니다.");
  }

  const today = kstDate();

  const result = await db.runTransaction(async (t) => {
    // ── 1) 읽기 (모든 read는 write보다 먼저) ──
    const cfgSnap = await t.get(db.doc("config/event"));
    const cfg = cfgSnap.data();
    const ev = evalEvent(cfg, today);
    if (!ev.ok) throw new HttpsError("failed-precondition", `event_${ev.reason}`);

    // 참여자 명단 검증 (사번+이름)
    const rosterSnap = await t.get(db.doc(`roster/${empNo}`));
    assertRoster(cfg, empNo, name, rosterSnap);

    // 테스트 계정(사번 0000)은 운영설정과 무관하게 무한 뽑기 + 재고 무시
    const isTestAccount = empNo === "0000";
    const unlimitedDraws = cfg.unlimitedDraws === true || isTestAccount;

    // 무한모드(개발/테스트): 매번 새 기록 / 일반모드: 하루1회 잠금(사번__날짜)
    const drawRef = unlimitedDraws
      ? db.collection("draws").doc()
      : db.doc(`draws/${empNo}__${today}`);
    if (!unlimitedDraws) {
      const existing = await t.get(drawRef);
      if (existing.exists) {
        throw new HttpsError("already-exists", "오늘은 이미 뽑으셨어요. 내일 다시 도전해 주세요!");
      }
    }

    const gradesSnap = await t.get(db.collection("grades"));
    const grades = gradesSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
    if (grades.length === 0) throw new HttpsError("failed-precondition", "등급 설정이 없습니다.");

    // ── 2) 카드 풀 읽기 (모든 read는 write보다 먼저) ──
    const cardsAllSnap = await t.get(db.collection("cards").where("active", "==", true));
    const cardsByGrade = {};
    cardsAllSnap.docs.forEach((d) => {
      const c = { id: d.id, ...d.data() };
      (cardsByGrade[c.gradeId] = cardsByGrade[c.gradeId] || []).push(c);
    });

    // ── 3) 팩 추첨: cardsPerPack 장 (당첨 가중치 + 꽝 가중치, 재고 소진 반영) ──
    // 당첨 등급 weight 합 + missWeight(꽝) 중에서 추첨. 재고가 없으면 후보에서 빠진다.
    // 재고가 다 소진되면 당첨 후보가 없어 사실상 꽝만 나온다(=마감).
    const N = Math.max(1, Math.min(10, cfg.cardsPerPack || 1));
    const missWeight = Math.max(0, Number(cfg.missWeight) || 0);
    const localAvail = {};
    for (const g of grades) localAvail[g.id] = unlimitedDraws ? Infinity : availableTodayCount(g, today);

    // 테스트 계정(0000)만: 등급 강제 선택(데모 미리보기). 재고/확률 무시.
    const forceGradeId = isTestAccount ? cleanStr(request.data?.forceGrade) : "";
    const forcedGrade = forceGradeId
      ? grades.find((g) => g.id === forceGradeId && (cardsByGrade[g.id] || []).length > 0) || null
      : null;

    const picked = [];
    const consumed = {}; // 유한 등급의 팩 내 소비 수량
    for (let n = 0; n < N; n++) {
      let grade = null;
      if (forcedGrade) {
        grade = forcedGrade; // 강제 등급 (테스트)
      } else {
        const pool = grades.filter(
          (g) => (localAvail[g.id] || 0) > 0 && (cardsByGrade[g.id] || []).length > 0
        );
        const winW = pool.reduce((s, g) => s + (g.weight || 0), 0);
        const totalW = winW + missWeight;
        if (totalW <= 0) continue; // 후보도 꽝 가중치도 없음 → 빈손
        let r = Math.random() * totalW;
        for (const g of pool) { if (r < (g.weight || 0)) { grade = g; break; } r -= (g.weight || 0); }
        if (!grade) continue; // 꽝 (missWeight 구간에 당첨)
      }

      const pcards = cardsByGrade[grade.id];
      const card = pcards[Math.floor(Math.random() * pcards.length)];
      if (grade.unlimited !== true) {
        localAvail[grade.id] -= 1;
        consumed[grade.id] = (consumed[grade.id] || 0) + 1;
      }
      picked.push({
        gradeId: grade.id, gradeRank: grade.rank, gradeLabel: grade.label,
        gradeName: grade.name || "", gradeColor: grade.color || null,
        cardId: card.id, cardName: card.name || "", cardImage: card.image, cardDesc: card.desc || "",
      });
    }
    // picked 가 비어 있으면 = 꽝 (에러 아님). 도감/기록에는 카드가 안 들어간다.

    // 드라마용: 낮은 등급 → 높은 등급 순 (마지막에 최고 등급 공개)
    picked.sort((a, b) => b.gradeRank - a.gradeRank);
    const bestRank = picked.reduce((m, c) => Math.min(m, c.gradeRank), 99);

    // ── 4) 쓰기: 재고 차감 + 팩 기록 + 유저 갱신 ──
    // 무한모드에서는 재고를 차감하지 않음 (개발용 무한 뽑기)
    if (!unlimitedDraws) {
      const gradeById = Object.fromEntries(grades.map((g) => [g.id, g]));
      for (const gid in consumed) {
        t.update(gradeById[gid].ref, {
          inventoryRemaining: admin.firestore.FieldValue.increment(-consumed[gid]),
        });
      }
    }

    const isMiss = picked.length === 0;
    const now = admin.firestore.FieldValue.serverTimestamp();
    t.set(drawRef, { empNo, name, uid, drawDate: today, cards: picked, bestRank, miss: isMiss, createdAt: now });
    t.set(
      db.doc(`users/${empNo}`),
      {
        empNo, name, uid,
        lastDrawDate: today,
        drawCount: admin.firestore.FieldValue.increment(1),
        cardCount: admin.firestore.FieldValue.increment(picked.length),
        updatedAt: now,
      },
      { merge: true }
    );

    // 꽝이면 연출용 가짜 카드 1장을 돌려준다 (기록·도감에는 저장 안 됨)
    const revealCards = isMiss
      ? [{
          gradeId: null, gradeRank: 99, gradeLabel: "꽝", gradeName: "꽝",
          gradeColor: null, cardId: "miss", cardName: "꽝", cardImage: null, isMiss: true,
        }]
      : picked;
    return { cards: revealCards, bestRank, drawDate: today, miss: isMiss };
  });

  return result;
});

// ───────────────────────────────────────── 당첨 티커 ─────────────────────────────────────────
// 최근 1~3등 당첨자(이름 마스킹)를 반환. 상단 확성기 배너용.
export const getRecentWinners = onCall(async () => {
  const snap = await db.collection("draws").orderBy("createdAt", "desc").limit(60).get();
  const winners = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    for (const c of d.cards || []) {
      if ((c.gradeRank || 99) <= 3) {
        winners.push({
          name: maskName(d.name),
          gradeRank: c.gradeRank,
          gradeLabel: c.gradeLabel,
          gradeName: c.gradeName || "",
        });
      }
    }
    if (winners.length >= 15) break;
  }
  return { winners: winners.slice(0, 15) };
});

// ───────────────────────────────────────── 응원전 ─────────────────────────────────────────
// 응원 댓글(게시글) 단위. 좋아요 수 높은 순으로 랭킹. 사용자당 좋아요 최대 3회.
const LIKE_MAX = 3;

/** 응원 댓글 목록(좋아요순) + 내 좋아요 사용 현황 */
export const getCheers = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  const cheersSnap = await db.collection("cheers").get();
  const cheers = cheersSnap.docs.map((d) => {
    const c = d.data();
    return {
      id: d.id,
      team: c.team || "",
      name: c.name || "",
      message: c.message || "",
      likes: c.likes || 0,
      createdAt: c.createdAt?.toMillis ? c.createdAt.toMillis() : 0,
    };
  });
  // 좋아요 많은 순 → 동률이면 먼저 작성된 순
  cheers.sort((a, b) => (b.likes - a.likes) || (a.createdAt - b.createdAt));

  let likedIds = [];
  if (empNo) {
    const mine = await db.collection("cheerLikes").where("empNo", "==", empNo).get();
    likedIds = mine.docs.map((d) => d.data().cheerId);
  }
  return { cheers, likedIds, likesUsed: likedIds.length, likesMax: LIKE_MAX };
});

/** 응원 댓글 등록 (팀/이름/한마디 직접 입력) */
export const postCheer = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  const team = cleanStr(request.data?.team).slice(0, 30);
  const name = cleanStr(request.data?.name).slice(0, 20);
  const message = cleanStr(request.data?.message).slice(0, 100);
  if (!team) throw new HttpsError("invalid-argument", "응원할 팀을 입력해 주세요.");
  if (!name) throw new HttpsError("invalid-argument", "작성자 이름을 입력해 주세요.");
  if (!message) throw new HttpsError("invalid-argument", "응원 한마디를 입력해 주세요.");

  const ref = db.collection("cheers").doc();
  await ref.set({
    empNo, team, name, message, likes: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, id: ref.id };
});

/** 좋아요 (사용자당 최대 3회, 한 댓글당 1회, 취소 불가) */
export const likeCheer = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  const cheerId = cleanStr(request.data?.cheerId);
  if (!empNo) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  if (!cheerId) throw new HttpsError("invalid-argument", "대상 응원이 없습니다.");

  const cheerRef = db.doc(`cheers/${cheerId}`);
  const likeRef = db.doc(`cheerLikes/${empNo}__${cheerId}`);

  const result = await db.runTransaction(async (t) => {
    // 모든 읽기 먼저
    const cheerSnap = await t.get(cheerRef);
    if (!cheerSnap.exists) throw new HttpsError("not-found", "존재하지 않는 응원입니다.");
    const dupSnap = await t.get(likeRef);
    if (dupSnap.exists) throw new HttpsError("already-exists", "이미 좋아요한 응원이에요.");
    const mine = await t.get(db.collection("cheerLikes").where("empNo", "==", empNo));
    if (mine.size >= LIKE_MAX) {
      throw new HttpsError("resource-exhausted", `좋아요를 모두 사용했어요 (최대 ${LIKE_MAX}회).`);
    }
    // 쓰기
    t.set(likeRef, { empNo, cheerId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    t.update(cheerRef, { likes: admin.firestore.FieldValue.increment(1) });
    return { likes: (cheerSnap.data().likes || 0) + 1, likesUsed: mine.size + 1, likesMax: LIKE_MAX };
  });
  return { ok: true, ...result };
});

// ───────────────────────────────────────── 현황 조회 ─────────────────────────────────────────
export const getStatus = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  const name = cleanStr(request.data?.name);
  if (!empNo) throw new HttpsError("invalid-argument", "사번이 필요합니다.");

  const today = kstDate();
  const [cfgSnap, drawsSnap, userSnap, rosterSnap] = await Promise.all([
    db.doc("config/event").get(),
    db.collection("draws").where("empNo", "==", empNo).get(),
    db.doc(`users/${empNo}`).get(),
    db.doc(`roster/${empNo}`).get(),
  ]);

  const cfg = cfgSnap.data() || {};
  // 참여자 명단 검증 (사번+이름) — 미등록/불일치면 입장 거부
  assertRoster(cfg, empNo, name, rosterSnap);
  const ev = evalEvent(cfg, today);

  const packs = drawsSnap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.drawDate < b.drawDate ? -1 : 1));

  // 모든 팩의 카드를 평탄화 (홈 최근목록 / 도감용)
  const cards = [];
  for (const p of packs) {
    for (const c of p.cards || []) {
      cards.push({
        drawDate: p.drawDate,
        gradeId: c.gradeId, gradeRank: c.gradeRank, gradeLabel: c.gradeLabel,
        gradeName: c.gradeName || "",
        cardId: c.cardId, cardName: c.cardName || "", cardImage: c.cardImage,
      });
    }
  }

  const drewToday = packs.some((p) => p.drawDate === today);
  const savedName = userSnap.data()?.name || name || "";
  // 테스트 계정(사번 0000)은 운영설정과 무관하게 무한 뽑기
  const unlimited = cfg.unlimitedDraws === true || empNo === "0000";

  return {
    name: savedName,
    today,
    eventActive: ev.ok,
    eventReason: ev.ok ? null : ev.reason,
    startDate: cfg.startDate || null,
    endDate: cfg.endDate || null,
    cardsPerPack: cfg.cardsPerPack || 5,
    unlimitedDraws: unlimited,
    canDrawToday: ev.ok && (unlimited || !drewToday),
    drewToday,
    cards,
    packsCount: packs.length,
  };
});
