import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getCheers, postCheer, likeCheer } from "../api";

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

  const [confirmId, setConfirmId] = useState(null); // 좋아요 확인 팝업 대상
  const [liking, setLiking] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getCheers(user?.empNo);
      setCheers(d.cheers || []);
      setLiked(new Set(d.likedIds || []));
      setLikesUsed(d.likesUsed || 0);
      setLikesMax(d.likesMax || 3);
    } catch { /* 무시 */ }
  }, [user]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 12000);
    return () => clearInterval(poll);
  }, [load]);

  const remaining = Math.max(0, likesMax - likesUsed);

  const submit = async (e) => {
    e.preventDefault();
    if (!team.trim() || !name.trim() || !message.trim()) {
      setErr("팀 · 이름 · 응원 한마디를 모두 입력해 주세요.");
      return;
    }
    setErr("");
    setPosting(true);
    try {
      await postCheer({ empNo: user.empNo, team: team.trim(), name: name.trim(), message: message.trim() });
      setMessage("");
      await load();
    } catch (e2) {
      setErr(e2?.message?.replace(/^.*?\/\s*/, "") || "응원 등록에 실패했어요.");
    } finally {
      setPosting(false);
    }
  };

  const confirmLike = async () => {
    if (!confirmId) return;
    setLiking(true);
    try {
      await likeCheer({ empNo: user.empNo, cheerId: confirmId });
      setConfirmId(null);
      await load();
    } catch (e2) {
      setErr(e2?.message?.replace(/^.*?\/\s*/, "") || "좋아요에 실패했어요.");
      setConfirmId(null);
    } finally {
      setLiking(false);
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
        <h3 className="cheer-intro-title">우리 팀에 힘을 보태세요</h3>
        <p className="cheer-intro-desc">
          받은 좋아요가 곧 팀의 순위입니다. 마감 시점 상위 3개 팀에 커피 상품권을 드립니다.
        </p>
      </div>

      <form className="cheer-composer" onSubmit={submit}>
        <div className="team-pick-label">응원할 팀을 선택하세요</div>
        <div className="team-chips">
          {teams.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`team-chip ${team === t.name ? "on" : ""}`}
              onClick={() => setTeam(t.name)}
            >
              {t.name}
            </button>
          ))}
        </div>
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

      <div className="cheer-rank-title">실시간 팀 랭킹<span>좋아요순</span></div>

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
                className={`cheer-item ${i < 3 ? "top" : ""} rank${i + 1}`}
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
    </div>
  );
}
