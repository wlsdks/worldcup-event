import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import CardModal from "./CardModal.jsx";
import { getPublicResult } from "../api";

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

/**
 * 명예의 전당 — 한정 카드(SP·1~4등)가 누군가 뽑을 때마다 당첨자와 함께 공개되는 공용 보드.
 * 1일 1회·1인 1뽑기 이벤트라 개인 도감 대신 "누가 무엇을 가져갔나" 현황으로 재해석.
 */
export default function Collection({ catalog, onBack }) {
  const [selected, setSelected] = useState(null);
  const [pub, setPub] = useState(null);
  const [toast, setToast] = useState(null);
  const seenIdsRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = () => getPublicResult().then((d) => {
      if (!alive) return;
      const hallNow = d.hall || [];
      // 첫 로드 이후 새로 공개된 한정 카드 → 토스트
      if (seenIdsRef.current) {
        const fresh = hallNow.filter((h) => !seenIdsRef.current.has(h.id));
        if (fresh.length) {
          const top = fresh.slice().sort((a, b) => b.at - a.at)[0];
          setToast({ key: Date.now(), name: top.name, grade: top.gradeLabel, rank: top.gradeRank });
        }
      }
      seenIdsRef.current = new Set(hallNow.map((h) => h.id));
      setPub(d);
    }).catch(() => {});
    load();
    const poll = setInterval(load, 15000); // 실시간 공개 반영
    return () => { alive = false; clearInterval(poll); };
  }, []);

  // 토스트 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const grades = (catalog.grades || []).slice().sort((a, b) => a.rank - b.rank);
  const gradeTotals = pub?.gradeTotals || {};
  const hall = pub?.hall || [];
  const byGrade = {};
  hall.forEach((h) => { (byGrade[h.gradeId] = byGrade[h.gradeId] || []).push(h); });

  const limitedTotal = Object.values(gradeTotals).reduce((s, n) => s + n, 0);
  // 채워진 슬롯 수(등급별 재고 상한으로 캡 — 테스트 초과뽑기 방어)
  const claimed = grades.reduce((s, g) => {
    const t = gradeTotals[g.id];
    return t == null ? s : s + Math.min((byGrade[g.id] || []).length, t);
  }, 0);
  const shownPart = useCountUp(Math.round(pub?.participationRate || 0));

  // 최근 공개(최신순) + '방금' 하이라이트(10분 이내)
  const now = Date.now();
  const RECENT_MS = 10 * 60 * 1000;
  const recent = [...hall].sort((a, b) => b.at - a.at).slice(0, 6);
  const isRecent = (at) => at && now - at < RECENT_MS;

  return (
    <div className="screen collection">
      <header className="coll-top">
        <button className="link-btn" onClick={onBack}>← 뒤로</button>
        <h2>명예의 전당</h2>
        <span className="coll-count">{claimed}<i>/{limitedTotal}</i></span>
      </header>

      <div className="coll-intro">
        <span className="coll-kicker">HALL OF FAME</span>
        <span className="coll-progress-line">한정 카드 {claimed} / {limitedTotal} 공개</span>
      </div>
      <p className="hall-desc">
        누군가 <b>한정 카드</b>를 뽑을 때마다 이 곳에 당첨자와 함께 카드가 공개됩니다.
        단 한 명의 주인공만 가질 수 있어요.
      </p>
      <div className="hall-stat">
        <div className="hs-cell"><b>{shownPart}%</b><span>전체 참여율</span></div>
        <div className="hs-div" aria-hidden />
        <div className="hs-cell"><b>{pub?.participantCount || 0}</b><span>참여 인원</span></div>
      </div>

      {pub && claimed === 0 && (
        <div className="hall-empty">
          <div className="hall-empty-mark">★</div>
          <div className="hall-empty-title">아직 공개된 한정 카드가 없어요</div>
          <div className="hall-empty-sub">곧 첫 번째 주인공이 나타납니다!</div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="hall-recent">
          <span className="hall-recent-label">최근 공개</span>
          <div className="hall-recent-row">
            {recent.map((w) => (
              <div key={w.id} className={`hr-card ${rankClass(w.gradeRank)} ${isRecent(w.at) ? "just" : ""}`}>
                {w.cardImage && <img src={`/cards/${w.cardImage}`} alt={w.cardName} draggable={false} loading="lazy" decoding="async" />}
                <span className="hr-name">{w.name}</span>
                {isRecent(w.at) && <span className="hr-just">방금</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {grades.map((g) => {
        const unlimited = gradeTotals[g.id] == null;
        if (unlimited) {
          return (
            <section key={g.id} className="coll-grade">
              <div className="grade-head-row">
                <div className={`grade-head ${rankClass(g.rank)}`}>
                  <span className="grade-label">{g.label}</span>
                  <span className="grade-name">{g.name}</span>
                </div>
                <span className="grade-odds basic">참여 상품</span>
              </div>
              <div className="hall-common">함께한 모두의 카드 · <b>{pub?.commonCount || 0}명</b> 획득</div>
            </section>
          );
        }
        const total = gradeTotals[g.id] || 0;
        const wins = byGrade[g.id] || [];
        const slots = Array.from({ length: total }, (_, i) => wins[i] || null);
        return (
          <section key={g.id} className="coll-grade">
            <div className="grade-head-row">
              <div className={`grade-head ${rankClass(g.rank)}`}>
                <span className="grade-label">{g.label}</span>
                <span className="grade-name">{g.name}</span>
                <span className="grade-count">{Math.min(wins.length, total)}/{total}</span>
              </div>
              <span className={`grade-odds ${rankClass(g.rank)}`}>한정 {total}장</span>
            </div>
            <div className="coll-grid">
              {slots.map((w, i) => w ? (
                <div
                  key={i}
                  className={`coll-card ${rankClass(g.rank)} got ${isRecent(w.at) ? "just" : ""}`}
                  role="button" tabIndex={0}
                  onClick={() => setSelected({
                    cardImage: w.cardImage, cardName: w.cardName, desc: `${w.name}님이 획득한 카드입니다.`,
                    gradeLabel: g.label, gradeName: g.name, gradeRank: g.rank,
                  })}
                >
                  {w.cardImage && <img src={`/cards/${w.cardImage}`} alt={w.cardName} draggable={false} loading="lazy" decoding="async" />}
                  {g.rank <= 3 && <div className="foil-sweep" />}
                  {isRecent(w.at) && <span className="coll-just">방금</span>}
                  <span className="coll-winner">{w.name}</span>
                </div>
              ) : (
                <div key={i} className={`coll-card ${rankClass(g.rank)} locked`}>
                  <div className="lock">？</div>
                  <span className="coll-name">미공개</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className={`hall-toast ${rankClass(toast.rank)}`}
            initial={{ y: -44, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -44, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
          >
            <span className="ht-spark" aria-hidden>✦</span>
            <span><b>{toast.name}</b>님 <b className="ht-grade">{toast.grade}</b> 공개!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && <CardModal card={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
