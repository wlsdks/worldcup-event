// 당첨 카드 + 브랜드 프레임을 Canvas에 합성해 공유/저장 (이벤트 바이럴)
const GRADE_COLOR = ["#34d8a0", "#ffce3a", "#f4c145", "#cbd5e2", "#d08b54", "#8b93a0"];

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 당첨 카드를 프레임/캡션과 함께 합성해 Web Share(가능 시) 또는 PNG 다운로드 */
export async function shareCardImage(card) {
  if (!card || card.isMiss || !card.cardImage) return false;
  const accent = GRADE_COLOR[card.gradeRank] ?? "#ffffff";
  const W = 900, H = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 배경 (다크 + 등급 글로우)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c0c0e"); bg.addColorStop(1, "#080405");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 470, 60, W / 2, 470, 560);
  glow.addColorStop(0, accent + "33"); glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // 카드
  const cardW = 600, cardH = Math.round(cardW * 802 / 566);
  const cx = (W - cardW) / 2, cy = 150;
  try {
    const img = await loadImg(`/cards/${card.cardImage}`);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 46; ctx.shadowOffsetY = 22;
    roundRect(ctx, cx, cy, cardW, cardH, 30); ctx.fillStyle = "#000"; ctx.fill();
    ctx.restore();
    ctx.save(); roundRect(ctx, cx, cy, cardW, cardH, 30); ctx.clip();
    ctx.drawImage(img, cx, cy, cardW, cardH); ctx.restore();
  } catch { /* 이미지 실패해도 프레임/텍스트는 출력 */ }
  ctx.strokeStyle = accent; ctx.lineWidth = 7;
  roundRect(ctx, cx, cy, cardW, cardH, 30); ctx.stroke();

  // 텍스트
  const baseY = cy + cardH + 78;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff8a7a"; ctx.font = "800 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("HUNET · WORLD CUP 2026", W / 2, baseY);
  ctx.fillStyle = "#ffffff"; ctx.font = "900 58px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${card.gradeName || ""} ${card.cardName || ""}`.trim(), W / 2, baseY + 64);
  if (card.gradeTotal) {
    ctx.fillStyle = accent; ctx.font = "800 30px system-ui, -apple-system, sans-serif";
    ctx.fillText(`단 ${card.gradeTotal}장 한정 · ${card.gradeOrdinal}번째 주인공`, W / 2, baseY + 116);
  }

  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  const fname = `gonom_${(card.cardName || card.gradeName || "card").replace(/\s+/g, "")}.png`;
  const file = new File([blob], fname, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "고놈 월드컵 카드뽑기", text: `${card.gradeName || ""} 당첨!` });
      return true;
    }
  } catch { /* 공유 취소/실패 → 다운로드 */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

async function shareOrDownload(canvas, fname, text) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  const file = new File([blob], fname, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "고놈 월드컵 카드뽑기", text });
      return true;
    }
  } catch { /* 다운로드 폴백 */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/** 이벤트 종료 결과(참여율 + 1~4등 주인공)를 한 장의 이미지로 합성해 공유/저장 */
export async function shareResultImage(pub) {
  if (!pub) return false;
  const W = 900, H = 1300;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1c0c0e"); bg.addColorStop(1, "#080405");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const gl = ctx.createRadialGradient(W / 2, 210, 40, W / 2, 210, 520);
  gl.addColorStop(0, "rgba(255,90,78,0.2)"); gl.addColorStop(1, "transparent");
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ff8a7a"; ctx.font = "800 30px system-ui, -apple-system, sans-serif";
  ctx.fillText("HUNET · WORLD CUP 2026", W / 2, 96);
  ctx.fillStyle = "#fff"; ctx.font = "900 62px system-ui, -apple-system, sans-serif";
  ctx.fillText("이벤트 결과", W / 2, 170);
  ctx.fillStyle = "#9aa0aa"; ctx.font = "700 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("전체 참여율", W / 2, 256);
  ctx.fillStyle = "#fff"; ctx.font = "900 98px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${pub.participationRate}%`, W / 2, 356);
  ctx.fillStyle = "#9aa0aa"; ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(`참여 ${pub.participantCount}명 / 전체 ${pub.rosterCount}명`, W / 2, 398);

  const wins = (pub.hall || []).filter((h) => h.gradeRank <= 4)
    .sort((a, b) => a.gradeRank - b.gradeRank || a.at - b.at).slice(0, 12);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ff8a7a"; ctx.font = "800 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("1~4등 주인공", 90, 474);
  let y = 502;
  wins.forEach((w) => {
    const col = GRADE_COLOR[w.gradeRank] || "#fff";
    ctx.fillStyle = "rgba(255,255,255,0.06)"; roundRect(ctx, 90, y, W - 180, 52, 12); ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = col; ctx.font = "800 22px system-ui, -apple-system, sans-serif"; ctx.fillText(w.gradeLabel, 112, y + 34);
    ctx.fillStyle = "#fff"; ctx.font = "800 24px system-ui, -apple-system, sans-serif"; ctx.fillText(w.name, 210, y + 34);
    ctx.textAlign = "right";
    ctx.fillStyle = "#b3b7c0"; ctx.font = "600 20px system-ui, -apple-system, sans-serif"; ctx.fillText(w.gradeName, W - 112, y + 34);
    y += 62;
  });

  return shareOrDownload(canvas, "gonom_result.png", `고놈 월드컵 결과 · 참여율 ${pub.participationRate}%`);
}
