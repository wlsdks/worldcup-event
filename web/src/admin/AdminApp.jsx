import { useState } from "react";
import { Link } from "react-router-dom";
import { adminLoad, adminUpdate } from "../api";
import "./admin.css";

const MASTER_KEY = "demo-master";

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null); // { config, grades, teams, cardCounts }
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };

  const login = async () => {
    setLoading(true);
    try {
      const d = await adminLoad(MASTER_KEY);
      setData(d);
      setAuthed(true);
    } catch (e) {
      flash("입장 실패: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const reload = async () => {
    try { setData(await adminLoad(MASTER_KEY)); } catch { /* noop */ }
  };

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div className="admin-logo">⚙️ 관리자</div>
          <h1>고놈 월드컵 이벤트 — Admin</h1>
          <p className="admin-sub">이벤트 설정 · 등급/확률/재고 · 응원 팀 관리</p>
          <button className="ad-btn primary" onClick={login} disabled={loading}>
            {loading ? "입장 중…" : "🔓 데모 마스터 로그인"}
          </button>
          <Link to="/" className="admin-back-link">← 이벤트 화면으로</Link>
        </div>
        {toast && <div className="admin-toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <header className="admin-top">
        <div className="admin-title">⚙️ 고놈 월드컵 Admin</div>
        <div className="admin-top-actions">
          <button className="ad-btn ghost" onClick={reload}>↻ 새로고침</button>
          <Link to="/" className="ad-btn ghost">이벤트 화면</Link>
        </div>
      </header>

      <main className="admin-main">
        <EventSection config={data.config} onSaved={(m) => { flash(m); reload(); }} />
        <GradeSection grades={data.grades} cardCounts={data.cardCounts} onSaved={(m) => { flash(m); reload(); }} />
        <TeamSection teams={data.teams} onSaved={(m) => { flash(m); reload(); }} />
      </main>

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}

/* ───────── 이벤트 설정 ───────── */
function EventSection({ config, onSaved }) {
  const [f, setF] = useState({
    eventName: config.eventName || "",
    startDate: config.startDate || "",
    endDate: config.endDate || "",
    rosterRequired: config.rosterRequired !== false,
    unlimitedDraws: config.unlimitedDraws === true,
    cardsPerPack: config.cardsPerPack || 1,
    missWeight: config.missWeight || 0,
    contactTeam: config.contactTeam || "",
    contactPerson: config.contactPerson || "",
    prizeNote: config.prizeNote || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await adminUpdate(MASTER_KEY, "event", f); onSaved("이벤트 설정 저장됨"); }
    catch (e) { onSaved("저장 실패: " + (e?.message || "")); }
    finally { setSaving(false); }
  };

  return (
    <section className="ad-card">
      <h2 className="ad-h2">📅 이벤트 설정</h2>
      <div className="ad-grid">
        <Field label="이벤트 이름"><input value={f.eventName} onChange={(e) => set("eventName", e.target.value)} placeholder="고놈 월드컵 카드뽑기" /></Field>
        <Field label="시작일 (YYYY-MM-DD)"><input value={f.startDate} onChange={(e) => set("startDate", e.target.value)} placeholder="2026-06-04" /></Field>
        <Field label="종료일 (YYYY-MM-DD)"><input value={f.endDate} onChange={(e) => set("endDate", e.target.value)} placeholder="2026-06-06" /></Field>
        <Field label="한 팩당 카드 수"><input type="number" min="1" max="10" value={f.cardsPerPack} onChange={(e) => set("cardsPerPack", e.target.value)} /></Field>
        <Field label="꽝 가중치 (missWeight)"><input type="number" min="0" value={f.missWeight} onChange={(e) => set("missWeight", e.target.value)} /></Field>
        <Field label="경품 담당 팀"><input value={f.contactTeam} onChange={(e) => set("contactTeam", e.target.value)} placeholder="인재경영팀" /></Field>
        <Field label="경품 담당자"><input value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="윤도현" /></Field>
      </div>
      <Field label="수령 안내 문구"><textarea rows={2} value={f.prizeNote} onChange={(e) => set("prizeNote", e.target.value)} /></Field>
      <div className="ad-checks">
        <label><input type="checkbox" checked={f.rosterRequired} onChange={(e) => set("rosterRequired", e.target.checked)} /> 명단 검증 사용 (등록된 사번만 입장)</label>
        <label><input type="checkbox" checked={f.unlimitedDraws} onChange={(e) => set("unlimitedDraws", e.target.checked)} /> 무한 뽑기 (개발/테스트용 — 하루1회 해제 + 재고 무시)</label>
      </div>
      <button className="ad-btn primary" onClick={save} disabled={saving}>{saving ? "저장 중…" : "이벤트 설정 저장"}</button>
    </section>
  );
}

/* ───────── 등급/확률/재고 ───────── */
function GradeSection({ grades, cardCounts, onSaved }) {
  const totalW = grades.reduce((s, g) => s + (Number(g.weight) || 0), 0);
  return (
    <section className="ad-card">
      <h2 className="ad-h2">🏆 등급 · 확률 · 재고</h2>
      <p className="ad-note">가중치 합 = {totalW}. 각 등급 확률 = 가중치 ÷ 합. 재고는 등급별 총 당첨 수(비우면 무제한).</p>
      <div className="ad-grade-list">
        {grades.map((g) => (
          <GradeRow key={g.id} grade={g} totalW={totalW} cardCount={cardCounts[g.id] || 0} onSaved={onSaved} />
        ))}
      </div>
    </section>
  );
}

function GradeRow({ grade, totalW, cardCount, onSaved }) {
  const [f, setF] = useState({
    name: grade.name || "",
    weight: grade.weight ?? 0,
    inventoryTotal: grade.inventoryTotal == null ? "" : grade.inventoryTotal,
    prize: grade.prize || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const odds = totalW > 0 ? ((Number(f.weight) || 0) / totalW * 100) : 0;

  const save = async () => {
    setSaving(true);
    try {
      await adminUpdate(MASTER_KEY, "grade", { id: grade.id, ...f, inventoryTotal: f.inventoryTotal === "" ? null : f.inventoryTotal });
      onSaved(`${grade.label} 저장됨`);
    } catch (e) { onSaved("저장 실패: " + (e?.message || "")); }
    finally { setSaving(false); }
  };

  return (
    <div className="ad-grade-row">
      <div className="ad-grade-tag">{grade.label}</div>
      <div className="ad-grade-fields">
        <Field label="등급명"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="가중치"><input type="number" min="0" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
        <Field label={`확률 (자동)`}><input value={`${Math.round(odds * 100) / 100}%`} disabled /></Field>
        <Field label={`재고 (카드 ${cardCount}장)`}><input type="number" min="0" placeholder="무제한" value={f.inventoryTotal} onChange={(e) => set("inventoryTotal", e.target.value)} /></Field>
        <Field label="당첨 상품"><input value={f.prize} onChange={(e) => set("prize", e.target.value)} /></Field>
      </div>
      <button className="ad-btn small" onClick={save} disabled={saving}>{saving ? "…" : "저장"}</button>
    </div>
  );
}

/* ───────── 응원 팀 ───────── */
function TeamSection({ teams, onSaved }) {
  const [adding, setAdding] = useState({ name: "", emoji: "⚽" });
  const [savingNew, setSavingNew] = useState(false);

  const addTeam = async () => {
    if (!adding.name.trim()) return;
    setSavingNew(true);
    const id = "t" + Date.now();
    try {
      await adminUpdate(MASTER_KEY, "teamUpsert", { id, name: adding.name, emoji: adding.emoji, order: (teams.length + 1) });
      setAdding({ name: "", emoji: "⚽" });
      onSaved("팀 추가됨");
    } catch (e) { onSaved("추가 실패: " + (e?.message || "")); }
    finally { setSavingNew(false); }
  };

  return (
    <section className="ad-card">
      <h2 className="ad-h2">📣 응원 팀 ({teams.length})</h2>
      <div className="ad-team-list">
        {teams.map((t) => <TeamRow key={t.id} team={t} onSaved={onSaved} />)}
      </div>
      <div className="ad-team-add">
        <input className="ad-emoji-in" value={adding.emoji} onChange={(e) => setAdding((p) => ({ ...p, emoji: e.target.value }))} maxLength={4} />
        <input placeholder="새 팀 이름" value={adding.name} onChange={(e) => setAdding((p) => ({ ...p, name: e.target.value }))} />
        <button className="ad-btn small" onClick={addTeam} disabled={savingNew}>+ 추가</button>
      </div>
    </section>
  );
}

function TeamRow({ team, onSaved }) {
  const [f, setF] = useState({ name: team.name || "", emoji: team.emoji || "⚽", order: team.order || 0 });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try { await adminUpdate(MASTER_KEY, "teamUpsert", { id: team.id, ...f }); onSaved("팀 저장됨"); }
    catch (e) { onSaved("저장 실패: " + (e?.message || "")); }
    finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm(`'${team.name}' 팀을 삭제할까요?`)) return;
    setBusy(true);
    try { await adminUpdate(MASTER_KEY, "teamDelete", { id: team.id }); onSaved("팀 삭제됨"); }
    catch (e) { onSaved("삭제 실패: " + (e?.message || "")); }
    finally { setBusy(false); }
  };

  return (
    <div className="ad-team-row">
      <input className="ad-emoji-in" value={f.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={4} />
      <input className="ad-team-name" value={f.name} onChange={(e) => set("name", e.target.value)} />
      <input className="ad-order-in" type="number" value={f.order} onChange={(e) => set("order", e.target.value)} title="정렬 순서" />
      <button className="ad-btn small" onClick={save} disabled={busy}>저장</button>
      <button className="ad-btn small danger" onClick={del} disabled={busy}>삭제</button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="ad-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
