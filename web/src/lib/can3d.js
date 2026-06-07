// 3D 카드(Three.js) 사용 가능 여부 — 저사양/미지원 기기는 CSS 카드로 폴백.
// 한 번만 판정해 캐시.
let cached = null;

export function can3D() {
  if (cached !== null) return cached;
  if (typeof window === "undefined") return (cached = false);

  // 동작 최소화 선호 → 가벼운 CSS 카드
  try {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return (cached = false);
  } catch { /* 무시 */ }

  // WebGL 미지원 → 폴백
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return (cached = false);
  } catch { return (cached = false); }

  // 저사양 휴리스틱 (지원 브라우저 한정)
  const mem = navigator.deviceMemory;          // GB, Chrome 계열
  if (typeof mem === "number" && mem <= 2) return (cached = false);
  const cores = navigator.hardwareConcurrency; // 논리 코어 수
  if (typeof cores === "number" && cores <= 2) return (cached = false);

  return (cached = true);
}
