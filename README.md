# 고놈 월드컵 카드뽑기 이벤트 ⚽🎴

피파 카드팩처럼 **카드를 뽑는** 사내 이벤트. 300명 / 3일 / 하루 1회.
**확률·재고·중복방지는 100% 서버(Cloud Functions)에서 처리** → 클라이언트 조작 불가.

## 구조

```
worldcup/
├─ firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
├─ functions/            # Cloud Functions (뽑기 핵심 로직)
│  ├─ index.js           #   drawCard / getStatus  (Firestore 트랜잭션)
│  └─ seed.js            #   등급·카드·이벤트 초기 데이터 시드
└─ web/                  # Vite + React 프론트엔드
   ├─ src/               #   로그인 / 홈·뽑기 / 카드 까는 연출 / 도감
   └─ public/cards/      #   카드 이미지 8종 (1~3등 실사 + 4·5등 플레이스홀더)
```

### 데이터 모델 (Firestore)
| 컬렉션 | 내용 | 클라 접근 |
|---|---|---|
| `config/event` | 이벤트 기간·활성화·하루뽑기수 | 읽기 O / 쓰기 X |
| `grades/{g1..g5}` | 등급별 확률(weight)·재고 | 읽기 O / 쓰기 X |
| `cards/{...}` | 카드 도감(등급↔이미지 매핑) | 읽기 O / 쓰기 X |
| `users/{사번}` | 유저·누적 뽑기수 | **차단** (서버만) |
| `draws/{사번__날짜}` | 뽑기 기록 (하루1회 원자적 잠금) | **차단** (서버만) |

뽑기 로직: 트랜잭션 안에서 ①오늘 뽑았나 ②확률 추첨(재고 남은 등급만 후보) ③재고 -1 ④기록.
동시 접속해도 **한정 경품 초과 지급이 절대 발생하지 않음**.

---

## 사전 준비
- Node 20+ (현재 설치됨)
- **Firebase 프로젝트** (Blaze 요금제) — Firestore + Functions + Hosting + Anonymous Auth 활성화
- 로컬 에뮬레이터로 테스트하려면 **Java 11+** 필요 (Firestore 에뮬레이터가 Java 사용)
  - macOS: `brew install --cask temurin`

## 1) 설치
```bash
npm install --prefix functions
npm install --prefix web
```

## 2) 로컬 테스트 (에뮬레이터)
```bash
# 터미널 A — 에뮬레이터 (Java 필요)
firebase emulators:start

# 터미널 B — 시드 주입 (한 번)
FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=worldcup-gonom-event \
  node functions/seed.js

# 터미널 C — 프론트 (web/.env.local 에 VITE_USE_EMULATOR=true 인 상태)
npm run dev --prefix web
# http://localhost:5173
```

## 3) 실서버 배포
```bash
firebase login
firebase use <your-project-id>        # .firebaserc 의 default 도 교체

# (a) Firebase 콘솔에서 Anonymous Auth 활성화
# (b) web/.env.local 을 실제 SDK 설정값으로 교체 + VITE_USE_EMULATOR=false
# (c) 시드 주입 (서비스 계정 키로 1회)
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node functions/seed.js

npm run build --prefix web
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

---

## 운영 / 커스터마이즈

**확률·재고 변경** → `functions/seed.js` 의 `GRADES` 수정 후 재시드
(⚠️ 진행 중 재시드는 재고를 초기화하니 주의 — 또는 콘솔에서 `grades` 문서 직접 수정).

**카드 추가** (나중에 4·5등 실제 이미지 등) →
1. 카드 이미지를 `web/public/cards/` 에 추가
2. Firestore `cards` 컬렉션에 문서 추가 `{ gradeId, name, image, active:true }`
→ **코드 수정·재배포 불필요** (데이터만 추가).

**이벤트 기간/활성화** → `config/event` 의 `startDate`/`endDate`/`active` 수정.

## 현재 기본값
| 등급 | 카드 | 재고 | 확률(weight) |
|---|---|---|---|
| 1등 | 붉은악마(홀로) | 1 | 0.3 |
| 2등 | 홈/어웨이(금) | 3 | 1.5 |
| 3등 | 드리블/세레머니/키퍼(은) | 10 | 5 |
| 4등 | (플레이스홀더) | 30 | 15 |
| 5등 | (플레이스홀더, 참여상) | 무제한 | 78.2 |
