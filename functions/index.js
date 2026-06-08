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
setGlobalOptions({ region: "asia-northeast3", maxInstances: 20 });

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
// minInstances:1 — 행사 첫 뽑기 콜드스타트 제거(소액 상시비용). 행사 종료 후 0으로 되돌리면 비용 없음.
export const drawCard = onCall({ minInstances: 1 }, async (request) => {
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

  // 카드 풀(active)은 운영 중 변하지 않는 정적 카탈로그 → 트랜잭션 밖에서 1회 읽기(트랜잭션 경량화·속도↑).
  const cardsAllSnap = await db.collection("cards").where("active", "==", true).get();
  const cardsByGrade = {};
  cardsAllSnap.docs.forEach((d) => {
    const c = { id: d.id, ...d.data() };
    (cardsByGrade[c.gradeId] = cardsByGrade[c.gradeId] || []).push(c);
  });

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

    // 유저 상태 읽기 — 모든 write 전에. 총 허용 = 기본 N회 + 응원/좋아요로 적립한 보너스.
    const userRef = db.doc(`users/${empNo}`);
    const userSnap = await t.get(userRef);
    const bonusDraws = userSnap.exists ? (Number(userSnap.data().bonusDraws) || 0) : 0;
    const drawsUsed = userSnap.exists ? (Number(userSnap.data().drawCount) || 0) : 0;
    const baseDraws = Math.max(1, Number(cfg.baseDraws) || 3);
    const allowance = baseDraws + bonusDraws;

    // 총 허용 횟수까지 뽑기 가능(일일 제한 없음). 매 뽑기는 새 기록 문서.
    if (!unlimitedDraws && drawsUsed >= allowance) {
      throw new HttpsError("failed-precondition", "카드팩 뽑기 기회를 모두 사용했어요!");
    }
    const drawRef = db.collection("draws").doc();

    const gradesSnap = await t.get(db.collection("grades"));
    const grades = gradesSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
    if (grades.length === 0) throw new HttpsError("failed-precondition", "등급 설정이 없습니다.");

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

    // 표시용 기본 확률(가중치 기반): grade.weight / (모든 등급 weight 합 + 꽝 weight)
    const baseTotalW = grades.reduce((s, g) => s + (g.weight || 0), 0) + missWeight;

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
      // 희소성 카피용 — 유한 등급의 총 한정 수량 / 이번이 몇 번째 획득인지
      let gradeTotal = null, gradeOrdinal = null;
      if (grade.unlimited !== true) {
        localAvail[grade.id] -= 1;
        consumed[grade.id] = (consumed[grade.id] || 0) + 1;
        gradeTotal = grade.inventoryTotal || 0;
        const remainingBefore = grade.inventoryRemaining ?? grade.inventoryTotal ?? 0;
        gradeOrdinal = Math.max(1, gradeTotal - remainingBefore + consumed[grade.id]); // 이번 카드 포함 순번
      }
      const odds = baseTotalW > 0 ? (grade.weight || 0) / baseTotalW * 100 : 0;
      picked.push({
        gradeId: grade.id, gradeRank: grade.rank, gradeLabel: grade.label,
        gradeName: grade.name || "", gradeColor: grade.color || null,
        gradePrize: grade.prize || "", gradeOdds: Math.round(odds * 10) / 10,
        gradeTotal, gradeOrdinal,
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
      userRef,
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
export const getRecentWinners = onCall(async (request) => {
  // 호출자 본인 사번 — 본인 당첨은 'mine' 으로 표시(다른 사람 사번은 노출하지 않음).
  // 본인 결과가 상단 배너/티커에 떠서 리빌 전 스포일러가 되는 것을 막기 위함.
  const me = cleanStr(request?.data?.empNo);
  const snap = await db.collection("draws").orderBy("createdAt", "desc").limit(60).get();
  const winners = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const at = d.createdAt?.toMillis?.() || 0;
    (d.cards || []).forEach((c, ci) => {
      if ((c.gradeRank ?? 99) <= 4) { // 1~4등(레어 포함)까지 전광판/명예의 전당 연동
        winners.push({
          id: `${doc.id}_${ci}`,
          at,
          name: maskName(d.name),
          team: d.team || "",
          gradeRank: c.gradeRank,
          gradeLabel: c.gradeLabel,
          gradeName: c.gradeName || "",
          mine: !!me && d.empNo === me,
        });
      }
    });
    if (winners.length >= 15) break;
  }
  return { winners: winners.slice(0, 15) };
});

/**
 * 공용 결과 — 명예의 전당(한정 등급 당첨 카드+당첨자) + 전체 참여 통계.
 * 종료 화면/명예의 전당 보드에서 사용. 이름은 마스킹.
 */
export const getPublicResult = onCall(async () => {
  const [rosterSnap, gradesSnap, drawsSnap] = await Promise.all([
    db.collection("roster").get(),
    db.collection("grades").get(),
    db.collection("draws").orderBy("createdAt", "asc").get(),
  ]);
  const rosterCount = rosterSnap.size;
  const gradeTotals = {};
  gradesSnap.docs.forEach((d) => { const g = d.data(); if (g.unlimited !== true) gradeTotals[d.id] = g.inventoryTotal || 0; });

  const participants = new Set();
  const hall = [];
  let commonCount = 0;
  const commonByCard = {}; // 5등 카드별 뽑은 인원 수 { cardId: count }
  drawsSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (!d.gift && !d.forced) participants.add(d.empNo);
    (d.cards || []).forEach((c, ci) => {
      const rank = c.gradeRank ?? 99;
      if (rank <= 4) {
        hall.push({
          id: `${doc.id}_${ci}`, gradeId: c.gradeId, gradeRank: rank,
          gradeLabel: c.gradeLabel, gradeName: c.gradeName || "",
          cardId: c.cardId, cardImage: c.cardImage || null, cardName: c.cardName || "",
          name: maskName(d.name), team: d.team || "", at: d.createdAt?.toMillis?.() || 0,
        });
      } else if (rank === 5) {
        commonCount += 1;
        if (c.cardId) commonByCard[c.cardId] = (commonByCard[c.cardId] || 0) + 1;
      }
    });
  });
  const participantCount = participants.size;
  const participationRate = rosterCount ? Math.round((participantCount / rosterCount) * 1000) / 10 : 0;
  return { rosterCount, participantCount, participationRate, commonCount, commonByCard, gradeTotals, hall };
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
  let posted = false;
  if (empNo) {
    const mine = await db.collection("cheerLikes").where("empNo", "==", empNo).get();
    likedIds = mine.docs.map((d) => d.data().cheerId);
    const mineCheer = await db.doc(`cheers/${empNo}`).get();
    posted = mineCheer.exists;
  }
  return { cheers, likedIds, likesUsed: likedIds.length, likesMax: LIKE_MAX, posted };
});

/** 응원 댓글 등록 (팀/이름/한마디 직접 입력) */
export const postCheer = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  const team = cleanStr(request.data?.team).slice(0, 30);
  const name = cleanStr(request.data?.name).slice(0, 20);
  const message = cleanStr(request.data?.message).slice(0, 100);
  if (!empNo) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  if (!team) throw new HttpsError("invalid-argument", "응원할 팀을 입력해 주세요.");
  if (!name) throw new HttpsError("invalid-argument", "작성자 이름을 입력해 주세요.");
  if (!message) throw new HttpsError("invalid-argument", "응원 한마디를 입력해 주세요.");

  // 1인 1회: 사번을 문서 ID로 사용 → 중복 작성 불가. 작성 + 추가 뽑기(+1)를 원자적으로 처리.
  const cheerRef = db.doc(`cheers/${empNo}`);
  const userRef = db.doc(`users/${empNo}`);
  const bonusGranted = await db.runTransaction(async (t) => {
    const existing = await t.get(cheerRef);
    if (existing.exists) {
      throw new HttpsError("already-exists", "이미 응원글을 작성하셨어요. 한 분당 1회만 작성할 수 있어요.");
    }
    const us = await t.get(userRef);
    t.set(cheerRef, {
      empNo, team, name, message, likes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    let granted = false;
    if (!(us.exists && us.data().cheerBonusGranted === true)) {
      t.set(userRef, {
        empNo,
        bonusDraws: admin.firestore.FieldValue.increment(1),
        cheerBonusGranted: true,
      }, { merge: true });
      granted = true;
    }
    return granted;
  });
  return { ok: true, id: empNo, bonusGranted };
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
    // 좋아요 보상: 좋아요 3회 완료 시 1인 1회 추가 뽑기(+1). likeBonusGranted 플래그로 중복 방지.
    const userRef = db.doc(`users/${empNo}`);
    const userSnap = await t.get(userRef); // 모든 읽기는 쓰기 전에
    const newUsed = mine.size + 1;
    // 쓰기
    t.set(likeRef, { empNo, cheerId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    t.update(cheerRef, { likes: admin.firestore.FieldValue.increment(1) });
    let likeBonusGranted = false;
    if (newUsed >= LIKE_MAX && !(userSnap.exists && userSnap.data().likeBonusGranted === true)) {
      t.set(userRef, {
        empNo,
        bonusDraws: admin.firestore.FieldValue.increment(1),
        likeBonusGranted: true,
      }, { merge: true });
      likeBonusGranted = true;
    }
    return { likes: (cheerSnap.data().likes || 0) + 1, likesUsed: newUsed, likesMax: LIKE_MAX, likeBonusGranted };
  });
  return { ok: true, ...result };
});

// ───────────────────────────────────────── 현황 조회 ─────────────────────────────────────────
// minInstances:1 — 로그인 시 첫 호출 콜드스타트 제거(소액 상시비용). 행사 후 0으로 복귀 권장.
export const getStatus = onCall({ minInstances: 1 }, async (request) => {
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
  const bonusDraws = Number(userSnap.data()?.bonusDraws) || 0;
  // 테스트 계정(사번 0000)은 운영설정과 무관하게 무한 뽑기
  const unlimited = cfg.unlimitedDraws === true || empNo === "0000";
  // 총 허용 = 기본 N회 + 적립 보너스. 남은 횟수 = 허용 − 사용(뽑은 팩 수).
  const baseDraws = Math.max(1, Number(cfg.baseDraws) || 3);
  const drawsUsed = packs.length;
  const allowance = baseDraws + bonusDraws;
  const drawsLeft = Math.max(0, allowance - drawsUsed);

  return {
    name: savedName,
    today,
    eventActive: ev.ok,
    eventReason: ev.ok ? null : ev.reason,
    startDate: cfg.startDate || null,
    endDate: cfg.endDate || null,
    cardsPerPack: cfg.cardsPerPack || 5,
    unlimitedDraws: unlimited,
    bonusDraws,
    baseDraws,
    drawsUsed,
    drawsLeft,
    allowance,
    canDrawToday: ev.ok && (unlimited || drawsLeft > 0),
    drewToday,
    cards,
    packsCount: packs.length,
  };
});

/** 뽑기 기록 전체 초기화 — 데모/테스트용(사번 0000만 호출 가능).
 *  draws 전부 삭제 + 모든 user의 뽑기 카운트/보너스 리셋 + 한정 등급 재고 복원.
 *  응원/좋아요 기록은 보존. */
export const resetAllDraws = onCall(async (request) => {
  const empNo = cleanStr(request.data?.empNo);
  if (empNo !== "0000") {
    throw new HttpsError("permission-denied", "데모 계정에서만 초기화할 수 있습니다.");
  }
  const FV = admin.firestore.FieldValue;
  let batch = db.batch();
  let n = 0;
  const flush = async () => { if (n > 0) { await batch.commit(); batch = db.batch(); n = 0; } };

  // 1) draws 전체 삭제
  const drawsSnap = await db.collection("draws").get();
  let deleted = 0;
  for (const d of drawsSnap.docs) { batch.delete(d.ref); n++; deleted++; if (n >= 450) await flush(); }
  await flush();

  // 2) 모든 user 뽑기 상태 리셋(보너스/플래그 포함) — 응원/좋아요 기록은 유지
  const usersSnap = await db.collection("users").get();
  for (const u of usersSnap.docs) {
    batch.set(u.ref, {
      drawCount: 0, cardCount: 0, bonusDraws: 0,
      cheerBonusGranted: FV.delete(), likeBonusGranted: FV.delete(),
    }, { merge: true });
    n++; if (n >= 450) await flush();
  }
  await flush();

  // 3) 한정 등급 재고 복원
  const gradesSnap = await db.collection("grades").get();
  for (const g of gradesSnap.docs) {
    const gd = g.data();
    if (gd.unlimited !== true && gd.inventoryTotal != null) {
      batch.update(g.ref, { inventoryRemaining: gd.inventoryTotal }); n++;
    }
  }
  await flush();

  return { ok: true, deletedDraws: deleted };
});

// ─────────────────────────────────────────────────────────────
// 관리자(admin) — 설정/등급/팀 갱신. 클라이언트 직접 쓰기는 rules로 막혀있으므로
// 마스터 키로 인증된 호출만 Admin SDK 로 쓰기.
// 운영: 환경변수 ADMIN_MASTER_KEY(시크릿)로 주입. 미설정 시 데모 키로 폴백(로컬/데모 전용).
// ─────────────────────────────────────────────────────────────
const ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || "demo-master";

export const adminLoad = onCall(async (request) => {
  if ((request.data?.masterKey || "") !== ADMIN_MASTER_KEY) {
    throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
  }
  const [cfgSnap, gradesSnap, teamsSnap, cardsSnap, drawsSnap, rosterSnap] = await Promise.all([
    db.doc("config/event").get(),
    db.collection("grades").get(),
    db.collection("teams").get(),
    db.collection("cards").get(),
    db.collection("draws").get(),
    db.collection("roster").get(),
  ]);
  const grades = gradesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.rank - b.rank);
  const cardCounts = {};
  cardsSnap.docs.forEach((d) => { const g = d.data().gradeId; cardCounts[g] = (cardCounts[g] || 0) + 1; });

  // ── 통계 집계 ──
  const participants = new Set();
  const winners = []; // 프라이즈(rank<=4) 당첨자
  const awardedByGrade = {}; // 등급별 당첨 수
  const hourly = Array(24).fill(0); // KST 시간대별 실제 뽑기 수
  const kstHourFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false });
  let drawCount = 0;
  let giftCount = 0;
  drawsSnap.docs.forEach((d) => {
    const dd = d.data();
    const isGift = dd.gift === true || dd.forced === true;
    // 실제 뽑기만 참여자/뽑기수로 집계 (관리자 선물·강제추첨 제외)
    if (isGift) giftCount += 1;
    else {
      drawCount += 1;
      if (dd.empNo) participants.add(dd.empNo);
      const ms = dd.createdAt?.toMillis?.();
      if (ms) { let h = parseInt(kstHourFmt.format(new Date(ms)), 10); if (h === 24) h = 0; if (h >= 0 && h < 24) hourly[h] += 1; }
    }
    (dd.cards || []).forEach((c) => {
      awardedByGrade[c.gradeId] = (awardedByGrade[c.gradeId] || 0) + 1;
      if ((c.gradeRank ?? 9) <= 4) {
        winners.push({
          empNo: dd.empNo || "", name: dd.name || "", gradeRank: c.gradeRank,
          gradeLabel: c.gradeLabel || "", gradeName: c.gradeName || "", prize: c.gradePrize || "",
          gift: isGift, forced: dd.forced === true,
          at: dd.createdAt?.toMillis?.() || 0,
        });
      }
    });
  });
  winners.sort((a, b) => (a.gradeRank - b.gradeRank) || (b.at - a.at));
  const rosterCount = rosterSnap.size;
  // 비-테스트 참여자(0000 제외)
  participants.delete("0000");
  const participantCount = participants.size;

  // 등급 현황: 한정 등급의 남은 재고
  const gradeStatus = grades.map((g) => ({
    id: g.id, rank: g.rank, label: g.label, name: g.name,
    inventoryTotal: g.inventoryTotal ?? null,
    inventoryRemaining: g.unlimited ? null : (g.inventoryRemaining ?? g.inventoryTotal ?? 0),
    awarded: awardedByGrade[g.id] || 0,
    unlimited: g.unlimited === true,
  }));

  // 일반(5등) 배출 수 — 당첨자 테이블엔 미표시(수가 많음), 집계만.
  const commonGrade = grades.find((g) => g.rank === 5);
  const commonCount = commonGrade ? (awardedByGrade[commonGrade.id] || 0) : 0;
  // 명단(검색 선택용)
  const roster = rosterSnap.docs.map((d) => ({ empNo: d.id, name: d.data().name || "" })).sort((a, b) => a.empNo.localeCompare(b.empNo));

  return {
    config: cfgSnap.exists ? cfgSnap.data() : {},
    grades,
    teams: teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)),
    cardCounts,
    roster,
    stats: { rosterCount, participantCount, drawCount, giftCount, commonCount, hourly, participationRate: rosterCount > 0 ? Math.round(participantCount / rosterCount * 1000) / 10 : 0 },
    winners,
    gradeStatus,
  };
});

export const adminUpdate = onCall(async (request) => {
  const { masterKey, section, data } = request.data || {};
  if ((masterKey || "") !== ADMIN_MASTER_KEY) {
    throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
  }
  const clean = (v) => (typeof v === "string" ? v.trim() : v);

  if (section === "event") {
    const allowed = {};
    ["eventName", "active", "startDate", "endDate", "rosterRequired", "unlimitedDraws", "cardsPerPack", "missWeight", "prizeNote", "contactTeam", "contactPerson", "contactHow"].forEach((k) => {
      if (data[k] !== undefined) allowed[k] = clean(data[k]);
    });
    await db.doc("config/event").set(allowed, { merge: true });
    return { ok: true };
  }

  if (section === "grade") {
    const id = clean(data.id);
    if (!id) throw new HttpsError("invalid-argument", "grade id 필요");
    const fields = {};
    ["name", "prize", "color"].forEach((k) => { if (data[k] !== undefined) fields[k] = clean(data[k]); });
    if (data.weight !== undefined) fields.weight = Math.max(0, Number(data.weight) || 0);
    if (data.inventoryTotal !== undefined) {
      if (data.inventoryTotal === null || data.inventoryTotal === "") {
        fields.inventoryTotal = null; fields.unlimited = true; fields.dailyQuota = {};
      } else {
        const total = Math.max(0, parseInt(data.inventoryTotal, 10) || 0);
        const cfg = (await db.doc("config/event").get()).data() || {};
        fields.inventoryTotal = total;
        fields.inventoryRemaining = total;
        fields.unlimited = false;
        fields.dailyQuota = cfg.startDate ? { [cfg.startDate]: total } : {};
      }
    }
    await db.doc(`grades/${id}`).set(fields, { merge: true });
    return { ok: true };
  }

  if (section === "teamUpsert") {
    const id = clean(data.id);
    if (!id) throw new HttpsError("invalid-argument", "team id 필요");
    await db.doc(`teams/${id}`).set({
      name: clean(data.name) || "팀",
      emoji: clean(data.emoji) || "⚽",
      order: Number(data.order) || 0,
    }, { merge: true });
    return { ok: true };
  }

  if (section === "teamDelete") {
    const id = clean(data.id);
    if (!id) throw new HttpsError("invalid-argument", "team id 필요");
    await db.doc(`teams/${id}`).delete();
    return { ok: true };
  }

  throw new HttpsError("invalid-argument", "알 수 없는 section");
});

// ─────────────────────────────────────────────────────────────
// 관리자 운영 액션 — 이벤트 초기화 / 전인원 추가뽑기 / 특정인원 카드선물
// ─────────────────────────────────────────────────────────────
export const adminAction = onCall(async (request) => {
  const { masterKey, action, data = {} } = request.data || {};
  if ((masterKey || "") !== ADMIN_MASTER_KEY) {
    throw new HttpsError("permission-denied", "관리자 권한이 없습니다.");
  }
  const FV = admin.firestore.FieldValue;

  // 이벤트 초기화: 모든 뽑기 기록 삭제 + 등급 재고 복원 + 유저 상태 초기화
  if (action === "resetEvent") {
    const [drawsSnap, gradesSnap, usersSnap] = await Promise.all([
      db.collection("draws").get(),
      db.collection("grades").get(),
      db.collection("users").get(),
    ]);
    // 배치는 500개 제한 → 청크 처리
    const ops = [];
    drawsSnap.docs.forEach((d) => ops.push(["del", d.ref]));
    usersSnap.docs.forEach((d) => ops.push(["del", d.ref]));
    gradesSnap.docs.forEach((g) => {
      const gd = g.data();
      if (gd.inventoryTotal != null) ops.push(["upd", g.ref, { inventoryRemaining: gd.inventoryTotal }]);
    });
    for (let i = 0; i < ops.length; i += 450) {
      const batch = db.batch();
      ops.slice(i, i + 450).forEach(([op, ref, val]) => {
        if (op === "del") batch.delete(ref); else batch.update(ref, val);
      });
      await batch.commit();
    }
    return { ok: true, message: `초기화 완료 — 뽑기 ${drawsSnap.size}건 삭제, 재고 복원` };
  }

  // 추가 뽑기 지급: target="all"(명단 전체) 또는 사번. count회.
  if (action === "grantDraws") {
    const count = Math.max(1, parseInt(data.count, 10) || 1);
    const target = cleanStr(data.target);
    if (target === "all") {
      const rosterSnap = await db.collection("roster").get();
      const docs = rosterSnap.docs;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = db.batch();
        docs.slice(i, i + 450).forEach((r) => {
          batch.set(db.doc(`users/${r.id}`), { empNo: r.id, name: r.data().name || "", bonusDraws: FV.increment(count) }, { merge: true });
        });
        await batch.commit();
      }
      return { ok: true, message: `명단 ${docs.length}명에게 추가 뽑기 ${count}회 지급` };
    }
    if (!target) throw new HttpsError("invalid-argument", "대상(사번) 필요");
    await db.doc(`users/${target}`).set({ empNo: target, bonusDraws: FV.increment(count) }, { merge: true });
    return { ok: true, message: `${target}에게 추가 뽑기 ${count}회 지급` };
  }

  // 카드 선물: 특정 사번에게 지정 등급의 랜덤 카드 1장 선물(도감 추가, 재고 무관).
  if (action === "giftCard") {
    const empNo = cleanStr(data.empNo);
    const gradeId = cleanStr(data.gradeId);
    if (!empNo || !gradeId) throw new HttpsError("invalid-argument", "사번·등급 필요");
    const [gradeSnap, cardsSnap, rosterSnap] = await Promise.all([
      db.doc(`grades/${gradeId}`).get(),
      db.collection("cards").where("gradeId", "==", gradeId).get(),
      db.doc(`roster/${empNo}`).get(),
    ]);
    if (!gradeSnap.exists) throw new HttpsError("not-found", "등급 없음");
    if (cardsSnap.empty) throw new HttpsError("failed-precondition", "해당 등급 카드 없음");
    const grade = gradeSnap.data();
    const pick = cardsSnap.docs[Math.floor(Math.random() * cardsSnap.size)];
    const card = pick.data();
    const picked = [{
      gradeId, gradeRank: grade.rank, gradeLabel: grade.label, gradeName: grade.name || "",
      gradePrize: grade.prize || "", cardId: pick.id, cardName: card.name || "", cardImage: card.image, cardDesc: card.desc || "",
    }];
    const name = rosterSnap.exists ? (rosterSnap.data().name || empNo) : empNo;
    await db.collection("draws").add({
      empNo, name, uid: null, drawDate: kstDate(), cards: picked,
      bestRank: grade.rank, miss: false, gift: true, createdAt: FV.serverTimestamp(),
    });
    return { ok: true, message: `${name}(${empNo})에게 [${grade.name}] ${card.name || ""} 선물 완료` };
  }

  // 강제 랜덤 추첨: 한정 등급의 남은 재고를 명단의 미당첨자 중 랜덤으로 채워 당첨자 생성.
  if (action === "fillWinners") {
    const today = kstDate();
    const [gradesSnap, rosterSnap, drawsSnap, cardsSnap] = await Promise.all([
      db.collection("grades").get(),
      db.collection("roster").get(),
      db.collection("draws").get(),
      db.collection("cards").get(),
    ]);
    const wonEmps = new Set();
    drawsSnap.docs.forEach((d) => { const dd = d.data(); (dd.cards || []).forEach((c) => { if ((c.gradeRank ?? 9) <= 4) wonEmps.add(dd.empNo); }); });
    let candidates = rosterSnap.docs
      .map((r) => ({ empNo: r.id, name: r.data().name || r.id }))
      .filter((c) => c.empNo !== "0000" && !wonEmps.has(c.empNo));
    const cardsByGrade = {};
    cardsSnap.docs.forEach((d) => { const c = { id: d.id, ...d.data() }; (cardsByGrade[c.gradeId] = cardsByGrade[c.gradeId] || []).push(c); });
    const grades = gradesSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() })).filter((g) => g.unlimited !== true).sort((a, b) => a.rank - b.rank);
    const results = [];
    const batch = db.batch();
    for (const g of grades) {
      let remaining = g.inventoryRemaining ?? g.inventoryTotal ?? 0;
      const pool = cardsByGrade[g.id] || [];
      if (!pool.length) continue;
      let consumed = 0;
      while (remaining > 0 && candidates.length > 0) {
        const winner = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
        const card = pool[Math.floor(Math.random() * pool.length)];
        batch.set(db.collection("draws").doc(), {
          empNo: winner.empNo, name: winner.name, drawDate: today, bestRank: g.rank, miss: false, gift: true, forced: true,
          cards: [{ gradeId: g.id, gradeRank: g.rank, gradeLabel: g.label, gradeName: g.name || "", gradePrize: g.prize || "", cardId: card.id, cardName: card.name || "", cardImage: card.image, cardDesc: card.desc || "" }],
          createdAt: FV.serverTimestamp(),
        });
        results.push({ empNo: winner.empNo, name: winner.name, grade: g.name || g.label });
        remaining -= 1; consumed += 1;
      }
      if (consumed > 0) batch.update(g.ref, { inventoryRemaining: FV.increment(-consumed) });
    }
    await batch.commit();
    return { ok: true, message: `강제 추첨 완료 — ${results.length}명 당첨`, awarded: results };
  }

  throw new HttpsError("invalid-argument", "알 수 없는 action");
});
