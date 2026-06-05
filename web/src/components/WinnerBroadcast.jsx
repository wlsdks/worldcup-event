import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRecentWinners } from "../api";

const RC = ["", "holo", "gold", "silver"];
const RANK_TXT = { 0: "스페셜", 1: "1등", 2: "2등", 3: "3등" };

/**
 * 메인 화면 당첨자 실시간 알림 — 접속 중 새 당첨이 생기면 1번씩 역동적으로 띄우고,
 * 로그인 직후엔 가장 최근 당첨을 1번 보여준 뒤 상단 티커가 이어서 회전 표시.
 */
export default function WinnerBroadcast({ onActiveChange }) {
  const [current, setCurrent] = useState(null);
  const lastAt = useRef(-1);
  const seen = useRef(new Set());
  const queue = useRef([]);
  const showing = useRef(false);

  const pump = () => {
    if (showing.current) return;
    const next = queue.current.shift();
    if (!next) return;
    showing.current = true;
    setCurrent(next);
    onActiveChange?.(true);
    setTimeout(() => {
      setCurrent(null);
      showing.current = false;
      onActiveChange?.(false);
      setTimeout(pump, 450);
    }, 4500);
  };

  useEffect(() => {
    let alive = true;
    const load = async (first) => {
      try {
        const ws = await getRecentWinners();
        if (!alive || !ws.length) return;
        const fresh = first
          ? ws.slice(0, 1) // 로그인 직후: 최신 1건만
          : ws.filter((w) => (w.at || 0) > lastAt.current && !seen.current.has(w.id));
        fresh.forEach((w) => seen.current.add(w.id));
        lastAt.current = Math.max(lastAt.current, ...ws.map((w) => w.at || 0));
        if (fresh.length) {
          queue.current.push(...fresh.slice().reverse());
          pump();
        }
      } catch { /* 무시 */ }
    };
    load(true);
    const poll = setInterval(() => load(false), 12000);
    return () => { alive = false; clearInterval(poll); };
  }, []);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className={`winner-cast ${RC[current.gradeRank] || "gold"}`}
          initial={{ y: -100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          aria-live="polite"
        >
          <span className="wc-shine" aria-hidden />
          <span className="wc-emoji">🎉</span>
          <div className="wc-text">
            <b className="wc-name">{current.name}</b>님{" "}
            <b className="wc-grade">{RANK_TXT[current.gradeRank] || current.gradeLabel}</b> 당첨!
          </div>
          <span className="wc-emoji">🎉</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
