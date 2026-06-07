import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import WinnerTicker from "./WinnerTicker.jsx";
import PrizeInfo from "./PrizeInfo.jsx";
import { useTilt } from "../lib/cardUtils";

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
  const totalCards = (catalog?.cards || []).length;
  const collPct = totalCards ? Math.round((ownedCount / totalCards) * 100) : 0;

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
            <div className="ee-cell"><b>{ownedCount}</b><span>획득한 카드</span></div>
            <div className="ee-div" aria-hidden />
            <div className="ee-cell"><b>{collPct}%</b><span>도감 수집률</span></div>
          </div>
          <button className="btn-primary big" onClick={onOpenCollection}>내 도감 보기</button>
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
          <span className="bt-kicker">COLLECTION</span>
          <span className="bt-title">도감 보기</span>
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
