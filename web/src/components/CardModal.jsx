import { motion } from "framer-motion";
import { rcOf, useTilt } from "../lib/cardUtils";
import { FrameSparkles } from "./PackReveal.jsx";

/**
 * 뽑은 카드 확대 보기 — 가운데 크게 + 뒤 딤 처리.
 * card: { cardImage, cardName, gradeLabel, gradeName, gradeRank }
 */
export default function CardModal({ card, onClose }) {
  const tilt = useTilt();
  if (!card) return null;
  const rc = rcOf(card.gradeRank);
  const isPrize = card.gradeRank <= 3;

  return (
    <motion.div
      className={`card-modal-overlay ${rc}`}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="card-modal-inner"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.82, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <div
          ref={tilt.ref}
          className={`tilt-layer lg modal-card ${rc}`}
          onPointerMove={tilt.onMove}
          onPointerLeave={tilt.onLeave}
        >
          <div className="flip-layer flipped">
            <div className={`face face-front ${rc}`}>
              <img src={`/cards/${card.cardImage}`} alt={card.cardName} draggable={false} />
              {isPrize && <div className="holo-fx" />}
              {isPrize && <div className="foil-sweep" />}
              {card.gradeRank <= 1 && <FrameSparkles />}
            </div>
          </div>
        </div>

        <div className={`card-modal-label ${rc}`}>
          <b>{card.gradeLabel} · {card.gradeName}</b>
          {card.cardName && card.cardName !== card.gradeName && (
            <span className="cm-cardname">{card.cardName}</span>
          )}
        </div>

        {(card.desc || card.cardDesc) && (
          <div className={`card-modal-desc ${rc}`}>
            <span className="cmd-title">카드 설명</span>
            <p>{card.desc || card.cardDesc}</p>
          </div>
        )}

        <button className="btn-ghost slim card-modal-close" onClick={onClose}>닫기</button>
      </motion.div>
    </motion.div>
  );
}
