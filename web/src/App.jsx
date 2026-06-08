import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { drawCard, getStatus, loadCatalog } from "./api";
import Login from "./components/Login.jsx";
import Home from "./components/Home.jsx";
import Collection from "./components/Collection.jsx";
import CheerBoard from "./components/CheerBoard.jsx";
import PackReveal from "./components/PackReveal.jsx";

const LS_KEY = "gonom_user";
// /demo 경로(또는 ?demo)로 접속할 때만 '데모 로그인' 버튼 노출 — 실사용 페이지에는 숨김
const DEMO_MODE = typeof window !== "undefined" &&
  (window.location.pathname.toLowerCase().includes("/demo") || /[?&]demo\b/i.test(window.location.search));
const EMBERS = Array.from({ length: 14 }, (_, i) => i);

export default function App() {
  const [user, setUser] = useState(null); // { empNo, name }
  const [catalog, setCatalog] = useState({ grades: [], cards: [] });
  const [status, setStatus] = useState(null);
  const [screen, setScreen] = useState("login"); // login | home | collection
  const [booting, setBooting] = useState(true);

  const [drawing, setDrawing] = useState(false);
  const [reveal, setReveal] = useState(null); // 뽑기 결과 (오버레이)
  const [error, setError] = useState("");

  // 부팅: 도감 로드 + 저장된 사용자 복원
  useEffect(() => {
    (async () => {
      try {
        const cat = await loadCatalog();
        setCatalog(cat);
      } catch (e) {
        console.warn("catalog load failed", e);
      }
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        try {
          const u = JSON.parse(saved);
          const st = await getStatus(u);
          setUser(u);
          setStatus(st);
          setScreen("home");
        } catch {
          localStorage.removeItem(LS_KEY);
        }
      }
      setBooting(false);
    })();
  }, []);

  const refreshStatus = useCallback(async (u) => {
    const st = await getStatus(u || user);
    setStatus(st);
    return st;
  }, [user]);

  const handleLogin = async ({ empNo, name }) => {
    setError("");
    const u = { empNo: empNo.trim(), name: name.trim() };
    const st = await getStatus(u);
    setUser(u);
    setStatus(st);
    localStorage.setItem(LS_KEY, JSON.stringify(u));
    setScreen("home");
  };

  const handleDraw = async (forceGrade) => {
    if (drawing) return;
    setError("");
    setDrawing(true);
    // 탭 즉시 개봉 연출(인트로) 시작 — 결과는 백그라운드로 받아 도착 시 채운다(체감 지연 0).
    setReveal({ pending: true, cards: [] });
    try {
      const result = await drawCard({ ...user, forceGrade: typeof forceGrade === "string" ? forceGrade : undefined });
      setReveal(result);
    } catch (e) {
      setReveal(null); // 실패 시 연출 닫기
      const msg = e?.message || "뽑기에 실패했어요. 잠시 후 다시 시도해 주세요.";
      setError(msg.replace(/^.*?\/\s*/, "")); // functions 에러 프리픽스 제거
    } finally {
      setDrawing(false);
    }
  };

  const closeReveal = async () => {
    setReveal(null);
    try { await refreshStatus(); } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem(LS_KEY);
    setUser(null);
    setStatus(null);
    setScreen("login");
  };

  if (booting) {
    return (
      <div className="app boot">
        <div className="splash">
          <span className="splash-kicker">HUNET · WORLD CUP 2026</span>
          <span className="splash-title">고놈 월드컵 카드뽑기</span>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="ambient" aria-hidden>
        {EMBERS.map((i) => (
          <span
            key={i}
            className="ember"
            style={{
              left: `${(i * 37) % 100}%`,
              animationDuration: `${7 + (i % 5)}s`,
              animationDelay: `${(i % 7) * 0.9}s`,
            }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="screen-wrap"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {screen === "login" && <Login onSubmit={handleLogin} demo={DEMO_MODE} />}

          {screen === "home" && status && (
            <Home
              revealing={!!reveal}
              user={user}
              status={status}
              catalog={catalog}
              drawing={drawing}
              error={error}
              onDraw={handleDraw}
              onOpenCollection={() => setScreen("collection")}
              onOpenCheer={() => setScreen("cheer")}
              onLogout={handleLogout}
            />
          )}

          {screen === "collection" && (
            <Collection catalog={catalog} status={status} user={user} onBack={() => setScreen("home")} />
          )}

          {screen === "cheer" && (
            <CheerBoard user={user} teams={catalog.teams || []} onBack={() => { setScreen("home"); refreshStatus().catch(() => {}); }} />
          )}
        </motion.div>
      </AnimatePresence>

      {reveal && (
        <PackReveal result={reveal} config={catalog.config} onClose={closeReveal} />
      )}
    </div>
  );
}
