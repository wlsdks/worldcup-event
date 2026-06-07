import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRecentWinners, getCheers } from "../api";

const RC = ["", "holo", "gold", "silver", "bronze"];

/**
 * 상단 전광판 — 최근 당첨자(등급/등수)와 응원 한마디를 번갈아 흘려보여준다.
 * 당첨자는 본인 제외(mine), 응원은 랜덤 순서로 섞어 매번 다르게 노출.
 */
export default function WinnerTicker({ hidden, me }) {
  const [winners, setWinners] = useState([]);
  const [cheers, setCheers] = useState([]);
  const [idx, setIdx] = useState(0);

  // 20초마다 갱신 (당첨자 + 응원 동시 로드)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [ws, cs] = await Promise.all([
        getRecentWinners(me).then((a) => a.filter((x) => !x.mine)).catch(() => []),
        getCheers(me).then((r) => r.cheers || []).catch(() => []),
      ]);
      if (alive) { setWinners(ws); setCheers(cs); }
    };
    load();
    const poll = setInterval(load, 20000);
    return () => { alive = false; clearInterval(poll); };
  }, [me]);

  // 당첨 ↔ 응원을 번갈아 인터리브한 피드 (응원은 랜덤 셔플)
  const feed = useMemo(() => {
    const wins = winners.map((w) => ({ kind: "win", key: "w" + w.id, ...w }));
    const chs = [...cheers]
      .filter((c) => c.message && c.message.trim())
      .sort(() => Math.random() - 0.5)
      .map((c) => ({ kind: "cheer", key: "c" + c.id, ...c }));
    const out = [];
    const n = Math.max(wins.length, chs.length);
    for (let i = 0; i < n; i++) {
      if (i < wins.length) out.push(wins[i]);
      if (i < chs.length) out.push(chs[i]);
    }
    return out;
  }, [winners, cheers]);

  // 4초마다 다음 항목으로 회전
  useEffect(() => {
    if (feed.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % feed.length), 4000);
    return () => clearInterval(t);
  }, [feed]);

  if (feed.length === 0 || hidden) return null;
  const item = feed[idx % feed.length];
  const rc = RC[item.gradeRank] || "gold";

  return (
    <div className="ticker">
      <span className="ticker-mega" aria-hidden>{item.kind === "win" ? "🏆" : "📣"}</span>
      <div className="ticker-view">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.key + idx}
            className="ticker-msg"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {item.kind === "win" ? (
              <>
                <span className={`ti-badge ${rc}`}>{item.gradeLabel}</span>
                <strong className={rc}>{item.name}</strong>님 당첨!
              </>
            ) : (
              <>
                <span className="ti-badge cheer">{item.team ? item.team : "응원"}</span>
                <strong>{item.name}</strong> · {item.message}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
