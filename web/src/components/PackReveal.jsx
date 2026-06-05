import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { rcOf, useTilt } from "../lib/cardUtils";
import { playRip, playReveal, playMiss, isMuted, toggleMute } from "../lib/sfx";
import CardModal from "./CardModal.jsx";

const RANK_MSG = { 0: "👑 SPECIAL 당첨!!!", 1: "🏆 1등 당첨!!!", 2: "🥇 2등 당첨!!", 3: "🥈 3등 당첨!", 4: "당첨!", 5: "당첨!" };
const STARS = Array.from({ length: 18 }, (_, i) => i);
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

/** 카드 한 장 (뒷면 ?, 앞면 이미지, 홀로 시너) — 등급 탭은 카드 아트에 이미 인쇄됨 */
function Card({ card, revealed, size = "lg" }) {
  const tilt = useTilt();
  const rc = rcOf(card.gradeRank);
  const isPrize = card.gradeRank <= 3;
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
          rotateY: revealed ? 180 : 0,
          scale: revealed ? [1, 1.07, 1] : 1,
          // 프라이즈 등급: 카드가 펼쳐지는 순간 부르르 흔들림 (등급 높을수록 강하게)
          ...(revealed && isPrize
            ? {
                x: card.gradeRank <= 1 ? [0, -7, 6, -5, 4, -2, 0] : [0, -4, 3, -2, 0],
                rotateZ: card.gradeRank <= 1 ? [0, -2, 1.6, -1.1, 0.6, 0] : [0, -1, 0.8, 0],
              }
            : {}),
        }}
        transition={{
          rotateY: { duration: 0.62, ease: [0.4, 0.1, 0.2, 1] },
          scale: { duration: 0.46, delay: revealed ? 0.22 : 0, times: [0, 0.55, 1] },
          x: { duration: card.gradeRank <= 1 ? 0.6 : 0.42, delay: 0.3 },
          rotateZ: { duration: card.gradeRank <= 1 ? 0.6 : 0.42, delay: 0.3 },
        }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className={`face face-back ${rc} ${!revealed && isPrize ? "charged" : ""}`}>
          <img className="back-img" src="/cards/card-back.png" alt="" draggable={false} />
        </div>
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
      </motion.div>
    </div>
  );
}

/** 등급별 레어 연출 — 중심에서 터지는 방사형 파티클 폭발 + 충격파 링 + (1등)레이 버스트 */
function Burst({ rank }) {
  if (rank > 3) return null;
  const n = rank <= 1 ? 42 : rank === 2 ? 28 : 20;
  const parts = Array.from({ length: n }, (_, i) => i);
  return (
    <div className={`burst ${rcOf(rank)} ${rank <= 1 ? "walkout" : ""}`}>
      <div className="burst-flash" />
      {rank <= 1 && <div className="rare-rays" />}
      <div className="shock" />
      {rank <= 2 && <div className="shock shock2" />}
      <div className="radial">
        {parts.map((i) => (
          <span
            key={i}
            className={`rp rp-${i % 4}`}
            style={{ "--ang": `${(i * 360) / n}deg`, animationDelay: `${(i % 6) * 0.02}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/** 번개 빌드업 — 1·2등(+스페셜) 공개 직전 뒤에서 번개가 치다가 카드 등장 */
function Lightning({ rank }) {
  return (
    <div className={`lightning ${rcOf(rank)}`} aria-hidden>
      <div className="lflash" />
      <span className="bolt bolt-1" />
      <span className="bolt bolt-2" />
      <span className="bolt bolt-3" />
    </div>
  );
}

/** 개봉 인트로: 우주로 빨려들며 카드 셔플 → 카드팩 → (사용자 탭 시에만) 뜯기 */
function IntroSequence({ onDone }) {
  const [step, setStep] = useState("warp"); // warp → pack → torn
  useEffect(() => {
    const t = setTimeout(() => setStep("pack"), 1300);
    return () => clearTimeout(t);
  }, []);

  // 자동 개봉 없음 — 사용자가 직접 탭해야 열림
  function tear() {
    setStep((s) => {
      if (s !== "pack") return s;
      if (navigator.vibrate) navigator.vibrate([20, 50, 30]);
      playRip();
      setTimeout(onDone, 720);
      return "torn";
    });
  }

  return (
    <motion.div className="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
        {step !== "warp" && (
          <motion.div
            className={`pack-open ${step === "torn" ? "torn" : ""}`}
            onClick={tear}
            initial={{ scale: 0.6, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 230, damping: 18 }}
          >
            <div className="po-top" />
            <div className="po-bottom" />
            <div className="tear-flash" />
            {step !== "torn" && <div className="booster-tab">✦ 탭하여 개봉 ✦</div>}
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
  const [mode, setMode] = useState("drag"); // drag | one | all
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(() => cards.map(() => false));
  const [burst, setBurst] = useState({ key: 0, rank: 9 });
  const [shaking, setShaking] = useState(false);
  const [lightning, setLightning] = useState(null); // 1·2등 공개 직전 번개 빌드업
  const [muted, setMuted] = useState(isMuted());
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
    if (cards[i].isMiss) playMiss(); else playReveal(cards[i].gradeRank);
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
    if (rank <= 2) {
      // 1·2등(+스페셜): 번개 빌드업(0.7s) 후 카드 등장
      setLightning({ key: Date.now(), rank });
      if (navigator.vibrate) navigator.vibrate([15, 40, 15, 40]);
      setTimeout(() => { setLightning(null); doReveal(i); }, 720);
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
    if (bestRank >= 99) playMiss(); else playReveal(bestRank);
    if (bestRank <= 3 && navigator.vibrate) navigator.vibrate([40, 40, 80]);
    if (bestRank <= 3) { setShaking(bestRank <= 2 ? "hard" : "soft"); setTimeout(() => setShaking(false), bestRank <= 2 ? 460 : 300); }
    setTimeout(() => setPhase("summary"), bestRank <= 3 ? 1100 : 650);
  };

  const energyRank = phase === "reveal" && !curRevealed && current && current.gradeRank <= 3 ? current.gradeRank : 0;
  // 배경 등급 틴트: 프라이즈 카드 공개 동안 계속 유지(3등부터 배경이 달라지도록), 결과화면은 최고등급
  const overlayRc =
    phase === "summary" || allDone
      ? rcOf(bestRank)
      : phase === "reveal" && current && current.gradeRank <= 3
        ? rcOf(current.gradeRank)
        : "";

  return (
    <motion.div
      ref={overlayRef}
      onPointerMove={onParallax}
      className={`pack-overlay ${overlayRc} ${energyRank ? "amped" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="stadium-bg" aria-hidden>
        <div className="pl floodlights">
          <span className="flood flood-l"><i className="flood-src" /></span>
          <span className="flood flood-r"><i className="flood-src" /></span>
        </div>
        <div className="stands" />
        <div className="haze" />
        <div className="pitch" />
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
      <button
        className="sound-toggle"
        onClick={() => setMuted(toggleMute())}
        aria-label={muted ? "소리 켜기" : "소리 끄기"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <AnimatePresence>{phase === "reveal" && burst.rank <= 3 && <Burst key={burst.key} rank={burst.rank} />}</AnimatePresence>
      <AnimatePresence>{lightning && <Lightning key={lightning.key} rank={lightning.rank} />}</AnimatePresence>

      {/* ── 인트로 ── */}
      <AnimatePresence>
        {phase === "intro" && <IntroSequence key="intro" onDone={() => setPhase("reveal")} />}
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
                    {current.gradeRank <= 3 && <span className="reveal-rays" />}
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
                        drag={mode === "drag"}
                        dragSnapToOrigin
                        dragElastic={0.32}
                        whileDrag={{ scale: 1.03 }}
                        onDragEnd={(e, info) => {
                          const moved = Math.hypot(info.offset.x, info.offset.y);
                          const flung = Math.max(Math.abs(info.velocity.x), Math.abs(info.velocity.y));
                          if (moved > 64 || flung > 380) deckAction();
                        }}
                        onClick={() => mode !== "all" && deckAction()}
                      >
                        <Card card={current} revealed={curRevealed} size="lg" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="deck-hint">
                {!curRevealed ? "카드를 탭하거나 스와이프해서 오픈" : idx < N - 1 ? "탭 / 스와이프해서 다음 카드" : "모두 확인했어요!"}
              </div>
            </div>
          )}

          <div className="pack-progress">
            {cards.map((c, i) => (
              <span key={i} className={`dot ${revealed[i] ? `on ${rcOf(c.gradeRank)}` : ""} ${i === idx && mode !== "all" ? "cur" : ""}`} />
            ))}
          </div>

          <div className="pack-footer">
            {mode !== "all" && curRevealed && current && (
              <motion.div
                className={`reveal-label ${rcOf(current.gradeRank)}`}
                initial={{ opacity: 0, scale: 0.55, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 440, damping: 13 }}
                key={`lbl-${idx}`}
              >
                <b>{current.gradeLabel}{current.gradeName && current.gradeName !== current.gradeLabel ? ` · ${current.gradeName}` : ""}</b>
                <span className="reveal-sub">{current.isMiss ? "꽝! 다음 기회에" : RANK_MSG[current.gradeRank]}</span>
              </motion.div>
            )}

            <div className="pack-actions">
              {!allDone && <button className="btn-ghost slim" onClick={revealAllToSummary}>모두 오픈</button>}
              {allDone ? (
                <button className="btn-primary" onClick={() => setPhase("summary")}>결과 확인 ▶</button>
              ) : mode === "all" ? (
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
