# 배포 준비 체크리스트 — 고놈 월드컵 카드뽑기

로컬은 Firebase **에뮬레이터** 기반 데모로 동작합니다. 실서비스 배포 전 아래를 순서대로 점검하세요.

## 1. 보안 하드닝 (필수)

- [ ] **어드민 마스터 키 교체**
  - 현재: `functions/index.js` → `ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || "demo-master"`
  - 운영: 시크릿으로 주입 — `firebase functions:secrets:set ADMIN_MASTER_KEY` (또는 환경변수). 데모 키("demo-master")로 절대 배포 금지.
  - `/admin` 로그인을 "데모 마스터 로그인" 버튼이 아닌 키 입력 방식으로 전환 검토 (`web/src/admin/AdminApp.jsx`).
- [ ] **테스트 계정/데모 로그인 제거**
  - 사번 `0000` 무한뽑기 + 등급 지정 뽑기: `functions/index.js`(`isTestAccount`, `unlimited`), `web/src/components/Home.jsx`(데모 등급 픽커), `web/src/components/Login.jsx`(데모 로그인 버튼).
  - 운영에선 비활성화(빌드 플래그/환경변수 게이트 권장).
- [ ] **Firestore 규칙 재검토** — `firestore.rules` (현재: catalog read-only, 쓰기는 함수만). 명단/당첨 노출 범위 확인.

## 2. Firebase 실프로젝트 연결

- [ ] `.firebaserc` 의 프로젝트 ID 확인/교체 (현재 `worldcup-gonom-event`).
- [ ] **웹 환경변수** `web/.env.local` (또는 호스팅 빌드 환경)에 실제 값 설정 — `web/.env.example` 참고:
  - `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`, `VITE_FB_STORAGE_BUCKET`, `VITE_FB_MESSAGING_SENDER_ID`, `VITE_FB_APP_ID`
  - **`VITE_USE_EMULATOR=false`** (반드시 false — 미설정/true면 에뮬레이터로 붙음).
- [ ] 함수 리전 확인 — `functions/index.js`: `asia-northeast3` (서울). 웹 `httpsCallable` 리전과 일치.
- [ ] Firebase Auth 익명 로그인 활성화 (웹이 `ensureAuth`로 익명 인증 사용).

## 3. 이벤트 데이터 세팅

- [ ] **config/event**: `active`, `startDate`/`endDate`(KST, 포함), `rosterRequired`, `cardsPerPack`, `missWeight`, `contactTeam/Person/How`, `prizeNote`.
- [ ] **등급/재고**: `grades` 의 `inventoryTotal`(SP1·전설1·유니크2·에픽3·레어4·일반=무제한), `weight`(400명 기준 확률), `dailyQuota`.
- [ ] **명단(roster)**: 실제 사번/이름 업로드(rosterRequired=true면 명단·이름 일치 검증). 약 400명.
- [ ] **팀(teams)**: 응원전 팀 목록.
- [ ] **카드 이미지**: `web/public/cards/*` 등급별 카드 아트 확인.

## 4. 런칭 직전 데이터 초기화 (순서 중요)

1. 위 config/grades/roster/teams 시드 완료.
2. **테스트 뽑기 기록 제거** — 어드민 → 운영 도구 → **이벤트 초기화** (draws/users 삭제 + 등급 재고 복원). 또는 `adminAction("resetEvent")`.
3. 명예의 전당/전광판/통계가 모두 0에서 시작하는지 확인.
4. `config/event.active=true`, `endDate`가 미래인지 최종 확인.

## 5. 빌드 & 배포

```bash
# 웹 빌드 (VITE_USE_EMULATOR=false 환경에서)
npm run build --prefix web
# 함수 + 호스팅 + 규칙 배포
firebase deploy --only functions,firestore:rules,hosting
```

- [ ] 배포 후 실기기(모바일)에서: 로그인 → 뽑기 연출 → 명예의 전당 → 응원전 → 결과/공유(Web Share) 점검.
- [ ] 종료일 경과 시 종료 화면(참여율·1~4등) 정상 노출 확인.

## 6. 운영 중

- [ ] 어드민 대시보드(참여율/시간대/상태점검) 모니터링.
- [ ] 1등 미공개 지속 시 운영 도구의 강제 추첨(`fillWinners`)으로 마감 전 채움 검토.
- [ ] 재고 소진/오류는 상태 점검 탭에서 확인.
