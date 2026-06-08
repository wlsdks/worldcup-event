/**
 * Firestore 초기 데이터 시드
 *
 * 에뮬레이터:  FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=worldcup-gonom-event node seed.js
 * 실서버:      GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node seed.js
 *
 * ⚠️ 재실행 시 grades의 inventoryRemaining(남은 재고)이 inventoryTotal로 초기화됩니다.
 *    이벤트 진행 중에는 다시 돌리지 마세요. (등급/카드 추가만 할 거면 추가분만 set 하도록 수정)
 */
import admin from "firebase-admin";

const projectId = process.env.GCLOUD_PROJECT || "worldcup-gonom-event";
admin.initializeApp({ projectId });
const db = admin.firestore();

// ── 이벤트 설정 ──
const EVENT = {
  title: "고놈 월드컵 카드뽑기",
  active: true,
  startDate: "2026-06-04", // KST, 포함
  endDate: "2026-06-06",   // KST, 포함 (3일)
  drawsPerDay: 1,
  baseDraws: 3, // 1인 기본 뽑기 횟수(총량). +응원글(1) +좋아요3회(1) = 최대 5회
  cardsPerPack: 1, // 한 번 뽑을 때 한 팩에 나오는 카드 수 (1장)
  unlimitedDraws: false, // 운영: 총 baseDraws+보너스 한도 내 뽑기 + 재고차감(소진 시 더 안 나옴)
  // 꽝 없음. 1~4등(한정)에 당첨되지 않으면 전부 5등(무제한)이 나온다.
  missWeight: 0,
  // 사번+이름이 roster(명단)와 일치해야만 참여 가능. (false면 누구나 입장)
  rosterRequired: true,
  timezone: "Asia/Seoul",
  // 경품 수령 안내 (당첨 화면·상품 팝업에 노출)
  contactTeam: "인재경영팀",
  contactPerson: "윤도현",
  contactHow: "DM 또는 직접 방문",
  prizeNote: "1~4등 당첨자는 인재경영팀 윤도현님께 DM 또는 방문하여 경품을 수령하세요. 5등은 각 호실별 비치된 축구공 초콜릿을 가져가서 드시면 됩니다!",
};

// ── 등급 ──
// weight     : 확률(상대 가중치)
// daily      : 하루 할당량 [1일차, 2일차, 3일차] (합 = inventoryTotal). 미사용분은 다음 날 이월.
// 1~4등은 한정 수량(소진되면 후보에서 빠져 더 이상 안 나옴). 그 외 전부 5등(무제한).
// weight: 1~4등은 당첨 수량과 동일, 5등은 매우 크게 두어 대부분 5등이 나오게 함.
// daily=[cap,0,0] → 첫날부터 전량 풀림(총 재고만 제한, 날짜별 제한 없음).
// 등급 체계: 스페셜 / 전설(1등) / 유니크(2등) / 에픽(3등) / 레어(4등) / 일반(5등)
// 재고(inventoryTotal)=등급별 카드 수(5등 제외, 무제한). 확률은 400명 기준(가중치 합=400 → 0.25/0.25/0.5/0.75/1%).
const GRADES = [
  { id: "g0", rank: 0, label: "SP",  name: "스페셜", color: "special", weight: 1,   inventoryTotal: 1,    unlimited: false, daily: [1, 0, 0], prize: "국가대표 레플리카 유니폼" },
  { id: "g1", rank: 1, label: "1st", name: "전설",   color: "holo",   weight: 1,   inventoryTotal: 1,    unlimited: false, daily: [1, 0, 0], prize: "배달의민족 상품권 5만원" },
  { id: "g2", rank: 2, label: "2nd", name: "유니크", color: "gold",   weight: 2,   inventoryTotal: 2,    unlimited: false, daily: [2, 0, 0], prize: "배달의민족 상품권 3만원" },
  { id: "g3", rank: 3, label: "3rd", name: "에픽",   color: "silver", weight: 3,   inventoryTotal: 3,    unlimited: false, daily: [3, 0, 0], prize: "치킨 기프티콘" },
  { id: "g4", rank: 4, label: "4th", name: "레어",   color: "bronze", weight: 4,   inventoryTotal: 4,    unlimited: false, daily: [4, 0, 0], prize: "휴대용 선풍기" },
  { id: "g5", rank: 5, label: "5th", name: "일반",   color: "basic",  weight: 389, inventoryTotal: null, unlimited: true,                  prize: "축구공 초콜릿" },
];

/** startDate~endDate(포함) 날짜 문자열 배열 'YYYY-MM-DD' */
function dateRange(start, end) {
  const out = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const [ey, em, ed] = end.split("-").map(Number);
  const last = Date.UTC(ey, em - 1, ed);
  while (cur.getTime() <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// ── 카드 (같은 등급 내 여러 장이면 뽑을 때 랜덤 1장 노출) ──
const CARDS = [
  { id: "c_1st",            gradeId: "g1", name: "붉은악마",   image: "card_1st.png",            desc: "머리에 불을 켠 전설의 붉은악마 고놈! 골을 향한 열정이 활활 타오른다. 가장 뜨겁고 가장 강한, 모두가 탐내는 단 하나의 카드." },
  { id: "c_2nd_home",       gradeId: "g2", name: "홈",         image: "card_2nd_home.png",       desc: "홈 유니폼을 입고 골든볼을 든 에이스 고놈. 홈팬들의 함성을 등에 업으면 두 배로 강해진다!" },
  { id: "c_2nd_away",       gradeId: "g2", name: "어웨이",     image: "card_2nd_away.png",       desc: "적진 원정도 두렵지 않은 강심장 고놈. 어웨이에서 골든볼을 거머쥔 진정한 해결사." },
  { id: "c_3rd_dribble",    gradeId: "g3", name: "드리블",     image: "card_3rd_dribble.png",    desc: "현란한 드리블의 마법사 고놈! 수비수 사이를 유유히 빠져나가는 발재간의 소유자." },
  { id: "c_3rd_celebration",gradeId: "g3", name: "세레머니",   image: "card_3rd_celebration.png",desc: "골 넣고 세레머니 작렬! 흥이 넘치는 분위기 메이커, 골 셀러브레이션 장인 고놈." },
  { id: "c_3rd_keeper",     gradeId: "g3", name: "키퍼",       image: "card_3rd_keeper.png",     desc: "슈퍼세이브의 수문장 고놈! 어떤 강슛도 손끝으로 막아내는 철벽 골키퍼." },
  { id: "c_4th_cheer",      gradeId: "g4", name: "응원",       image: "card_4th_cheer.png",      desc: "목청 터지게 응원하는 열혈팬 고놈! 태극기 흔들며 외치는 함성이 경기장을 채운다." },
  { id: "c_4th_home",       gradeId: "g4", name: "집관",       image: "card_4th_home.png",       desc: "치킨과 콜라로 무장하고 집관 모드 ON! 세상에서 가장 편안한 응원법을 아는 고놈." },
  { id: "c_4th_vuvuzela",   gradeId: "g4", name: "부부젤라",   image: "card_4th_vuvuzela.png",   desc: "부부젤라 한 방으로 경기장을 뒤흔드는 고놈. 응원 데시벨만큼은 양보 못 한다!" },
  { id: "c_4th_goal",       gradeId: "g4", name: "감격",       image: "card_4th_goal.png",       desc: "'코리아, 골!' 두 손 모아 기도하던 그 마음. 감격의 눈물을 흘리는 진성 팬 고놈." },
  // 5등(아이언) — 고놈(곰) 카드 = 당첨
  { id: "c_5th_a",          gradeId: "g5", name: "질주",       image: "card_5th_a.png",          desc: "붉은 유니폼으로 그라운드를 질주하는 드리블러 고놈. 끝까지 포기란 없다!" },
  { id: "c_5th_b",          gradeId: "g5", name: "강슛",       image: "card_5th_b.png",          desc: "발끝에 불이 붙은 골잡이 고놈! 회심의 강슛으로 골망을 흔든다." },
  { id: "c_5th_c",          gradeId: "g5", name: "전력질주",   image: "card_5th_c.png",          desc: "90분 내내 뛰는 체력왕 고놈. 지치지 않는 심장으로 그라운드를 누빈다." },
  { id: "c_5th_d",          gradeId: "g5", name: "파워",       image: "card_5th_d.png",          desc: "알통 자랑하는 파워 고놈! '나 이런 곰이야~' 피지컬 하나는 자신 있다." },
  { id: "c_5th_e",          gradeId: "g5", name: "테크닉",     image: "card_5th_e.png",          desc: "보라 유니폼의 테크니션 고놈. 감각적인 킥 한 방이 일품이다." },
  { id: "c_5th_f",          gradeId: "g5", name: "헤더",       image: "card_5th_f.png",          desc: "공중볼은 내 거! 헤딩 타이밍을 노리는 제공권의 지배자 고놈." },
  { id: "c_5th_g",          gradeId: "g5", name: "발리슛",     image: "card_5th_g.png",          desc: "날아오는 공을 그대로 차버리는 발리슛 장인 고놈. 타이밍의 예술." },
  { id: "c_5th_h",          gradeId: "g5", name: "선방",       image: "card_5th_h.png",          desc: "초록 장갑 끼고 골문을 사수하는 신참 키퍼 고놈. 패기만큼은 국대급!" },
  { id: "c_5th_i",          gradeId: "g5", name: "단장님",     image: "card_5th_i.png",          desc: "정장 빼입고 팔짱 낀 단장님 고놈? 벤치에서 팀을 진두지휘하는 카리스마." },
  { id: "c_special",        gradeId: "g0", name: "스페셜",     image: "card_special.png",        desc: "월드컵 우승의 주인공! 트로피를 번쩍 들어올린 전설의 순간을 담은, 세상에 단 하나뿐인 스페셜 고놈." },
];

// ── 응원전 팀 (휴넷 부서 39팀) ──
// cheerCount 는 시드로 건드리지 않음(merge) → 재시드해도 응원 수 유지.
const TEAM_NAMES = [
  "기업교육1팀","기업교육2팀","기업교육3팀","프런티어세일즈1팀","프런티어세일즈2팀","프런티어세일즈3팀",
  "그로스세일즈팀","사업전략팀","HU사업팀","L&D마케팅팀","하이브리드러닝사업팀","교육운영1팀","교육운영2팀",
  "교육운영3팀","하이브리드러닝운영팀","컨텐츠매니지먼트팀","BPO사업운영팀","고객행복팀","교육지원팀",
  "IT전략기획팀","IT인프라팀","LABS플랫폼팀","HU플랫폼팀","러닝메이커솔루션팀","LMS솔루션팀","CMS솔루션팀",
  "공통플랫폼팀","FRONT개발팀","AI LAB","LX혁신팀","휴넷리더십센터","L&D혁신팀","리더스아카데미팀",
  "AX아카데미팀","컨텐츠혁신팀","인재경영팀","전략경영팀","커뮤니케이션팀","디자인팀",
];
const TEAMS = TEAM_NAMES.map((name, i) => ({ id: "t" + String(i + 1).padStart(2, "0"), name, emoji: "", order: i + 1 }));

// ── 참여자 명단 (임시 — 실제 사번/이름으로 교체 예정) ──
// 사번+이름이 아래와 일치해야만 입장/뽑기 가능. (config.rosterRequired=false 면 검사 안 함)
const ROSTER = [
  { empNo: "1001", name: "홍길동" },
  { empNo: "1002", name: "김철수" },
  { empNo: "1003", name: "이영희" },
  { empNo: "1004", name: "박민수" },
  { empNo: "1005", name: "최지우" },
  { empNo: "1006", name: "정해인" },
  { empNo: "1007", name: "강수진" },
  { empNo: "1008", name: "윤도현" },
  { empNo: "1009", name: "임꺽정" },
  { empNo: "1010", name: "성춘향" },
  { empNo: "0000", name: "테스트" },
];

async function run() {
  const batch = db.batch();

  batch.set(db.doc("config/event"), EVENT, { merge: true });

  const dates = dateRange(EVENT.startDate, EVENT.endDate);

  for (const g of GRADES) {
    // daily 배열을 이벤트 날짜에 매핑 → { 'YYYY-MM-DD': 할당량 }
    const dailyQuota = {};
    if (!g.unlimited && g.daily) {
      dates.forEach((d, i) => { dailyQuota[d] = g.daily[i] || 0; });
    }
    batch.set(db.doc(`grades/${g.id}`), {
      rank: g.rank,
      label: g.label,
      name: g.name,
      color: g.color,
      weight: g.weight,
      inventoryTotal: g.inventoryTotal,
      inventoryRemaining: g.unlimited ? null : g.inventoryTotal,
      unlimited: g.unlimited,
      dailyQuota,
      prize: g.prize || "",
    });
  }

  for (const c of CARDS) {
    batch.set(db.doc(`cards/${c.id}`), {
      gradeId: c.gradeId,
      name: c.name,
      image: c.image,
      desc: c.desc || "",
      active: true,
    });
  }

  for (const tm of TEAMS) {
    // merge: name/emoji/order만 갱신, cheerCount(응원 수)는 보존
    batch.set(db.doc(`teams/${tm.id}`), { name: tm.name, emoji: tm.emoji, order: tm.order }, { merge: true });
  }

  for (const r of ROSTER) {
    batch.set(db.doc(`roster/${r.empNo}`), { name: r.name }, { merge: true });
  }

  await batch.commit();
  console.log("✅ 시드 완료");
  console.log(`   - config/event  : ${EVENT.startDate} ~ ${EVENT.endDate}`);
  console.log(`   - grades        : ${GRADES.length}개`);
  console.log(`   - cards         : ${CARDS.length}개`);
  console.log(`   - teams         : ${TEAMS.length}개`);
  console.log(`   - roster        : ${ROSTER.length}명`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
