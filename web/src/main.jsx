import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// StrictMode는 dev에서 컴포넌트를 이중 마운트하여 진입 애니메이션이 두 번 재생됨(모달 "2번 로딩"처럼 보임).
// 이벤트 페이지 특성상 애니메이션 중복이 버그처럼 보여 비활성화.
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
