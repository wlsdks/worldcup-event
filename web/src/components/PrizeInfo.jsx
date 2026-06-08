import { motion } from "framer-motion";

function rankClass(rank) {
  return ["special", "holo", "gold", "silver", "bronze", "basic"][rank] || "basic";
}

/** 당첨 상품 안내 모달 */
export default function PrizeInfo({ grades, config, onClose }) {
  const team = config?.contactTeam || "인재경영팀";
  const person = config?.contactPerson || "윤도현";
  const how = config?.contactHow || "DM 또는 직접 방문";

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
            <span className="modal-kicker">PRIZES</span>
            <h3>당첨 상품 안내</h3>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="prize-list">
          {grades.map((g) => (
            <div key={g.id} className={`prize-row ${rankClass(g.rank)}`}>
              <span className="prize-badge">{g.label}</span>
              <div className="prize-text">
                <div className="prize-name">{g.name}</div>
                <div className="prize-desc">{g.prize || "-"}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="prize-contact">
          <span className="prize-contact-kicker">NOTICE</span>
          <div className="prize-notice">
            <div className="pn-block">
              <div className="pn-head">🏆 1~4등 당첨자</div>
              <div className="pn-body">{team} {person}님께 {how}하여 경품 수령</div>
            </div>
            <div className="pn-block">
              <div className="pn-head">⚽ 5등 당첨자</div>
              <div className="pn-body">각 호실에 비치된 축구공 초콜릿 하나씩!</div>
              <div className="pn-sub">(호실별 위치는 오픈톡 공지에 안내)</div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
