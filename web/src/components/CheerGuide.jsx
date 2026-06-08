import { motion } from "framer-motion";

/** 응원전 안내 팝업 — 참여로 추가 카드팩 기회를 얻는 방법 안내 */
export default function CheerGuide({ onClose }) {
  return (
    <motion.div
      className="modal-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <div className="modal-head">
          <div className="modal-head-txt">
            <span className="modal-kicker">CHEER BATTLE</span>
            <h3>응원전 안내</h3>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="cheer-guide">
          <p className="cg-lead">
            팀을 응원하고 <b>카드팩 기회를 최대 2번 더</b> 받아보세요!<br />
            응원전 참여만 해도 추가 카드팩 획득 기회가 주어집니다!
          </p>

          <div className="cg-block">
            <div className="cg-head">🥇 하나되는 우리팀!</div>
            <div className="cg-body">우리 팀을 선택하고 응원의 한마디를 남겨주세요!</div>
            <div className="cg-reward">응원글 작성 시 카드팩 뽑기 기회 <b>1회 추가 지급!</b></div>
            <div className="cg-sub">팀원들과 함께 우리 팀의 사기를 올려보세요!</div>
          </div>

          <div className="cg-block">
            <div className="cg-head">❤️ 좋아요 탕탕탕!</div>
            <div className="cg-body">마음에 드는 응원글에 좋아요를 남겨주세요.</div>
            <div className="cg-reward">좋아요 3회 누르기 완료 시 카드팩 뽑기 기회 <b>1회 추가 지급!</b></div>
            <div className="cg-sub">우리 팀뿐만 아니라 다른 팀의 멋진 응원글에도 아낌없는 응원을 보내주세요!</div>
          </div>

          <div className="cg-prizes">
            <div className="cg-prizes-title">🏅 마감 시점 좋아요 상위 3개 팀</div>
            <div className="cg-prize-row"><span className="cg-rank">1위</span> 배달의민족 상품권 5만원</div>
            <div className="cg-prize-row"><span className="cg-rank">2위</span> 배달의민족 상품권 3만원</div>
            <div className="cg-prize-row"><span className="cg-rank">3위</span> 배달의민족 상품권 2만원</div>
          </div>
        </div>

        <button className="btn-primary cg-confirm" onClick={onClose}>응원하러 가기</button>
      </motion.div>
    </motion.div>
  );
}
