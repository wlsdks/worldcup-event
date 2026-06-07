import { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

// 어드민은 일반 사용자 번들에서 분리(코드 스플리팅) — /admin 진입 시에만 로드.
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));

// StrictMode는 dev에서 컴포넌트를 이중 마운트하여 진입 애니메이션이 두 번 재생됨(모달 "2번 로딩"처럼 보임).
// 이벤트 페이지 특성상 애니메이션 중복이 버그처럼 보여 비활성화.
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/admin" element={<Suspense fallback={<div className="app boot"><div className="spinner" /></div>}><AdminApp /></Suspense>} />
      <Route path="/*" element={<App />} />
    </Routes>
  </BrowserRouter>
);
