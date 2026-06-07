// 기기 기울기(자이로) 공유 스토어 — 3D 카드가 매 프레임 읽어 회전에 반영.
// iOS 13+ 는 사용자 제스처에서 권한 요청 필요. 데스크톱/미지원은 active=false 로 폴백.
export const gyro = { x: 0, y: 0, active: false };

let attached = false;
function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener("deviceorientation", (e) => {
    if (e.gamma == null && e.beta == null) return;
    gyro.active = true;
    gyro.x = Math.max(-1, Math.min(1, (e.gamma || 0) / 38));        // 좌우
    gyro.y = Math.max(-1, Math.min(1, ((e.beta || 0) - 42) / 38));  // 앞뒤(파지 기준)
  });
}

/** 사용자 제스처에서 호출 — iOS 권한 요청 후 자이로 활성화 */
export function enableGyro() {
  const DOE = typeof window !== "undefined" && window.DeviceOrientationEvent;
  if (!DOE) return;
  try {
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then((r) => { if (r === "granted") attach(); }).catch(() => {});
    } else {
      attach();
    }
  } catch { /* 무시 */ }
}
