import { useRef } from "react";

// index = 등급 rank (0=스페셜 최상위, 1=1등 … 5=참여상)
export const RC = ["special", "holo", "gold", "silver", "bronze", "basic"];
export const rcOf = (r) => RC[r] || "basic";

/** 포인터 기반 3D 틸트 + 홀로 광원 위치 (imperative, 리렌더 없음) */
export function useTilt() {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 16).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 16).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return { ref, onMove, onLeave };
}
