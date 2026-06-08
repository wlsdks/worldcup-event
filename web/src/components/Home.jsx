import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import WinnerTicker from "./WinnerTicker.jsx";
import PrizeInfo from "./PrizeInfo.jsx";
import { useTilt, rcOf } from "../lib/cardUtils";
import { getPublicResult } from "../api";
import { shareResultImage } from "../lib/shareCard";

function rankClass(rank) {
  return ["special", "holo", "gold", "silver", "bronze", "basic"][rank] || "basic";
}

function eventMessage(status) {
  if (status.eventActive) return null;
  switch (status.eventReason) {
    case "not_started": return `이벤트는 ${status.startDate}에 시작됩니다.`;
    case "ended": return "이벤트가 종료되었습니다. 참여해 주셔서 감사합니다!";
    default: return "현재 이벤트가 진행 중이 아닙니다.";
  }
}

export default function Home({ user, status, catalog, drawing, error, onDraw, onOpenCollection, onOpenCheer, onLogout, revealing }) {
  const [showPrize, setShowPrize] = useState(false);
  const tilt = useTilt();
  const evMsg = eventMessage(status);
  const ended = status.eventReason === "ended";
  const ownedCount = (status?.cards || []).length;

  // 종료 화면용 공용 결과(전체 참여율 + 1~4등) — 종료 시에만 로드
  const [pub, setPub] = useState(null);
  useEffect(() => {
    if (!ended) return;
    let alive = true;
    getPublicResult().then((d) => { if (alive) setPub(d); }).catch(() => {});
    return () => { alive = false; };
  }, [ended]);

  // 내가 뽑은 카드 (catalog 매핑) + 1~4등 명단
  const gradeRankById = {};
  (catalog?.grades || []).forEach((g) => { gradeRankById[g.id] = g.rank; });
  const cardById = {};
  (catalog?.cards || []).forEach((c) => { cardById[c.id] = c; });
  const myCards = (status?.cards || [])
    .map((sc) => cardById[sc.cardId]).filter(Boolean)
    .map((c) => ({ ...c, rank: gradeRankById[c.gradeId] ?? 5 }))
    .sort((a, b) => a.rank - b.rank);
  const topWinners = (pub?.hall || [])
    .filter((h) => h.gradeRank <= 4)
    .sort((a, b) => a.gradeRank - b.gradeRank || a.at - b.at);
  const [sharingResult, setSharingResult] = useState(false);
  const shareResult = async () => {
    if (sharingResult || !pub) return;
    setSharingResult(true);
    try { await shareResultImage(pub); } catch { /* 무시 */ } finally { setSharingResult(false); }
  };

  return (
    <div className="screen home">
      <header className="home-top">
        <div className="home-greet">
          <span className="hg-kicker">HUNET · WORLD CUP 2026</span>
          <span className="hg-name">{status.name || user.name}<em> 님</em></span>
        </div>
        <button className="link-btn" onClick={onLogout}>로그아웃</button>
      </header>

      <WinnerTicker hidden={revealing} me={user?.empNo} />

      {ended ? (
        <section className="event-end">
          <span className="ee-kicker">EVENT CLOSED</span>
          <h1 className="ee-title">이벤트가 종료되었습니다</h1>
          <p className="ee-sub">함께해 주셔서 감사합니다. 수고하셨어요!</p>
          <div className="ee-stat">
            <div className="ee-cell"><b>{pub ? pub.participationRate : 0}%</b><span>전체 참여율</span></div>
            <div className="ee-div" aria-hidden />
            <div className="ee-cell"><b>{ownedCount}</b><span>내 획득 카드</span></div>
          </div>

          {myCards.length > 0 && (
            <div className="ee-block">
              <span className="ee-label">내가 뽑은 카드</span>
              <div className="ee-mine-row">
                {myCards.map((c, i) => (
                  <div key={i} className={`ee-mini ${rcOf(c.rank)}`}>
                    <img src={`/cards/${c.image}`} alt={c.name} draggable={false} loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {topWinners.length > 0 && (
            <div className="ee-block">
              <span className="ee-label">1~4등 주인공</span>
              <div className="ee-win-list">
                {topWinners.map((w) => (
                  <div key={w.id} className="ee-win">
                    <span className={`ee-badge ${rcOf(w.gradeRank)}`}>{w.gradeLabel}</span>
                    <span className="ee-win-name">{w.name}</span>
                    <span className="ee-win-prize">{w.gradeName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ee-actions">
            {pub && (pub.hall?.length > 0 || pub.participantCount > 0) && (
              <button className="btn-ghost slim" onClick={shareResult} disabled={sharingResult}>
                {sharingResult ? "이미지 생성 중…" : "결과 공유"}
              </button>
            )}
            <button className="btn-primary big" onClick={onOpenCollection}>명예의 전당 보기</button>
          </div>
        </section>
      ) : (
        <>
          <div className="home-hero">
            <span className="hh-kicker">GONOM WORLD CUP EDITION</span>
            <h1 className="hh-title">운명의 카드를 뽑아라</h1>
            {status.eventActive && (
              <div className="live-chip"><span className="live-dot" />이벤트 진행 중 · 하루 1회</div>
            )}
          </div>

          <div className="draw-stage">
            <div className="pack-pedestal" aria-hidden>
              <span className="ped-disc" />
              <span className="ped-glow" />
            </div>
            <div
              className="pack-tiltwrap"
              ref={tilt.ref}
              onPointerMove={tilt.onMove}
              onPointerLeave={tilt.onLeave}
            >
            <div className={`pack-hero ${drawing ? "shaking" : ""}`}>
              <div className="pack-hero-glow" />
              <img src="/pack.png" alt="HUNET 월드컵 카드팩" draggable={false} />
            </div>
            </div>
          </div>

          {evMsg && <div className="event-banner">{evMsg}</div>}
          {error && <div className="form-err center">{error}</div>}

          <div className="draw-action">
            {status.canDrawToday ? (
              <button className="btn-primary big" onClick={onDraw} disabled={drawing}>
                {drawing ? "팩 여는 중…" : "카드팩 뽑기"}
              </button>
            ) : status.drewToday ? (
              <button className="btn-primary big" onClick={onOpenCheer}>
                팀별 응원전을 통해 상품을 획득하세요
              </button>
            ) : (
              <button className="btn-primary big" disabled>
                지금은 뽑을 수 없어요
              </button>
            )}
          </div>
        </>
      )}

      {user.empNo === "0000" && !ended && (
        <div className="demo-grade-pick">
          <span className="dgp-label">테스트 전용 · 등급 지정 뽑기 (연출 확인용)</span>
          <div className="dgp-btns">
            {(catalog?.grades || [])
              .slice()
              .sort((a, b) => a.rank - b.rank)
              .map((g) => (
                <button
                  key={g.id}
                  className={`dgp-btn ${rankClass(g.rank)}`}
                  disabled={drawing}
                  onClick={() => onDraw(g.id)}
                >
                  {g.label}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="home-bento">
        <button className="bento-tile feature cheer" onClick={onOpenCheer}>
          <span className="bt-left">
            <span className="bt-kicker">CHEER BATTLE</span>
            <span className="bt-title">응원전 · 우리 팀 순위 올리기</span>
          </span>
          <span className="bt-go">바로가기 ›</span>
        </button>
        <button className="bento-tile" onClick={onOpenCollection}>
          <span className="bt-kicker">HALL OF FAME</span>
          <span className="bt-title">명예의 전당</span>
        </button>
        <button className="bento-tile" onClick={() => setShowPrize(true)}>
          <span className="bt-kicker">PRIZES</span>
          <span className="bt-title">당첨 상품 안내</span>
        </button>
      </div>

      <AnimatePresence>
        {showPrize && (
          <PrizeInfo
            grades={catalog?.grades || []}
            config={catalog?.config || {}}
            onClose={() => setShowPrize(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
