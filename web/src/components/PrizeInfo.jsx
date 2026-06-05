import { motion } from "framer-motion";

function rankClass(rank) {
  return ["special", "holo", "gold", "silver", "bronze", "basic"][rank] || "basic";
}

/** 당첨 상품 안내 모달 */
export default function PrizeInfo({ grades, config, onClose }) {
  const team = config?.contactTeam || "인재경영팀";
  const person = config?.contactPerson || "윤도현";
  const how = config?.contactHow || "DM 또는 직접 방문";
  const note =
    config?.prizeNote ||
    `1~3등 당첨자는 ${team} ${person}님께 ${how}하여 경품을 수령하세요.`;

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
          <h3>🎁 당첨 상품 안내</h3>
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
          <span className="prize-contact-ic">📣</span>
          <span>{note}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
