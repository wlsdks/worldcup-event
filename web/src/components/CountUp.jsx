import { useState, useEffect } from "react";

/** 숫자 카운트업 (0 → value, easeOutCubic). decimals 소수 자릿수, suffix 단위 */
export default function CountUp({ value, ms = 700, decimals = 0, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf; const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setV(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{decimals ? v.toFixed(decimals) : Math.round(v)}{suffix}</>;
}
