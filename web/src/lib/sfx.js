/**
 * 경량 효과음 (WebAudio 합성 — 오디오 파일 불필요).
 * 팩 개봉/카드 공개 시 등급에 따라 사운드가 화려해진다.
 * 모든 호출은 try/catch 로 감싸 실패해도 앱에 영향 없음. 음소거는 localStorage 에 저장.
 */
const MUTE_KEY = "gonom_muted";
let ctx = null;
let muted = (() => {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
})();

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* noop */ }
  return muted;
}

function ac() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

/** 단음 (오실레이터) */
function tone(freq, startAt, dur, { type = "sine", gain = 0.18 } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 노이즈 버스트 (종이 찢김) */
function noise(dur = 0.18, gain = 0.16) {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n); // 감쇠
  const src = c.createBufferSource(); src.buffer = buf;
  const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(hp).connect(g).connect(c.destination);
  src.start();
}

/** 팩 개봉(찢기) */
export function playRip() {
  if (muted) return;
  try { noise(0.2, 0.18); tone(180, 0.02, 0.12, { type: "triangle", gain: 0.12 }); } catch { /* noop */ }
}

// 등급별 코드(낮은 등급은 단순, 높은 등급은 화려). rank: 0=SP … 5=일반, 99=꽝
const CHORDS = {
  0: [523, 659, 784, 1047, 1319], // SP — 5음 아르페지오
  1: [523, 659, 784, 1047],       // 1등
  2: [523, 659, 784],             // 2등
  3: [523, 784],                  // 3등
  4: [587],                       // 4등
  5: [523],                       // 5등
};

/** 카드 공개음 (등급에 비례) */
export function playReveal(rank) {
  if (muted) return;
  try {
    const notes = CHORDS[rank] || [440];
    const isBig = rank <= 2;
    const step = isBig ? 0.085 : 0.0;
    notes.forEach((f, i) => {
      tone(f, i * step, isBig ? 0.5 : 0.22, {
        type: rank <= 1 ? "sawtooth" : "triangle",
        gain: rank <= 2 ? 0.14 : 0.1,
      });
    });
    // 상위 등급: 반짝이는 고음 꼬리
    if (rank <= 1) {
      tone(1568, 0.28, 0.5, { type: "sine", gain: 0.08 });
      tone(2093, 0.36, 0.5, { type: "sine", gain: 0.06 });
    }
  } catch { /* noop */ }
}

/** 꽝 — 짧고 낮은 하강음 */
export function playMiss() {
  if (muted) return;
  try { tone(330, 0, 0.18, { type: "sine", gain: 0.1 }); tone(247, 0.12, 0.22, { type: "sine", gain: 0.1 }); } catch { /* noop */ }
}
