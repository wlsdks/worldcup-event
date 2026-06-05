import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRecentWinners } from "../api";

const RC = ["", "holo", "gold", "silver"];

/** 상단 확성기 배너 — 최근 1~3등 당첨자를 주기적으로 흘려보여줌 */
export default function WinnerTicker({ hidden }) {
  const [winners, setWinners] = useState([]);
  const [idx, setIdx] = useState(0);

  // 20초마다 최신 당첨자 갱신
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const w = await getRecentWinners();
        if (alive) setWinners(w);
      } catch { /* 무시 */ }
    };
    load();
    const poll = setInterval(load, 20000);
    return () => { alive = false; clearInterval(poll); };
  }, []);

  // 4초마다 다음 당첨자로 회전
  useEffect(() => {
    if (winners.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % winners.length), 4000);
    return () => clearInterval(t);
  }, [winners]);

  if (winners.length === 0 || hidden) return null;
  const w = winners[idx % winners.length];
  const rc = RC[w.gradeRank] || "gold";

  return (
    <div className="ticker">
      <span className="ticker-mega" aria-hidden>📣</span>
      <div className="ticker-view">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            className="ticker-msg"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <strong className={rc}>{w.name}</strong>님&nbsp;
            <strong className={rc}>{w.gradeLabel}</strong> 당첨! 🎉
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
