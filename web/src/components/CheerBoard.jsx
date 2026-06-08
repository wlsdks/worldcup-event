import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getCheers, postCheer, likeCheer } from "../api";
import CheerGuide from "./CheerGuide.jsx";

export default function CheerBoard({ user, teams = [], onBack }) {
  const [cheers, setCheers] = useState([]);
  const [liked, setLiked] = useState(() => new Set());
  const [likesUsed, setLikesUsed] = useState(0);
  const [likesMax, setLikesMax] = useState(3);

  const [team, setTeam] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const [confirmId, setConfirmId] = useState(null); // 좋아요 확인 팝업 대상
  const [liking, setLiking] = useState(false);
  const [toast, setToast] = useState(null);
  const [posted, setPosted] = useState(false); // 이미 응원글 작성함(1인 1회)
  const [showGuide, setShowGuide] = useState(false);
  const seenRef = useRef(null);

  // 응원전 진입 시 안내 팝업 항상 자동 표시
  useEffect(() => { setShowGuide(true); }, []);

  const load = useCallback(async () => {
    try {
      const d = await getCheers(user?.empNo);
      const list = d.cheers || [];
      // 첫 로드 이후 새 응원 → 토스트
      if (seenRef.current) {
        const fresh = list.filter((c) => !seenRef.current.has(c.id));
        if (fresh.length) {
          const t = fresh.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
          setToast({ key: Date.now(), name: t.name, team: t.team, message: t.message });
        }
      }
      seenRef.current = new Set(list.map((c) => c.id));
      setCheers(list);
      setLiked(new Set(d.likedIds || []));
      setLikesUsed(d.likesUsed || 0);
      setLikesMax(d.likesMax || 3);
      setPosted(!!d.posted);
    } catch { /* 무시 */ }
  }, [user]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 8000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  const now = Date.now();

  const remaining = Math.max(0, likesMax - likesUsed);

  const submit = async (e) => {
    e.preventDefault();
    if (!team.trim() || !name.trim() || !message.trim()) {
      setErr("팀 · 이름 · 응원 한마디를 모두 입력해 주세요.");
      return;
    }
    setErr("");
    setNotice("");
    setPosting(true);
    try {
      const res = await postCheer({ empNo: user.empNo, team: team.trim(), name: name.trim(), message: message.trim() });
      setMessage("");
      await load();
      setNotice(res?.bonusGranted
        ? "응원 등록 완료! 카드팩 뽑기 기회를 1회 더 얻었어요 — 홈에서 한 번 더 뽑아보세요."
        : "응원이 등록되었어요. 고마워요!");
    } catch (e2) {
      setErr(e2?.message?.replace(/^.*?\/\s*/, "") || "응원 등록에 실패했어요.");
    } finally {
      setPosting(false);
    }
  };

  const confirmLike = async () => {
    if (!confirmId) return;
    const cheerId = confirmId;
    // 낙관적 업데이트: 팝업 즉시 닫고 화면에 좋아요 바로 반영 → 서버 응답은 뒤에서 반영
    setConfirmId(null);
    setErr("");
    setLiked((prev) => new Set(prev).add(cheerId));
    setLikesUsed((u) => u + 1);
    setCheers((prev) => prev.map((c) => (c.id === cheerId ? { ...c, likes: (c.likes || 0) + 1 } : c)));
    try {
      const res = await likeCheer({ empNo: user.empNo, cheerId });
      if (res?.likeBonusGranted) {
        setNotice("좋아요 3회 완료! 카드팩 뽑기 기회를 1회 더 얻었어요 — 홈에서 뽑아보세요.");
      }
      await load(); // 서버 정답으로 정렬·수치 재동기화
    } catch (e2) {
      setErr(e2?.message?.replace(/^.*?\/\s*/, "") || "좋아요에 실패했어요.");
      await load(); // 실패 시 낙관적 변경 롤백(서버 상태로 복구)
    }
  };

  return (
    <div className="screen cheer">
      <header className="coll-top">
        <button className="link-btn" onClick={onBack}>← 뒤로</button>
        <h2>응원전</h2>
        <span className="like-pill">남은 좋아요 {likesMax - likesUsed}</span>
      </header>

      <div className="cheer-intro">
        <div className="cheer-intro-kicker">CHEER BATTLE</div>
        <h3 className="cheer-intro-title">🏆 우리 팀을 우승으로 이끌어 주세요!</h3>
        <p className="cheer-intro-desc">
          좋아요를 많이 받을수록 우리 팀의 순위가 올라갑니다.<br />
          팀원들과 함께 응원에 참여해 배달의민족 상품권의 주인공이 되어보세요!
        </p>
        <button type="button" className="cheer-guide-btn" onClick={() => setShowGuide(true)}>
          ⓘ 응원전 안내 · 추가 기회 받는 법
        </button>
      </div>

      {notice && <div className="form-notice cheer-notice">{notice}</div>}

      {posted ? (
        <div className="cheer-done">
          <div className="cheer-done-title">응원글을 작성했어요</div>
          <div className="cheer-done-sub">한 분당 1회만 작성할 수 있어요. 이제 마음에 드는 응원글에 <b>좋아요(3회)</b>를 눌러 카드팩 기회를 한 번 더 받아보세요!</div>
        </div>
      ) : (
      <form className="cheer-composer" onSubmit={submit}>
        <div className="team-pick-label">응원할 팀을 선택하세요</div>
        <select
          className="cheer-in team-select"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        >
          <option value="" disabled>팀을 선택하세요</option>
          {teams.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <input
          className="cheer-in"
          placeholder="작성자 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
        />
        <div className="cheer-input-row">
          <input
            className="cheer-in"
            placeholder="응원 한마디 (예: 우리 팀 화이팅!)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={100}
          />
          <button type="submit" className="btn-primary" disabled={posting}>
            {posting ? "등록 중…" : "응원 등록"}
          </button>
        </div>
        {err && <div className="form-err">{err}</div>}
      </form>
      )}

      <div className="cheer-rank-title">실시간 응원랭킹<span>좋아요순</span></div>

      <div className="cheer-list">
        <AnimatePresence initial={false}>
          {cheers.map((c, i) => {
            const isLiked = liked.has(c.id);
            const canLike = !isLiked && remaining > 0;
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className={`cheer-item ${i < 3 ? "top" : ""} rank${i + 1} ${c.createdAt && now - c.createdAt < 600000 ? "just" : ""}`}
              >
                <div className="ci-rank">
                  <span className="ci-num">{i + 1}</span>
                </div>
                <div className="ci-body">
                  <div className="ci-head">
                    <span className="ci-team">{c.team}</span>
                    <span className="ci-name">{c.name}</span>
                  </div>
                  <div className="ci-msg">{c.message}</div>
                </div>
                <button
                  className={`like-btn ${isLiked ? "on" : ""}`}
                  onClick={() => canLike && setConfirmId(c.id)}
                  disabled={!canLike}
                  title={isLiked ? "이미 추천함" : remaining === 0 ? "추천 소진" : "추천하기"}
                >
                  <span className="lb-heart" aria-hidden>{isLiked ? "♥" : "♡"}</span>
                  <span className="lb-n">{c.likes}</span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {cheers.length === 0 && <div className="cheer-empty">아직 응원이 없어요. 첫 응원을 남겨보세요.</div>}
      </div>

      {/* 좋아요 확인 팝업 */}
      <AnimatePresence>
        {confirmId && (
          <motion.div
            className="modal-overlay"
            onClick={() => !liking && setConfirmId(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="modal confirm-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <h3>좋아요를 누르시겠습니까?</h3>
              <div className="confirm-body">
                <div className="confirm-remain">현재 남은 좋아요 횟수 : <b>{remaining}회</b></div>
                <div className="confirm-warn">좋아요는 등록 후 취소할 수 없습니다.</div>
                <div>확인하시겠습니까?</div>
              </div>
              <div className="confirm-actions">
                <button className="btn-ghost slim" onClick={() => setConfirmId(null)} disabled={liking}>취소</button>
                <button className="btn-primary" onClick={confirmLike} disabled={liking}>
                  {liking ? "처리 중…" : "확인"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className="hall-toast cheer-toast"
            initial={{ y: -44, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -44, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
          >
            <span className="ht-spark" aria-hidden>✦</span>
            <span><b>{toast.name}</b>님 응원 등록!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGuide && <CheerGuide onClose={() => setShowGuide(false)} />}
      </AnimatePresence>
    </div>
  );
}
