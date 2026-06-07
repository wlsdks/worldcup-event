import { useState } from "react";
import { Link } from "react-router-dom";
import { adminLoad, adminUpdate, adminAction } from "../api";
import "./admin.css";

const MASTER_KEY = "demo-master";
const NAV = [
  { id: "dash", icon: "▦", label: "대시보드" },
  { id: "winners", icon: "◆", label: "당첨자" },
  { id: "settings", icon: "▤", label: "설정" },
  { id: "tools", icon: "◈", label: "운영 도구" },
];

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dash");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };
  const reload = async () => { try { setData(await adminLoad(MASTER_KEY)); } catch { /* noop */ } };

  const login = async () => {
    setLoading(true);
    try { setData(await adminLoad(MASTER_KEY)); setAuthed(true); }
    catch (e) { flash("입장 실패: " + (e?.message || "")); }
    finally { setLoading(false); }
  };

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div className="al-badge">ADMIN CONSOLE</div>
          <h1>고놈 월드컵 이벤트</h1>
          <p className="admin-sub">실시간 통계 · 당첨자 · 설정 · 운영 관리</p>
          <button className="ad-btn primary block" onClick={login} disabled={loading}>
            {loading ? "입장 중…" : "데모 마스터 로그인"}
          </button>
          <Link to="/" className="admin-back-link">← 이벤트 화면으로</Link>
        </div>
        {toast && <div className="admin-toast">{toast}</div>}
      </div>
    );
  }

  const onSaved = (m) => { flash(m); reload(); };

  return (
    <div className="admin-shell">
      <aside className={`admin-nav ${navOpen ? "open" : ""}`}>
        <div className="admin-brand">⚽ <span>고놈 Admin</span></div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "on" : ""}`} onClick={() => { setTab(n.id); setNavOpen(false); }}>
              <span className="nav-ic">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <Link to="/" className="nav-item nav-foot">← 이벤트 화면</Link>
      </aside>

      <div className="admin-body">
        <header className="admin-bar">
          <button className="nav-toggle" onClick={() => setNavOpen((v) => !v)}>☰</button>
          <div className="admin-bar-title">{NAV.find((n) => n.id === tab)?.label}</div>
          <button className="ad-btn ghost small" onClick={reload}>↻ 새로고침</button>
        </header>

        <main className="admin-main">
          {tab === "dash" && <Dashboard data={data} />}
          {tab === "winners" && <WinnersView data={data} onDone={onSaved} />}
          {tab === "settings" && <SettingsView data={data} onSaved={onSaved} />}
          {tab === "tools" && <ToolsSection grades={data.grades} roster={data.roster || []} onDone={onSaved} />}
        </main>
      </div>

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}

/* ───────── 대시보드 ───────── */
function Dashboard({ data }) {
  const s = data.stats || {};
  const gs = data.gradeStatus || [];
  const limited = gs.filter((g) => !g.unlimited);
  const remainingTotal = limited.reduce((a, g) => a + (g.inventoryRemaining || 0), 0);
  const issues = [];
  if (!data.config?.startDate || !data.config?.endDate) issues.push("이벤트 기간이 설정되지 않았습니다.");
  if ((data.config?.active) !== true) issues.push("이벤트가 비활성(active=false) 상태입니다.");
  if (s.rosterCount === 0) issues.push("참여자 명단이 비어 있습니다.");
  if (data.config?.unlimitedDraws === true) issues.push("무한 뽑기(테스트 모드)가 켜져 있습니다.");

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="이벤트 참여율" value={`${s.participationRate ?? 0}%`} sub={`${s.participantCount ?? 0} / ${s.rosterCount ?? 0}명`} accent="green" />
        <Kpi label="참여자 수" value={s.participantCount ?? 0} sub="실제 뽑은 인원(선물 제외)" />
        <Kpi label="총 뽑기 수" value={s.drawCount ?? 0} sub={s.giftCount ? `실제 뽑기 · 선물/추첨 ${s.giftCount}건 별도` : "실제 뽑기"} />
        <Kpi label="남은 경품" value={remainingTotal} sub="미당첨 한정 재고" accent={remainingTotal > 0 ? "amber" : "green"} />
      </div>

      <section className="ad-card">
        <h2 className="ad-h2">등급별 현황</h2>
        <div className="gstat-list">
          {gs.map((g) => {
            const total = g.inventoryTotal;
            const remain = g.inventoryRemaining;
            const pct = (!g.unlimited && total) ? Math.round(((total - (remain || 0)) / total) * 100) : 0;
            return (
              <div key={g.id} className="gstat-row">
                <div className={`gstat-tag r${g.rank}`}>{g.label}</div>
                <div className="gstat-name">{g.name}</div>
                <div className="gstat-bar"><div className="gstat-fill" style={{ width: `${g.unlimited ? 0 : pct}%` }} /></div>
                <div className="gstat-num">
                  {g.unlimited ? <span className="muted">무제한 · 당첨 {g.awarded}</span>
                    : <span><b>{total - (remain || 0)}</b> / {total} 당첨 {remain > 0 && <em className="warn">· {remain} 남음</em>}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ad-card">
        <h2 className="ad-h2">시간대별 참여 추이</h2>
        <p className="ad-note">KST 기준 실제 뽑기 시간대 분포 (선물/추첨 제외)</p>
        <TrendChart hourly={s.hourly || []} />
      </section>

      <section className="ad-card">
        <h2 className="ad-h2">상태 점검</h2>
        {issues.length === 0
          ? <div className="health ok">✓ 발견된 문제가 없습니다. 정상 운영 중입니다.</div>
          : <ul className="health-list">{issues.map((m, i) => <li key={i} className="health warn">⚠ {m}</li>)}</ul>}
      </section>
    </>
  );
}

function TrendChart({ hourly }) {
  const data = hourly.length === 24 ? hourly : Array(24).fill(0);
  const max = Math.max(1, ...data);
  const total = data.reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="health ok" style={{ marginTop: 2 }}>아직 참여 데이터가 없습니다.</div>;
  return (
    <div className="trend">
      <div className="trend-chart">
        {data.map((c, h) => (
          <div key={h} className="trend-col" title={`${h}시 · ${c}건`}>
            <div className="trend-bar" style={{ height: `${Math.max(c > 0 ? 6 : 0, (c / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="trend-axis">
        {[0, 6, 12, 18, 23].map((h) => <span key={h} style={{ left: `${(h / 23) * 100}%` }}>{h}시</span>)}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className={`kpi ${accent || ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

/* ───────── 당첨자 ───────── */
function WinnersView({ data, onDone }) {
  const [busy, setBusy] = useState(false);
  const winners = data.winners || [];
  const fill = async () => {
    if (!confirm("미당첨 등급의 남은 재고를 명단에서 랜덤 추첨하여 당첨자를 만듭니다.\n진행할까요?")) return;
    setBusy(true);
    try { const r = await adminAction(MASTER_KEY, "fillWinners", {}); onDone(r?.message || "완료"); }
    catch (e) { onDone("실패: " + (e?.message || "")); }
    finally { setBusy(false); }
  };

  const remaining = (data.gradeStatus || []).filter((g) => !g.unlimited).reduce((a, g) => a + (g.inventoryRemaining || 0), 0);

  return (
    <>
      <section className="ad-card">
        <div className="winners-head">
          <div>
            <h2 className="ad-h2">경품 당첨자 ({winners.length}명)</h2>
            <p className="ad-note">스페셜·전설~레어(경품 대상)만 표시. 일반(5등) {data.stats?.commonCount ?? 0}장 배출은 제외. 미당첨 한정 경품 {remaining}개.</p>
          </div>
          <button className="ad-btn primary" onClick={fill} disabled={busy || remaining === 0}>
            {busy ? "추첨 중…" : `🎲 랜덤 추첨 (${remaining})`}
          </button>
        </div>

        {winners.length === 0 ? (
          <div className="health ok" style={{ marginTop: 8 }}>아직 당첨자가 없습니다.</div>
        ) : (
          <table className="winners-table">
            <thead><tr><th>등급</th><th>이름</th><th>사번</th><th>상품</th><th>구분</th></tr></thead>
            <tbody>
              {winners.map((w, i) => (
                <tr key={i}>
                  <td><span className={`gstat-tag r${w.gradeRank}`}>{w.gradeLabel}</span> {w.gradeName}</td>
                  <td><b>{w.name}</b></td>
                  <td className="muted">{w.empNo}</td>
                  <td>{w.prize}</td>
                  <td>{w.gift ? <span className="chip gift">선물/추첨</span> : <span className="chip">뽑기</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ───────── 설정(서브탭: 이벤트 / 등급 / 팀) ───────── */
function SettingsView({ data, onSaved }) {
  const [sub, setSub] = useState("event");
  const SUBS = [{ id: "event", label: "이벤트" }, { id: "grades", label: "등급·확률·재고" }, { id: "teams", label: "응원 팀" }];
  return (
    <>
      <div className="sub-tabs">
        {SUBS.map((s) => (
          <button key={s.id} className={`sub-tab ${sub === s.id ? "on" : ""}`} onClick={() => setSub(s.id)}>{s.label}</button>
        ))}
      </div>
      {sub === "event" && <EventSection config={data.config} onSaved={onSaved} />}
      {sub === "grades" && <GradeSection grades={data.grades} cardCounts={data.cardCounts} onSaved={onSaved} />}
      {sub === "teams" && <TeamSection teams={data.teams} onSaved={onSaved} />}
    </>
  );
}

/* 명단 검색 선택기 (400명 대응 — 입력 검색 + 자동완성, 미존재 사번 방지) */
function RosterPicker({ roster, value, onChange, placeholder }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const selected = roster.find((r) => r.empNo === value);
  const needle = q.trim();
  const filtered = (needle ? roster.filter((r) => r.empNo.includes(needle) || (r.name || "").includes(needle)) : roster).slice(0, 40);
  return (
    <div className="rp-wrap">
      <input
        className="rp-input"
        placeholder={placeholder || "사번 또는 이름 검색"}
        value={open ? q : (selected ? `${selected.name} (${selected.empNo})` : "")}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (
        <div className="rp-list">
          {filtered.length === 0 && <div className="rp-empty">검색 결과 없음</div>}
          {filtered.map((r) => (
            <button type="button" key={r.empNo} className={`rp-item ${r.empNo === value ? "on" : ""}`}
              onMouseDown={() => { onChange(r.empNo); setOpen(false); }}>
              <b>{r.name || "(이름없음)"}</b><span>{r.empNo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── 이벤트 설정 ───────── */
function EventSection({ config, onSaved }) {
  const [f, setF] = useState({
    eventName: config.eventName || "",
    active: config.active === true,
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
      <h2 className="ad-h2">이벤트 설정</h2>
      <div className={`event-switch ${f.active ? "on" : "off"}`}>
        <div><b>이벤트 {f.active ? "진행 중" : "중지됨"}</b><span>꺼지면 사용자가 뽑을 수 없습니다.</span></div>
        <label className="switch"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /><span className="track" /></label>
      </div>
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
        <label><input type="checkbox" checked={f.unlimitedDraws} onChange={(e) => set("unlimitedDraws", e.target.checked)} /> 무한 뽑기 (개발/테스트용)</label>
      </div>
      <button className="ad-btn primary" onClick={save} disabled={saving}>{saving ? "저장 중…" : "이벤트 설정 저장"}</button>
    </section>
  );
}

/* ───────── 등급 ───────── */
function GradeSection({ grades, cardCounts, onSaved }) {
  const totalW = grades.reduce((s, g) => s + (Number(g.weight) || 0), 0);
  return (
    <section className="ad-card">
      <h2 className="ad-h2">등급 · 확률 · 재고</h2>
      <p className="ad-note">가중치 합 = {totalW}. 확률 = 가중치 ÷ 합. 재고는 등급별 총 당첨 수(비우면 무제한).</p>
      <div className="ad-grade-list">
        {grades.map((g) => <GradeRow key={g.id} grade={g} totalW={totalW} cardCount={cardCounts[g.id] || 0} onSaved={onSaved} />)}
      </div>
    </section>
  );
}
function GradeRow({ grade, totalW, cardCount, onSaved }) {
  const [f, setF] = useState({ name: grade.name || "", weight: grade.weight ?? 0, inventoryTotal: grade.inventoryTotal == null ? "" : grade.inventoryTotal, prize: grade.prize || "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const odds = totalW > 0 ? ((Number(f.weight) || 0) / totalW * 100) : 0;
  const save = async () => {
    setSaving(true);
    try { await adminUpdate(MASTER_KEY, "grade", { id: grade.id, ...f, inventoryTotal: f.inventoryTotal === "" ? null : f.inventoryTotal }); onSaved(`${grade.label} 저장됨`); }
    catch (e) { onSaved("저장 실패: " + (e?.message || "")); }
    finally { setSaving(false); }
  };
  return (
    <div className="ad-grade-row">
      <div className={`ad-grade-tag r${grade.rank}`}>{grade.label}</div>
      <div className="ad-grade-fields">
        <Field label="등급명"><input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="가중치"><input type="number" min="0" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
        <Field label="확률 (자동)"><input value={`${Math.round(odds * 100) / 100}%`} disabled /></Field>
        <Field label={`재고 (카드 ${cardCount}장)`}><input type="number" min="0" placeholder="무제한" value={f.inventoryTotal} onChange={(e) => set("inventoryTotal", e.target.value)} /></Field>
        <Field label="당첨 상품"><input value={f.prize} onChange={(e) => set("prize", e.target.value)} /></Field>
      </div>
      <button className="ad-btn small" onClick={save} disabled={saving}>{saving ? "…" : "저장"}</button>
    </div>
  );
}

/* ───────── 팀 ───────── */
function TeamSection({ teams, onSaved }) {
  const [adding, setAdding] = useState({ name: "", emoji: "⚽" });
  const [savingNew, setSavingNew] = useState(false);
  const addTeam = async () => {
    if (!adding.name.trim()) return;
    setSavingNew(true);
    try { await adminUpdate(MASTER_KEY, "teamUpsert", { id: "t" + Date.now(), name: adding.name, emoji: adding.emoji, order: teams.length + 1 }); setAdding({ name: "", emoji: "⚽" }); onSaved("팀 추가됨"); }
    catch (e) { onSaved("추가 실패: " + (e?.message || "")); }
    finally { setSavingNew(false); }
  };
  return (
    <section className="ad-card">
      <h2 className="ad-h2">응원 팀 ({teams.length})</h2>
      <div className="ad-team-list">{teams.map((t) => <TeamRow key={t.id} team={t} onSaved={onSaved} />)}</div>
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
  const save = async () => { setBusy(true); try { await adminUpdate(MASTER_KEY, "teamUpsert", { id: team.id, ...f }); onSaved("팀 저장됨"); } catch (e) { onSaved("저장 실패: " + (e?.message || "")); } finally { setBusy(false); } };
  const del = async () => { if (!confirm(`'${team.name}' 팀을 삭제할까요?`)) return; setBusy(true); try { await adminUpdate(MASTER_KEY, "teamDelete", { id: team.id }); onSaved("팀 삭제됨"); } catch (e) { onSaved("삭제 실패: " + (e?.message || "")); } finally { setBusy(false); } };
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

/* ───────── 운영 도구 ───────── */
function ToolsSection({ grades, roster, onDone }) {
  const [busy, setBusy] = useState("");
  const [grantTarget, setGrantTarget] = useState("all");
  const [grantEmp, setGrantEmp] = useState("");
  const [grantCount, setGrantCount] = useState(1);
  const [giftEmp, setGiftEmp] = useState("");
  const [giftGrade, setGiftGrade] = useState(grades[0]?.id || "");
  const run = async (key, action, data, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(key);
    try { const r = await adminAction(MASTER_KEY, action, data); onDone(r?.message || "완료"); }
    catch (e) { onDone("실패: " + (e?.message || "")); }
    finally { setBusy(""); }
  };
  return (
    <section className="ad-card">
      <h2 className="ad-h2">운영 도구</h2>
      <div className="ad-tool">
        <div className="ad-tool-head"><b>이벤트 초기화</b><span>모든 뽑기 기록 삭제 · 등급 재고 복원 · 유저 상태 리셋</span></div>
        <button className="ad-btn danger" disabled={busy === "reset"} onClick={() => run("reset", "resetEvent", {}, "정말 이벤트를 초기화할까요?\n모든 뽑기 기록이 삭제되고 재고가 복원됩니다. 되돌릴 수 없습니다.")}>{busy === "reset" ? "초기화 중…" : "이벤트 초기화"}</button>
      </div>
      <div className="ad-tool">
        <div className="ad-tool-head"><b>추가 뽑기 지급</b><span>오늘 이미 뽑은 사람도 추가로 뽑을 수 있게 보너스 지급</span></div>
        <div className="ad-tool-row">
          <select value={grantTarget} onChange={(e) => setGrantTarget(e.target.value)}>
            <option value="all">전 인원(명단 전체)</option>
            <option value="one">특정 인원(사번)</option>
          </select>
          {grantTarget === "one" && <RosterPicker roster={roster} value={grantEmp} onChange={setGrantEmp} />}
          <input type="number" min="1" value={grantCount} onChange={(e) => setGrantCount(e.target.value)} style={{ width: 80 }} />
          <span className="ad-tool-unit">회</span>
          <button className="ad-btn primary" disabled={busy === "grant"} onClick={() => run("grant", "grantDraws", { target: grantTarget === "all" ? "all" : grantEmp, count: grantCount }, grantTarget === "all" ? `전 인원에게 추가 뽑기 ${grantCount}회를 지급할까요?` : null)}>{busy === "grant" ? "지급 중…" : "지급"}</button>
        </div>
      </div>
      <div className="ad-tool">
        <div className="ad-tool-head"><b>카드 선물 (특정 인원)</b><span>지정 사번에게 선택 등급의 카드 1장을 도감에 바로 선물</span></div>
        <div className="ad-tool-row">
          <RosterPicker roster={roster} value={giftEmp} onChange={setGiftEmp} />
          <select value={giftGrade} onChange={(e) => setGiftGrade(e.target.value)}>{grades.map((g) => <option key={g.id} value={g.id}>{g.label} · {g.name}</option>)}</select>
          <button className="ad-btn primary" disabled={busy === "gift" || !giftEmp} onClick={() => run("gift", "giftCard", { empNo: giftEmp, gradeId: giftGrade })}>{busy === "gift" ? "선물 중…" : "선물하기"}</button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return <label className="ad-field"><span>{label}</span>{children}</label>;
}
