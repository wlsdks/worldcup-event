import { useState } from "react";

export default function Login({ onSubmit }) {
  const [empNo, setEmpNo] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!empNo.trim() || !name.trim()) {
      setErr("사번과 이름을 모두 입력해 주세요.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await onSubmit({ empNo, name });
    } catch (e2) {
      setErr(e2?.message?.replace(/^.*?\/\s*/, "") || "입장에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  // 데모 로그인 — 명단의 테스트 계정(0000/테스트)으로 바로 입장
  const demoLogin = async () => {
    setErr("");
    setLoading(true);
    try {
      await onSubmit({ empNo: "0000", name: "테스트" });
    } catch (e2) {
      setErr(e2?.message?.replace(/^.*?\/\s*/, "") || "입장에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen login">
      <div className="login-panel">
        <div className="login-hero">
          <span className="login-kicker">HUNET · WORLD CUP 2026</span>
          <img className="login-logo" src="/go-korea-hunet.png" alt="Go! Korea, Go! Hunet" />
          <p className="login-sub">사번과 이름을 입력해 입장하세요</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>사번</span>
            <input
              inputMode="text"
              placeholder="예) 2024001"
              value={empNo}
              onChange={(e) => setEmpNo(e.target.value)}
              maxLength={30}
              autoComplete="off"
            />
          </label>
          <label>
            <span>이름</span>
            <input
              placeholder="예) 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              autoComplete="off"
            />
          </label>

          {err && <div className="form-err">{err}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "입장 중…" : "입장하기"}
          </button>
        </form>

        <button type="button" className="demo-login" onClick={demoLogin} disabled={loading}>
          🔧 데모 로그인 (테스트용)
        </button>
      </div>
    </div>
  );
}
