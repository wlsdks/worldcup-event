import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import CardModal from "./CardModal.jsx";

function rankClass(rank) {
  return ["special", "holo", "gold", "silver", "bronze", "basic"][rank] || "basic";
}

// 숫자 카운트업 (0 → target, easeOutCubic)
function useCountUp(target, ms = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf; const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setVal(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

// 가중치 기반 획득 확률 표시 문자열
function oddsText(odds) {
  if (odds >= 1) return `${Math.round(odds * 10) / 10}%`;
  if (odds >= 0.1) return `${Math.round(odds * 100) / 100}%`;
  if (odds > 0) return "0.1% 미만";
  return "-";
}

export default function Collection({ catalog, status, onBack }) {
  const [selected, setSelected] = useState(null);

  const grades = catalog.grades || [];
  const cards = catalog.cards || [];
  const owned = new Set((status?.cards || []).map((d) => d.cardId));
  const pct = cards.length ? Math.round((owned.size / cards.length) * 100) : 0;

  // 등급별 카드 1장 뽑힐 확률(가중치/전체가중치+꽝)
  const totalW = grades.reduce((s, g) => s + (g.weight || 0), 0) + (catalog.config?.missWeight || 0);
  const oddsOf = (g) => (totalW > 0 ? ((g.weight || 0) / totalW) * 100 : 0);

  const [fill, setFill] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setFill(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);
  const shownPct = useCountUp(pct);          // 수집률 % 카운트업
  const shownOwned = useCountUp(owned.size); // 보유 수 카운트업

  return (
    <div className="screen collection">
      <header className="coll-top">
        <button className="link-btn" onClick={onBack}>← 뒤로</button>
        <h2>카드 도감</h2>
        <span className="coll-count">{shownOwned}<i>/{cards.length}</i></span>
      </header>

      <div className="coll-intro">
        <span className="coll-kicker">CARD COLLECTION</span>
        <span className="coll-progress-line">{shownPct}% 수집 완료</span>
      </div>
      <div className="coll-progress">
        <div className="coll-progress-bar">
          <div className="coll-progress-fill" style={{ width: `${fill}%` }} />
        </div>
        <span className="coll-progress-pct">{shownPct}%</span>
      </div>

      {grades.map((g) => {
        const gradeCards = cards.filter((c) => c.gradeId === g.id);
        if (gradeCards.length === 0) return null;
        const ownedCount = gradeCards.filter((c) => owned.has(c.id)).length;
        return (
          <section key={g.id} className="coll-grade">
            <div className="grade-head-row">
              <div className={`grade-head ${rankClass(g.rank)}`}>
                <span className="grade-label">{g.label}</span>
                <span className="grade-name">{g.name}</span>
                <span className="grade-count">{ownedCount}/{gradeCards.length}</span>
              </div>
              <span className={`grade-odds ${rankClass(g.rank)}`}>
                획득확률 <b>{oddsText(oddsOf(g))}</b>
              </span>
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
        {selected && <CardModal card={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
