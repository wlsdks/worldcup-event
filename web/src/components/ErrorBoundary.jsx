import { Component } from "react";

/**
 * 렌더 에러 안전장치 — 자식(예: WebGL 3D 카드)이 런타임 에러를 던지면
 * 앱 전체가 깨지지 않고 fallback(예: CSS 카드)으로 대체한다.
 * 일부 브라우저/드라이버(Edge 등)에서 WebGL 컨텍스트 생성 실패 대비.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    try { console.warn("ErrorBoundary fallback:", err?.message || err); } catch { /* noop */ }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
