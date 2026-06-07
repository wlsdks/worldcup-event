// 등급 차등 햅틱 — 사운드 없는 환경에서 촉각으로 위계를 전달.
// rank: 0=SP … 5=일반. 상위일수록 길고 리듬감 있게.
const PATTERNS = {
  charge: [12, 26],                  // 팩 차징
  tear: {                            // 팩 찢김(등급대 암시: epic 더 강하게)
    epic: [25, 50, 25, 70, 35],
    base: [22, 55, 30],
  },
  summon: {                          // 소환 빌드업 시작
    0: [16, 40, 16, 60, 22, 90], 1: [16, 40, 16, 60, 22, 80],
    2: [16, 40, 18], 3: [15, 38], 4: [14],
  },
  reveal: {                          // 카드 공개 임팩트
    0: [40, 45, 90, 45, 130], 1: [34, 42, 80, 40, 100],
    2: [26, 45, 55], 3: [20, 40], 4: [14], 5: [10],
  },
};

function fire(p) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate && p) navigator.vibrate(p); } catch { /* 무시 */ }
}

export const haptic = {
  charge: () => fire(PATTERNS.charge),
  tear: (tier) => fire(tier === "epic" ? PATTERNS.tear.epic : PATTERNS.tear.base),
  summon: (rank) => fire(PATTERNS.summon[rank] ?? PATTERNS.summon[4]),
  reveal: (rank) => fire(PATTERNS.reveal[rank] ?? PATTERNS.reveal[5]),
};
