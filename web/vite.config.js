import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, allowedHosts: true },
  build: {
    rollupOptions: {
      output: {
        // 벤더를 분리해 캐싱 효율↑ (앱 코드만 바뀌어도 벤더 청크는 재사용)
        manualChunks: {
          "vendor-firebase": ["firebase/app", "firebase/firestore", "firebase/functions", "firebase/auth"],
          "vendor-motion": ["framer-motion"],
          "vendor-react": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
