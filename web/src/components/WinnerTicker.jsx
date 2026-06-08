import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCheers } from "../api";

/** 상단 전광판 — 응원 한마디를 순환 노출 */
export default function WinnerTicker({ hidden, me }) {
  const [cheers, setCheers] = useState([]);
  const [idx, setIdx] = useState(0);

  // 20초마다 응원 목록 갱신
  useEffect(() => {
    let alive = true;
    const load = () =>
      getCheers(me)
        .then((r) => { if (alive) setCheers(r.cheers || []); })
        .catch(() => {});
    load();
    const poll = setInterval(load, 20000);
    return () => { alive = false; clearInterval(poll); };
  }, [me]);

  const feed = useMemo(
    () => (cheers || []).filter((c) => c.message && c.message.trim()),
    [cheers]
  );

  // 4초마다 다음 응원으로 순환
  useEffect(() => {
    if (feed.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % feed.length), 4000);
    return () => clearInterval(t);
  }, [feed]);

  if (feed.length === 0 || hidden) return null;
  const item = feed[idx % feed.length];

  return (
    <div className="ticker">
      <span className="ticker-mega" aria-hidden>📣</span>
      <div className="ticker-view">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id + "_" + idx}
            className="ticker-msg"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <span className="ti-badge cheer">{item.team ? item.team : "응원"}</span>
            <strong>{item.name}</strong> · {item.message}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
