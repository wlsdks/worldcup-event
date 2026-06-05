// 등급별 축포/불꽃 — canvas-confetti(오픈소스) 기반.
import confetti from "canvas-confetti";

const Z = 120;

// 등급별 색 팔레트 (브랜드/등급색)
const PALETTE = {
  special: ["#34d8a0", "#9af3cf", "#ffd86e", "#ffffff", "#5eead4"],
  holo: ["#ffce3a", "#ff6ec4", "#7873f5", "#4ade80", "#ffd86e"],
  gold: ["#f4c145", "#ffe08a", "#ffd166", "#ffffff"],
  silver: ["#cbd5e2", "#eef3f9", "#ffffff", "#b8c2cf"],
  bronze: ["#d9925a", "#ffd0a8", "#ffe6cc"],
  basic: ["#ff7b6e", "#ffd0c8", "#ffffff"],
};
const NAMES = ["special", "holo", "gold", "silver", "bronze", "basic"];
const rcName = (rank) => NAMES[rank] || "basic";
const rand = (min, max) => Math.random() * (max - min) + min;

function bigBurst(colors) {
  confetti({ particleCount: 150, spread: 115, startVelocity: 52, decay: 0.91, scalar: 1.05, origin: { y: 0.52 }, colors, zIndex: Z });
}
function sideCannons(colors) {
  confetti({ particleCount: 70, angle: 60, spread: 62, startVelocity: 48, origin: { x: 0, y: 0.72 }, colors, zIndex: Z });
  confetti({ particleCount: 70, angle: 120, spread: 62, startVelocity: 48, origin: { x: 1, y: 0.72 }, colors, zIndex: Z });
}
function fireworks(duration, colors) {
  const end = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 70, zIndex: Z, colors, scalar: 0.95 };
  (function frame() {
    if (Date.now() > end) return;
    confetti({ ...defaults, particleCount: 24, origin: { x: rand(0.1, 0.4), y: rand(0.18, 0.5) } });
    confetti({ ...defaults, particleCount: 24, origin: { x: rand(0.6, 0.9), y: rand(0.18, 0.5) } });
    requestAnimationFrame(frame);
  })();
}

/** 카드 공개 순간 등급에 맞는 축포. rank: 0(스페셜)~5 */
export function celebrate(rank) {
  if (typeof rank !== "number" || rank > 4) {
    // 5등 등은 아주 소박하게
    if (rank === 5) confetti({ particleCount: 18, spread: 48, startVelocity: 26, origin: { y: 0.66 }, colors: PALETTE.basic, zIndex: Z, scalar: 0.8 });
    return;
  }
  const colors = PALETTE[rcName(rank)] || PALETTE.basic;
  if (rank <= 1) {
    bigBurst(colors);
    fireworks(rank === 0 ? 2000 : 1700, colors); // 스페셜 가장 길게
  } else if (rank === 2) {
    bigBurst(colors);
    sideCannons(colors);
  } else if (rank === 3) {
    confetti({ particleCount: 95, spread: 82, startVelocity: 44, origin: { y: 0.6 }, colors, zIndex: Z, scalar: 0.95 });
  } else {
    confetti({ particleCount: 50, spread: 64, startVelocity: 36, origin: { y: 0.64 }, colors, zIndex: Z, scalar: 0.85 });
  }
}
