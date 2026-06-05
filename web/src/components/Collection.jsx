import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CardModal from "./CardModal.jsx";

const REWARD_KEY = "gonom_rewards";

function rankClass(rank) {
  return ["special", "holo", "gold", "silver", "bronze", "basic"][rank] || "basic";
}

export default function Collection({ catalog, status, onBack }) {
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [claimed, setClaimed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(REWARD_KEY) || "[]")); }
    catch { return new Set(); }
  });

  const grades = catalog.grades || [];
  const cards = catalog.cards || [];
  const owned = new Set((status?.cards || []).map((d) => d.cardId));
  const pct = cards.length ? Math.round((owned.size / cards.length) * 100) : 0;

  const [fill, setFill] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setFill(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);

  const claim = (gradeId, label) => {
    setClaimed((prev) => {
      const next = new Set(prev);
      next.add(gradeId);
      localStorage.setItem(REWARD_KEY, JSON.stringify([...next]));
      return next;
    });
    setToast(`🎟️ ${label} 컴플리트 보상 — 뽑기권 1장 획득!`);
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    setTimeout(() => setToast(""), 2600);
  };

  return (
    <div className="screen collection">
      <header className="coll-top">
        <button className="link-btn" onClick={onBack}>← 뒤로</button>
        <h2>카드 도감</h2>
        <span className="coll-count">{owned.size}/{cards.length}</span>
      </header>

      <div className="coll-progress">
        <div className="coll-progress-bar">
          <div className="coll-progress-fill" style={{ width: `${fill}%` }} />
        </div>
        <span className="coll-progress-pct">{pct}%</span>
      </div>

      {grades.map((g) => {
        const gradeCards = cards.filter((c) => c.gradeId === g.id);
        if (gradeCards.length === 0) return null;
        const ownedCount = gradeCards.filter((c) => owned.has(c.id)).length;
        const complete = ownedCount === gradeCards.length;
        const isClaimed = claimed.has(g.id);
        return (
          <section key={g.id} className="coll-grade">
            <div className="grade-head-row">
              <div className={`grade-head ${rankClass(g.rank)}`}>
                <span className="grade-label">{g.label}</span>
                <span className="grade-name">{g.name}</span>
                <span className="grade-count">{ownedCount}/{gradeCards.length}</span>
              </div>
              {complete && (
                isClaimed ? (
                  <span className="reward-done">✓ 수령완료</span>
                ) : (
                  <button className={`reward-btn ${rankClass(g.rank)}`} onClick={() => claim(g.id, g.label)}>
                    🎁 선물받기
                  </button>
                )
              )}
            </div>
            <div className="coll-grid">
              {gradeCards.map((c) => {
                const got = owned.has(c.id);
                const open = () =>
                  got &&
                  setSelected({
                    cardImage: c.image, cardName: c.name, desc: c.desc,
                    gradeLabel: g.label, gradeName: g.name, gradeRank: g.rank,
                  });
                return (
                  <div
                    key={c.id}
                    className={`coll-card ${rankClass(g.rank)} ${got ? "got" : "locked"}`}
                    onClick={open}
                    role={got ? "button" : undefined}
                    tabIndex={got ? 0 : undefined}
                  >
                    <img src={`/cards/${c.image}`} alt={c.name} draggable={false} />
                    {got && g.rank <= 3 && <div className="foil-sweep" />}
                    {!got && <div className="lock">？</div>}
                    <span className="coll-name">{got ? c.name : "미획득"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <AnimatePresence>
        {toast && (
          <motion.div
            className="reward-toast"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && <CardModal card={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
