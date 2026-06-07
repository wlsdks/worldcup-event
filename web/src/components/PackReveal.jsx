import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { rcOf, useTilt } from "../lib/cardUtils";
import { celebrate } from "../lib/celebrate";
import CardModal from "./CardModal.jsx";

// 등급별 공개 빌드업 시간(ms) — CSS .summon --sm 과 일치. 5등은 즉시(빌드업 없음).
const SUMMON_DUR = { 0: 3400, 1: 3200, 2: 3000, 3: 2000, 4: 1000 };
// 스페셜 전용 예고 문구
const SP_OMEN = "특별한 기운이 감돈다…";
// 개봉 인트로 타자기 문구 (등급별). 5등은 안타까움의 "...".
const INTRO_MSG = {
  0: "운명이 깨어난다…",
  1: "전설이 강림한다…",
  2: "심상치 않은 기운이…!",
  3: "오… 느낌이 좋다!",
  4: "기대해도 좋아…",
  5: "...",
};
// 1등 카드 테두리 반짝이 위치 (%)
const SPK = [[8,6],[50,3],[92,6],[96,35],[94,70],[88,94],[50,97],[12,94],[6,68],[8,34]];
export function FrameSparkles() {
  return (
    <div className="frame-sparkles" aria-hidden>
      {SPK.map(([l, t], i) => (
        <span key={i} className="spk" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${(i % 5) * 0.26}s` }} />
      ))}
    </div>
  );
}
const WARP = Array.from({ length: 26 }, (_, i) => i);
const SHUF = [
  { x: -150, y: -110, r: -26 },
  { x: 150, y: -95, r: 22 },
  { x: -120, y: 125, r: -16 },
  { x: 135, y: 120, r: 18 },
  { x: 0, y: -160, r: 0 },
];
// 부유 파티클(안티그래비티)
// 조명 속을 떠다니는 미세 먼지/입자 (스타디움 공기감) — 큼직한 보케 대체
const MOTES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 1.5 + ((i * 7) % 4),
  dur: 9 + (i % 7),
  delay: (i % 9) * 0.7,
  drift: (i % 2 ? 1 : -1) * (6 + (i % 5) * 3),
}));

/** 카드 한 장 — scaleX 스쿼시 플립 + 중간 면 교체 (backface-visibility/3D 의존 X → 모바일 사파리 포함 모든 브라우저 안전) */
function Card({ card, revealed, size = "lg" }) {
  const tilt = useTilt();
  const rc = rcOf(card.gradeRank);
  const isPrize = card.gradeRank <= 3;
  // 플립 중간(가장 얇아지는 순간)에 뒷면→앞면 교체
  const [showFront, setShowFront] = useState(revealed);
  useEffect(() => {
    if (revealed && !showFront) {
      const t = setTimeout(() => setShowFront(true), 200);
      return () => clearTimeout(t);
    }
    if (!revealed && showFront) setShowFront(false);
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={tilt.ref}
      className={`tilt-layer ${size}`}
      onPointerMove={tilt.onMove}
      onPointerLeave={tilt.onLeave}
    >
      {/* 뒤집힐 때 카드 뒤에서 새어나오는 빛 (프라이즈 등급) */}
      {revealed && isPrize && <span className={`flip-leak ${rc} r${card.gradeRank}`} aria-hidden />}
      <motion.div
        className="flip-layer"
        animate={{
          scaleX: revealed ? [1, 0.04, 1] : 1,
          // 프라이즈 등급: 펼쳐진 직후 부르르 흔들림 (등급 높을수록 강하게)
          ...(revealed && isPrize
            ? {
                x: card.gradeRank <= 1 ? [0, -7, 6, -5, 4, -2, 0] : [0, -4, 3, -2, 0],
                rotateZ: card.gradeRank <= 1 ? [0, -2, 1.6, -1.1, 0.6, 0] : [0, -1, 0.8, 0],
              }
            : {}),
        }}
        transition={{
          scaleX: { duration: 0.46, times: [0, 0.46, 1], ease: "easeInOut" },
          x: { duration: card.gradeRank <= 1 ? 0.6 : 0.42, delay: 0.42 },
          rotateZ: { duration: card.gradeRank <= 1 ? 0.6 : 0.42, delay: 0.42 },
        }}
      >
        {showFront ? (
          <div className={`face face-front ${rc} ${card.isMiss ? "miss" : ""}`}>
            {card.isMiss ? (
              <div className="miss-face">
                <div className="miss-emoji">😢</div>
                <div className="miss-big">꽝</div>
                <div className="miss-sub">다음 기회에!</div>
              </div>
            ) : (
              <>
                <img src={`/cards/${card.cardImage}`} alt={card.cardName} draggable={false} />
                {isPrize && <div className="holo-fx" />}
                {isPrize && <div className="foil-sweep" />}
                {!isPrize && <div className="card-sheen" />}
                {card.gradeRank <= 1 && <FrameSparkles />}
              </>
            )}
          </div>
        ) : (
          <div className={`face face-back ${rc} ${!revealed && isPrize ? "charged" : ""}`}>
            <img className="back-img" src="/cards/card-back.png" alt="" draggable={false} />
          </div>
        )}
      </motion.div>
    </div>
  );
}

/** 공개 임팩트 — 화면 플래시 + 충격파 링 (파티클/불꽃은 canvas-confetti가 담당) */
function Burst({ rank }) {
  if (rank > 3) return null;
  return (
    <div className={`burst ${rcOf(rank)}`}>
      <div className="burst-flash" />
      <div className="shock" />
      {rank <= 2 && <div className="shock shock2" />}
    </div>
  );
}

// 빌드업 상승 불티
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: 6 + ((i * 61) % 88),
  dur: 1 + (i % 4) * 0.3,
  delay: (i % 8) * 0.13,
  size: 2 + (i % 3),
}));

// 등급별 오라 색 에스컬레이션 경로 — 모든 빌드업은 '블루'에서 출발해 등급대만큼 차오른다(near-miss 서스펜스).
// 동시에 레어도 3톤 그룹핑: 레어=블루 / 에픽·유니크=퍼플 / 전설·SP=골드. 클라이맥스 직전 진짜 등급색으로 '해방'.
const AURA_PATH = {
  0: ["blue", "purple", "gold"], // SP
  1: ["blue", "purple", "gold"], // 전설
  2: ["blue", "purple"],          // 유니크
  3: ["blue", "purple"],          // 에픽
  4: ["blue"],                    // 레어
};

/** 소환 빌드업 (FIFA 워크아웃 톤) — 어둠 + 양옆 스포트라이트가 하늘로 솟구치고, 불티가 오르며, 클라이맥스에 플레어가 터진다. 등급 높을수록 길고 강하게. */
function SummonBuildup({ rank }) {
  const rc = rcOf(rank);
  const path = AURA_PATH[rank] || ["blue"];
  const dur = SUMMON_DUR[rank] || 1000;
  const [stage, setStage] = useState(path[0]); // blue → purple → gold → "real"(등급색 해방)
  const [pulse, setPulse] = useState(0);        // 단계 상승마다 차오르는 충전 펄스

  useEffect(() => {
    const timers = [];
    // 첫 단계는 즉시. 이후 단계는 dur 의 18~68% 구간에 분산 배치해 한 칸씩 차오르게.
    path.forEach((st, k) => {
      if (k === 0) return;
      const at = dur * (0.18 + (0.5 * k) / path.length);
      timers.push(setTimeout(() => { setStage(st); setPulse((p) => p + 1); }, at));
    });
    // 클라이맥스(플레어 ~86%) 직전 진짜 등급색으로 해방 → 최종 폭발은 등급 고유색으로.
    timers.push(setTimeout(() => { setStage("real"); setPulse((p) => p + 1); }, dur * 0.78));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className={`summon ${rc} r${rank} ${stage !== "real" ? `st-${stage}` : ""}`}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="sm-dark" />
      {pulse > 0 && <div key={pulse} className="sm-pulse" />}
      <div className="sm-vignette" />
      {/* 스페셜 전용 — 카드 주변에서 빛이 점점 크게 새어나감 + 예고 문구 */}
      {rank === 0 && (
        <>
          <div className="sm-leak" />
          <div className="sm-halo-ring" />
          <div className="sm-halo-ring sm-halo-ring2" />
          <div className="sm-omen">{SP_OMEN}</div>
        </>
      )}
      {/* 볼류메트릭 빔 — 하단에서 하늘로 솟구침 (가산 블렌딩) */}
      <div className="sm-spot sm-spot-l" />
      <div className="sm-spot sm-spot-r" />
      <div className="sm-spot sm-spot-l2" />
      <div className="sm-spot sm-spot-r2" />
      {/* 2등(유니크)부터 6빔으로 볼륨 강화 — 3등(4빔)과 위계 구분, 천둥/번개는 1등·SP 전용 */}
      {rank <= 2 && (
        <>
          <div className="sm-spot sm-spot-l3" />
          <div className="sm-spot sm-spot-r3" />
        </>
      )}
      {/* 카드 솟아오르는 자리에서 퍼지는 god-ray 팬 */}
      <div className="sm-rays" />
      <div className="sm-core" />
      <div className="sm-sparks">
        {SPARKS.map((s) => (
          <span
            key={s.id}
            className="sm-spark"
            style={{ left: `${s.left}%`, width: s.size, height: s.size, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
          />
        ))}
      </div>
      {rank <= 1 && (
        <>
          <span className="bolt bolt-1" />
          <span className="bolt bolt-2" />
          <div className="sm-thunder" />
        </>
      )}
      {/* 클라이맥스: 렌즈 플레어(가로 streak + 광원) + 화면 플래시 */}
      <div className="sm-flare" />
      <div className="sm-streak" />
      <div className="sm-whiteflash" />
    </motion.div>
  );
}


/** 개봉 인트로: 우주로 빨려들며 카드 셔플 → 카드팩 → (사용자 탭 시에만) 뜯기 */
function IntroSequence({ onDone, rank = 9 }) {
  const [step, setStep] = useState("warp"); // warp → type → pack → torn
  // 좋은 등급은 찢기 전부터 "뭔가 다르다" — 정확한 등급은 숨기고 등급대만 암시. 색은 등급색(rc)으로.
  const tier = rank <= 2 ? "epic" : rank === 3 ? "rare" : "";
  const rc = rank <= 5 ? rcOf(rank) : "";
  const introMsg = INTRO_MSG[rank] || "...";
  const [typed, setTyped] = useState("");

  // warp(1.0s) → type(타자기) → pack
  useEffect(() => {
    const t = setTimeout(() => setStep("type"), 1000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (step !== "type") return;
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setTyped(introMsg.slice(0, i));
      if (i >= introMsg.length) {
        clearInterval(iv);
        setTimeout(() => setStep("pack"), 600);
      }
    }, 80);
    return () => clearInterval(iv);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // 자동 개봉 없음 — 사용자가 직접 탭해야 열림
  function tear() {
    setStep((s) => {
      if (s !== "pack") return s;
      if (navigator.vibrate) navigator.vibrate(tier === "epic" ? [20, 40, 20, 60, 30] : [20, 50, 30]);
      setTimeout(onDone, tier === "epic" ? 820 : 720);
      return "torn";
    });
  }

  return (
    <motion.div className={`intro ${tier} ${rc}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={`warp ${step !== "warp" ? "out" : ""}`}>
        {WARP.map((i) => (
          <span
            key={i}
            className="warp-line"
            style={{ transform: `rotate(${(i * 360) / 26}deg) translateY(-8vmax)`, animationDelay: `${(i % 6) * 0.08}s` }}
          />
        ))}
      </div>

      <div className="shuffle">
        {SHUF.map((s, i) => (
          <motion.div
            key={i}
            className="shuf-card"
            initial={{ x: s.x, y: s.y, rotate: s.r, opacity: 0 }}
            animate={
              step === "warp"
                ? { x: 0, y: 0, rotate: (i - 2) * 5, opacity: 1 }
                : { y: -36, opacity: 0, scale: 0.92 }
            }
            transition={{ delay: step === "warp" ? 0.15 + i * 0.08 : 0, type: "spring", stiffness: 220, damping: 18 }}
          />
        ))}
      </div>

      <AnimatePresence>
        {step === "type" && (
          <motion.div
            key="introtype"
            className={`intro-type ${tier}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
          >
            {typed}
            <span className="type-caret">▍</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(step === "pack" || step === "torn") && (
          <motion.div
            className={`pack-open ${step === "torn" ? "torn" : ""}`}
            onClick={tear}
            initial={{ scale: 0.6, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 230, damping: 18 }}
          >
            {tier && <div className="pack-aura" aria-hidden />}
            {tier === "epic" && (
              <div className="pack-orbits" aria-hidden>
                <span /><span /><span />
              </div>
            )}
            <div className="po-top" />
            <div className="po-bottom" />
            <div className="tear-flash" />
            {step !== "torn" && (
              <div className="booster-tab">
                {tier === "epic" ? "✦✦ 심상치 않다… 탭하여 개봉 ✦✦" : tier === "rare" ? "✦ 느낌이 좋다! 탭하여 개봉 ✦" : "✦ 탭하여 개봉 ✦"}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PackReveal({ result, config, onClose }) {
  const cards = result.cards || [];
  const N = cards.length;

  const [phase, setPhase] = useState("intro"); // intro → reveal → summary
  const [mode, setMode] = useState("one"); // one | all (드래그 제거)
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(() => cards.map(() => false));
  const [burst, setBurst] = useState({ key: 0, rank: 9 });
  const [shaking, setShaking] = useState(false);
  const [summon, setSummon] = useState(null); // 프라이즈 공개 직전 소환 빌드업
  const [detail, setDetail] = useState(null); // 결과 화면에서 카드 상세보기

  const allDone = revealed.every(Boolean);
  const current = cards[idx];
  const curRevealed = revealed[idx];

  const team = config?.contactTeam || "인재경영팀";
  const person = config?.contactPerson || "윤도현";
  const bestRank = useMemo(() => cards.reduce((m, c) => Math.min(m, c.gradeRank), 9), [cards]);

  const overlayRef = useRef(null);
  const onParallax = (e) => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(3));
    el.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(3));
  };

  const fireBurst = (rank) => setBurst({ key: Date.now(), rank });

  const doReveal = (i) => {
    setRevealed((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
    fireBurst(cards[i].gradeRank);
    if (!cards[i].isMiss) celebrate(cards[i].gradeRank);
    if (cards[i].gradeRank <= 3 && navigator.vibrate) navigator.vibrate(70);
    if (cards[i].gradeRank <= 3) {
      // 3등=가벼운 흔들림 / 1·2등(+스페셜)=강한 흔들림
      setShaking(cards[i].gradeRank <= 2 ? "hard" : "soft");
      setTimeout(() => setShaking(false), cards[i].gradeRank <= 2 ? 460 : 300);
    }
  };

  const revealAt = (i) => {
    if (revealed[i]) return;
    const rank = cards[i].gradeRank;
    // 등급별 빌드업 시간(ms). CSS --sm 과 반드시 일치. 5등은 빌드업 없이 즉시.
    const dur = SUMMON_DUR[rank];
    if (dur) {
      setSummon({ key: Date.now(), rank });
      if (navigator.vibrate) navigator.vibrate(rank <= 1 ? [15, 40, 15, 60, 20, 90] : [15, 40, 15]);
      setTimeout(() => { setSummon(null); doReveal(i); }, dur);
    } else {
      doReveal(i);
    }
  };
  const advance = () => setIdx((i) => Math.min(N - 1, i + 1));
  const deckAction = () => {
    if (!curRevealed) revealAt(idx);
    else if (idx < N - 1) advance();
  };
  // 모두까기 → 전부 공개 후 곧장 결과(summary) 화면으로
  const revealAllToSummary = () => {
    setRevealed(cards.map(() => true));
    fireBurst(bestRank);
    if (bestRank <= 5) celebrate(bestRank);
    if (bestRank <= 3 && navigator.vibrate) navigator.vibrate([40, 40, 80]);
    if (bestRank <= 3) { setShaking(bestRank <= 2 ? "hard" : "soft"); setTimeout(() => setShaking(false), bestRank <= 2 ? 460 : 300); }
    setTimeout(() => setPhase("summary"), bestRank <= 3 ? 1100 : 650);
  };

  const energyRank = phase === "reveal" && !curRevealed && current && current.gradeRank <= 3 ? current.gradeRank : 0;
  // 배경 등급 틴트: 카드가 '공개된 뒤'에만 등급색을 입힌다. 빌드업(공개 전)은 중립으로 둬서
  // 소환 색 에스컬레이션(블루→퍼플→골드)이 배경 등급색에 묻히거나 등급이 미리 새지 않게 함.
  const overlayRc =
    phase === "summary" || allDone
      ? rcOf(bestRank)
      : phase === "reveal" && curRevealed && current && current.gradeRank <= 3
        ? rcOf(current.gradeRank)
        : "";

  return (
    <motion.div
      ref={overlayRef}
      onPointerMove={onParallax}
      className={`pack-overlay ${overlayRc} ${energyRank ? "amped" : ""} phase-${phase}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="stadium-bg" aria-hidden>
        <div className="pl topspot" />
        <div className="topspot-pool" />
        <div className="pl motes">
          {MOTES.map((o) => (
            <span
              key={o.id}
              className="mote"
              style={{ left: `${o.left}%`, top: `${o.top}%`, width: o.size, height: o.size, animationDuration: `${o.dur}s`, animationDelay: `${o.delay}s`, "--drift": `${o.drift}px` }}
            />
          ))}
        </div>
      </div>
      <div className="cinematic" aria-hidden />
      <AnimatePresence>{phase === "reveal" && burst.rank <= 3 && <Burst key={burst.key} rank={burst.rank} />}</AnimatePresence>
      <AnimatePresence>{summon && <SummonBuildup key={summon.key} rank={summon.rank} />}</AnimatePresence>

      {/* ── 인트로 ── */}
      <AnimatePresence>
        {phase === "intro" && <IntroSequence key="intro" rank={bestRank} onDone={() => setPhase("reveal")} />}
      </AnimatePresence>

      {/* ── 공개 ── */}
      {phase === "reveal" && (
        <>
          {N > 1 && (
            <div className="mode-tabs">
              <button className={mode === "one" ? "on" : ""} onClick={() => setMode("one")}>한 장씩</button>
              <button className={mode === "drag" ? "on" : ""} onClick={() => setMode("drag")}>드래그</button>
              <button className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>한번에</button>
            </div>
          )}

          {/* 카드 위 — 확률 배지만 (등급/당첨문구는 카드 아트 + 하단 상품란이 전달) */}
          <div className="reveal-top">
            {curRevealed && current && !current.isMiss && typeof current.gradeOdds === "number" && (
              <motion.div
                className={`win-prob ${rcOf(current.gradeRank)}`}
                key={`prob-${idx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                ✨ {current.gradeOdds >= 0.1 ? `${current.gradeOdds}%` : "0.1% 미만"} 확률로 획득!
              </motion.div>
            )}
          </div>

          {mode === "all" && N > 1 ? (
            <div className={`grid-stage ${shaking ? `shake ${shaking}` : ""}`}>
              <div className={`pack-grid n${N}`}>
                {cards.map((c, i) => (
                  <div key={i} className="grid-cell">
                    <Card card={c} revealed={revealed[i]} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`deck-stage ${shaking ? `shake ${shaking}` : ""}`}>
              <AnimatePresence>
                {curRevealed && current && (
                  <motion.div
                    key={`halo-${idx}`}
                    className={`reveal-halo ${rcOf(current.gradeRank)}`}
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45 }}
                  >
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="deck-stack">
                <div className="deck-pile" aria-hidden>
                  {cards.slice(idx + 1, idx + 3).map((_, k) => (
                    <div key={k} className="pile-card" style={{ transform: `translateY(${-(k + 1) * 7}px) scale(${1 - (k + 1) * 0.045})` }} />
                  ))}
                </div>
                <AnimatePresence mode="popLayout">
                  {(!allDone || idx < N) && (
                    <motion.div
                      key={idx}
                      className="deck-card-enter"
                      initial={{ scale: 0.85, opacity: 0, y: 22 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.92, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    >
                      <motion.div
                        className="deck-card-wrap"
                        whileTap={!curRevealed ? { scale: 0.97 } : undefined}
                        onClick={() => mode !== "all" && deckAction()}
                      >
                        <Card card={current} revealed={curRevealed} size="lg" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {N > 1 && (
            <div className="pack-progress">
              {cards.map((c, i) => (
                <span key={i} className={`dot ${revealed[i] ? `on ${rcOf(c.gradeRank)}` : ""} ${i === idx && mode !== "all" ? "cur" : ""}`} />
              ))}
            </div>
          )}

          {/* 카드 아래 — 설명란 + 액션 */}
          <div className="reveal-bottom">
            {curRevealed && current && !current.isMiss && (current.cardDesc || current.cardName) ? (
              <motion.div
                className="reveal-desc"
                key={`desc-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.3 }}
              >
                {current.cardName && <span className="rd-name">{current.cardName}</span>}
                {current.cardDesc && <p>{current.cardDesc}</p>}
              </motion.div>
            ) : !curRevealed ? (
              <div className="deck-hint">카드를 탭하면 오픈!</div>
            ) : null}

            {curRevealed && current && !current.isMiss && (
              <motion.div
                className={`reveal-prize ${rcOf(current.gradeRank)}`}
                key={`prize-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.3 }}
              >
                <div className="rp-prize">🎁 {current.gradePrize || current.gradeName} 당첨!</div>
                <div className="rp-contact">
                  {current.gradeRank <= 4 ? (
                    <>경품은 <b>{team} {person}</b>님께 DM 또는 방문하여 수령하세요.</>
                  ) : (
                    <>각 호실에 비치된 <b>축구공 초콜릿</b>을 가져가서 드시면 됩니다!</>
                  )}
                </div>
              </motion.div>
            )}

            <div className="pack-actions">
              {!allDone && N > 1 && <button className="btn-ghost slim" onClick={revealAllToSummary}>모두 오픈</button>}
              {allDone ? (
                <button className="btn-primary" onClick={() => setPhase("summary")}>결과 확인 ▶</button>
              ) : mode === "all" && N > 1 ? (
                <button className="btn-primary" onClick={revealAllToSummary}>한번에 오픈 후 결과 보기</button>
              ) : (
                <button className="btn-primary" onClick={deckAction}>{curRevealed ? "다음 ▶" : "오픈"}</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── 최종 5장 요약 ── */}
      {phase === "summary" && (
        <motion.div className="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="summary-title">🎉 이번 팩 결과 <span>({N}장)</span></div>
          <div className={`pack-grid n${N} summary-grid`}>
            {cards.map((c, i) => (
              <motion.div
                key={i}
                className={`grid-cell ${c.isMiss ? "" : "clickable"}`}
                onClick={() => !c.isMiss && setDetail(c)}
                role={c.isMiss ? undefined : "button"}
                initial={{ opacity: 0, scale: 0.7, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.09, type: "spring", stiffness: 300, damping: 20 }}
              >
                <Card card={c} revealed size="sm" />
              </motion.div>
            ))}
          </div>
          {!cards.every((c) => c.isMiss) && (
            <div className="summary-hint">ⓘ 카드를 탭하면 상세 설명을 볼 수 있어요</div>
          )}
          {bestRank <= 4 && (
            <div className="pack-contact">
              🎁 <b>{team} {person}</b>님께 DM 또는 방문하여 경품을 수령하세요!
            </div>
          )}
          {bestRank === 5 && (
            <div className="pack-contact">
              🍫 각 호실별 비치된 <b>축구공 초콜릿</b>을 가져가서 드세요~!
            </div>
          )}
          <button className="btn-primary" onClick={onClose}>확인</button>
        </motion.div>
      )}

      <AnimatePresence>
        {detail && <CardModal card={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
