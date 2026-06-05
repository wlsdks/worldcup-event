import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const env = import.meta.env;
const USE_EMULATOR = env.VITE_USE_EMULATOR === "true";

// ── Cloudflare 터널 외부 공유 설정 ─────────────────────────────────
// 외부에서 접속할 때는 로컬 에뮬레이터(localhost) 대신 trycloudflare 터널로 붙는다.
// 이 블록을 비우면(빈 문자열) 평소처럼 localhost 에뮬레이터를 사용.
// trycloudflare 호스트는 Firebase SDK가 ssl 자동감지를 못 하므로 직접 https를 강제한다.
const TUNNEL = {
  auth: "https://cathedral-type-practice-interactive.trycloudflare.com",
  firestoreHost: "rows-installation-brothers-gorgeous.trycloudflare.com",
  functions: "https://solution-wrapped-chosen-firm.trycloudflare.com",
};
// 외부 공유(트위큐) 터널로 붙이려면 SHARE_VIA_TUNNEL=true. 평소 로컬 테스트는 false.
// (trycloudflare URL은 재시작마다 바뀌므로, 공유 시 위 TUNNEL 값을 새로 받아 넣고 true 로 바꾸세요.)
const SHARE_VIA_TUNNEL = false;
const USE_TUNNEL = SHARE_VIA_TUNNEL && USE_EMULATOR && Boolean(TUNNEL.functions);
// ───────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: env.VITE_FB_API_KEY,
  authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID,
  storageBucket: env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID,
  appId: env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firestore: 터널이면 ssl 강제 + long-polling(터널에서 WebChannel 스트리밍이 불안정)
export const db = USE_TUNNEL
  ? initializeFirestore(app, {
      host: TUNNEL.firestoreHost,
      ssl: true,
      experimentalForceLongPolling: true,
    })
  : getFirestore(app);

// Functions는 서울 리전에 배포됨
export const functions = getFunctions(app, "asia-northeast3");

if (USE_TUNNEL) {
  connectAuthEmulator(auth, TUNNEL.auth, { disableWarnings: true });
  // initializeFirestore가 이미 터널 호스트로 설정됨 — connectFirestoreEmulator 불필요
  // Functions: emulatorOrigin을 https 터널로 직접 지정 (connectFunctionsEmulator는 port를 붙여 http로 만듦)
  functions.emulatorOrigin = TUNNEL.functions;
  // eslint-disable-next-line no-console
  console.info("🌐 Cloudflare 터널을 통해 Firebase 에뮬레이터에 연결되었습니다.");
} else if (USE_EMULATOR) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
  // eslint-disable-next-line no-console
  console.info("🔧 Firebase 에뮬레이터에 연결되었습니다.");
}
