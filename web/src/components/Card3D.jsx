import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { gyro } from "../lib/gyro";

// 등급별 카드 엣지/림 색
const EDGE = ["#1f9e76", "#caa12a", "#c79a36", "#9aa6b6", "#9c6a3e", "#5a626e"];

function CardMesh({ front, back, revealed, prize, special, edge }) {
  const g = useRef();
  const ft = useTexture(front);
  const bt = useTexture(back);
  ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 8;
  bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 8;

  useFrame((st, dt) => {
    const grp = g.current; if (!grp) return;
    const k = Math.min(1, dt * 6);
    const t = st.clock.elapsedTime;
    // 공개 후 자동 스웨이 — 손대지 않아도 빛/홀로가 계속 흐르도록(쇼케이스)
    const sway = revealed ? Math.sin(t * 0.8) * 0.26 : 0;
    // 입력: 자이로(모바일) 우선, 없으면 포인터
    const px = gyro.active ? gyro.x : st.pointer.x;
    const py = gyro.active ? gyro.y : st.pointer.y;
    // 공개 시 뒷면(π) → 앞면(0) 플립 + 기울기로 3D 틸트
    const tgtY = (revealed ? 0 : Math.PI) + px * (gyro.active ? 0.55 : 0.4) + sway;
    const tgtX = -py * (gyro.active ? 0.45 : 0.3) + (revealed ? Math.sin(t * 0.6) * 0.05 : 0);
    grp.rotation.y += (tgtY - grp.rotation.y) * k;
    grp.rotation.x += (tgtX - grp.rotation.x) * Math.min(1, dt * 5);
    grp.position.y = Math.sin(t * 1.4) * 0.03; // 잔잔한 부유
  });

  const W = 2.4, H = 3.36, T = 0.05;
  return (
    <group ref={g} rotation={[0, Math.PI, 0]}>
      {/* 카드 본체(엣지/두께) — 금속 림 */}
      <mesh castShadow>
        <boxGeometry args={[W + 0.06, H + 0.06, T]} />
        <meshStandardMaterial color={edge} metalness={0.85} roughness={0.32} />
      </mesh>
      {/* 앞면 — 프리미엄 라미네이트(클리어코트) + 홀로그래픽 이리데센스 */}
      <mesh position={[0, 0, T / 2 + 0.001]}>
        <planeGeometry args={[W, H]} />
        <meshPhysicalMaterial
          map={ft}
          roughness={prize ? 0.28 : 0.55}
          metalness={prize ? 0.45 : 0.12}
          clearcoat={prize ? 1 : 0.35}
          clearcoatRoughness={0.18}
          iridescence={special ? 1 : prize ? 0.7 : 0}
          iridescenceIOR={1.35}
          iridescenceThicknessRange={[120, 520]}
          envMapIntensity={1.25}
        />
      </mesh>
      {/* 뒷면 */}
      <mesh position={[0, 0, -T / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshPhysicalMaterial map={bt} roughness={0.5} metalness={0.3} clearcoat={0.5} envMapIntensity={1} />
      </mesh>
    </group>
  );
}

/** 리빌 전용 3D 카드 — 실제 3D 플립 + 환경광 반사 + 홀로그래픽 이리데센스 */
export default function Card3D({ card, revealed }) {
  const prize = card.gradeRank <= 3;
  const special = card.gradeRank <= 1; // SP·전설 최강 홀로
  const edge = EDGE[card.gradeRank] ?? "#5a626e";
  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 34 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <directionalLight position={[-4, -2, 2]} intensity={0.5} color="#ffd9b0" />
      <Suspense fallback={null}>
        <CardMesh
          front={`/cards/${card.cardImage}`}
          back="/cards/card-back.png"
          revealed={revealed}
          prize={prize}
          special={special}
          edge={edge}
        />
        {/* 네트워크 HDR 없이 메모리 환경맵 — 반사/이리데센스용 */}
        <Environment resolution={128}>
          <Lightformer intensity={2.4} position={[2, 2, 3]} scale={[4, 4, 1]} color="#ffffff" />
          <Lightformer intensity={1.2} position={[-3, 1, 2]} scale={[3, 3, 1]} color="#ffd9b0" />
          <Lightformer intensity={1.0} position={[0, -2, 1]} scale={[4, 2, 1]} color="#9bbcff" />
        </Environment>
      </Suspense>
    </Canvas>
  );
}
