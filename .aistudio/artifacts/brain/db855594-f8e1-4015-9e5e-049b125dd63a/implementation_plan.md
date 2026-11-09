# JBL 프로야구단 육성 & 구단 운영 시뮬레이터 (JBL Baseball Franchise Manager)

사용자가 10개 JBL(지도 베이스볼 리그) 구단 중 하나를 지휘하는 감독 겸 단장이 되어, 투구 하나하나와 이닝별 상황이 생생하게 전개되는 문자 중계 시뮬레이션을 즐기고, 선수를 육성하며, 트레이드와 신인 드래프트를 통해 왕조를 구축하는 하이엔드 야구 매니지먼트 시뮬레이션 게임입니다. 게임 내 모든 데이터는 사용자의 구글 스프레드시트(Google Sheets)에 구글 앱스스크립트(Google Apps Script) 웹앱 연동 및 원클릭 CSV/JSON 내보내기를 통해 완벽히 동기화됩니다.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> 사전 질의응답을 통해 확정된 핵심 사용자 결정 사항입니다:
> - **구단 선택**: 게임 시작 시 JBL 공식 10개 구단(난하 지도, 신사 식약, 서강 로간, 지도 지누, 안소 시스, 아세 리미트, 신여 한계, 부서 시작, 마성 엑설, 파천 바이글) 중 자유롭게 선택하여 부임.
> - **경기 중계 방식**: 속도 조절(1x, 2x, 5x, 이닝 스킵, 경기 스킵) 및 실시간 작전 지시(도루, 번트, 고의사구, 투수/대타 교체)가 가능한 **투구 단위 문자 중계(Text Play-by-Play Relay) & 전광판 다이아몬드 레이더**.
> - **스프레드시트 연동**: 구글 시트에 복사해 붙여넣기만 하면 자동으로 구단/선수/기록 탭을 생성하고 업데이트하는 **전용 Google Apps Script 코드 생성기 + 웹앱(Webhook) 실시간 동기화 + 원클릭 CSV/JSON 백업 시스템**.

- **확정 결정 1 (25년 리그 역사 계승)**: 제공된 JBL 역사 데이터(식약 4회, 지도 5회, 로간 5회, 지누 2회 연속 우승 등 1~25회 우승 기록)를 게임 내 '명예의 전당 / 연도별 우승 기록'에 공식 반영하여 26회차 시즌부터 새롭게 시작합니다.
- **확정 결정 2 (선수 육성 메커니즘)**: 타자(컨택/파워/선구안/주력/수비/체력/멘탈)와 투수(구속/제구/구위/스태미너/변화구 4종)의 세밀한 능력치 체계를 구축하고, 경기 경험치(EXP) 분배 및 훈련 시설(타격장, 투구폼 교정실, 웨이트장, 멘탈 코칭룸) 투자를 지원합니다.
- **확정 결정 3 (드래프트 & 트레이드)**: 시즌 종료 후 역순 지명 방식(직전 시즌 10위 팀이 1순위) 신인 드래프트 3라운드 시스템과 AI 알고리즘 기반 트레이드 협상 엔진(선수 가치 평가 및 1:1, 다자간 트레이드)을 구현합니다.

---

## 1. Overview & Core Concept

- **What It Does**:
  - JBL 10개 구단의 연고지, 홈구장, 모기업, 창단년도, 역사적 우승 기록을 기반으로 한 본격 프로야구 프런트 & 현장 총괄 시뮬레이터.
  - 투구 한 구(Ball/Strike/Foul/In-Play), 구종(직구/슬라이더/커브/체인지업/포크볼), 구속(km/h), 코스(9분할 스트라이크존), 주자 상황(1, 2, 3루 주자 진루/태그아웃/도루)을 정밀 계산하는 물리 확률 기반 시뮬레이션 엔진 탑재.
  - 1군 엔트리와 2군 육성군 관리, 선발 5인 로테이션 및 불펜(셋업/마무리), 1~9번 지명타자 포함 타순 및 수비 포지션 설정.
  - 시즌 페넌트레이스(팀당 18~36경기 조절 가능) -> 플레이오프 & 한국시리즈(JBL 챔피언십) 토너먼트.
  - 경기 후 박스스코어, 타자/투수 개인 타이틀(타율, 홈런, 타점, OPS, 다승, 평균자책점, 탈삼진, 세이브, WAR), 팀 순위표 실시간 집계.
  - 구글 시트 연동: 원클릭으로 Google Apps Script `Code.gs` 생성, 웹앱 URL 입력 시 시트에 다중 탭(팀 정보, 타자 명단, 투수 명단, 리그 순위, 경기 결과) 자동 생성 및 동기화.

- **Target Audience / Persona**:
  - 야구 구단 운영(OOTP, 마구마구, 프로야구 매니저) 및 통계 세이버메트릭스, 선수 육성에 깊은 흥미를 가진 야구 팬 및 게이머.
  - 자신의 구단 기록을 스프레드시트에 영구 보관하고 싶은 세이버메트리션 성향의 플레이어.

- **Key Value**:
  - 단순 결과 클릭 게임이 아닌, 한 구 한 구의 볼카운트 승부와 타격 결과를 지켜보며 긴장감 넘치는 감독 지시를 내릴 수 있는 생생한 몰입감 제공.
  - 실제 구글 스프레드시트와 실시간 연동되어 구단 데이터가 외부 시트에 체계적으로 누적되는 실용성.

---

## 2. User Experience & Visual Design

### A. Key User Flows
1. **타이틀 & 구단 선택 화면**: JBL 26회차 개막을 알리는 전광판 비주얼과 함께 10개 구단(난하 지도, 신사 식약, 서강 로간, 지도 지누 등)의 역사와 엠블럼, 홈구장 정보를 탐색하고 지휘봉을 잡을 팀을 선택.
2. **구단 메인 사옥 (Dashboard)**:
   - 다음 경기 일정 및 상대팀 선발투수 정보.
   - 팀 순위, 최근 5경기 전적, 팀 타율/ERA, 부상자 리포트.
   - 상단 탭 네비게이션: [경기 출전], [선수단 라인업], [선수 육성실], [트레이드 시장], [신인 드래프트], [리그 기록실], [스프레드시트 연동].
3. **경기 중계실 (Live Pitch-by-Pitch Game Room)**:
   - 중앙 상단: 9이닝 점수판(R-H-E-B), B-S-O 카운트 램프, 이닝 표시(초/말).
   - 좌측: 타석 vs 마운드 매치업 카드 (타자 시즌 성적, 타율, 투수 오늘 투구수, 구속, 구위).
   - 중앙: 2D 다이아몬드 주자 베이스 그래픽 & 9분할 스트라이크존 투구 궤적 표시.
   - 우측: 실시간 투구 단위 텍스트 중계 피드 (예: "3구째 147km/h 몸쪽 패스트볼! 경쾌한 타구음과 함께 좌중간을 가르는 2루타!").
   - 하단 작전 콘솔:
     - 속도 조절: [1구 진행], [1타석 진행], [이닝 넘기기], [경기 종료까지 스킵], [배속 1x/2x/5x].
     - 감독 작전: [강공 지시], [희생 번트], [단독 도루], [히트 앤 런], [고의사구], [투수 교체], [대타 기용].
   - 사운드 이펙트: Web Audio API 기반 타격음(맑은 타구음), 포구음, 심판 스트라이크 콜, 관중 함성 (음소거 토글 완비).
4. **선수 육성실 (Training & Growth)**:
   - 개별 선수의 스탯 육각형 레이더 차트, 포텐셜 등급(S~D), 성장 곡선.
   - 훈련 시설 업그레이드 및 훈련 포인트(TP) 배분: 컨택 훈련, 장타력 특훈, 선구안 강화, 제구력 집중, 신구종 연마.
5. **트레이드 시장 (Trade Market)**:
   - 9개 타 구단의 등록 선수 조회 및 검색 필터(포지션, 나이, 오버롤).
   - 트레이드 블록에 올릴 내 선수 선택 후 타 구단에 제안 -> AI 가치 산정 공식에 따라 수락/거절/반대 제안.
6. **신인 드래프트 (Draft Center)**:
   - 고교/대학 최고 유망주 30인의 스카우팅 리포트, 측정 스탯 및 잠재력.
   - 10위부터 1위까지 역순 지명 진행 (내 차례에 타임아웃 없이 심사숙고 지명 가능).
7. **스프레드시트 연동 허브 (Google Sheets & Apps Script)**:
   - 완성된 Google Apps Script 코드 뷰어 (원클릭 클립보드 복사).
   - 3단계 배포 가이드 (시트 열기 -> 확장 프로그램 Apps Script -> 코드 붙여넣고 웹앱 배포).
   - 배포된 웹앱 URL 등록 필드 & [지금 구글 시트로 전체 데이터 전송 (Sync Now)] 버튼.
   - 별도 설치 없이 바로 다운로드 가능한 [CSV 엑셀 파일 다운로드] 및 [JSON 백업/복원] 지원.

### B. Visual Identity & Theme
- **Aesthetic Direction**: 프로야구 전광판과 스포츠 매니지먼트 애널리틱스가 결합된 정통 야구 구단 사옥 스타일.
- **Palette**:
  - Base Background: 다크 스타디움 네이비 (`#0B132B`, `#1C2541`).
  - Structural Panels: 정돈된 세련된 슬레이트 (`#1F2937`, `#111827`).
  - Ballpark Turf & Diamond: 세이지 필드 그린 (`#15803D`) 및 더트 브라운 (`#92400E`).
  - Accent / Highlights: 전광판 앰버 골드 (`#F59E0B`), 전광판 볼/스트라이크/아웃 LED (Green `#22C55E`, Amber `#EAB308`, Red `#EF4444`).
- **Typography**:
  - Brand & Headers: `Plus Jakarta Sans` / `Outfit` 볼드.
  - Data & Metrics: `tabular-nums font-mono`를 전면 적용하여 전광판, 타율, 방어율, 구속 수치가 깔끔하게 정렬.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: 투구 단위 확률 시뮬레이션 모델 (Pitch-by-Pitch Probabilistic Engine)**
  - *선택*: 단순 이닝 단위 결과 생성이 아닌, 투수의 구속/제구/구위와 타자의 컨택/선구안/파워가 매 투구마다 교차 계산되는 9분할 존 투구 엔진 구현.
  - *이유*: 사용자가 요청한 "경기 하나하나의 투구와 이닝을 직접 보고 감독 지시를 내리는 경험"을 충족시키며, 볼카운트(2스트라이크 후 파울, 풀카운트 승부)에 따른 실제 야구의 박진감을 재현.
  - *대안 검토*: 단순 3D 그래픽은 로딩과 성능 저하가 크고 데이터 확인이 불편하므로, 고반응성 전광판 다이아몬드 레이더와 실시간 텍스트 중계 피드를 채택.

- **Decision 2: Google Apps Script 전용 연동 + 무인증 Webhook 구조**
  - *선택*: 사용자가 복잡한 구글 클라우드 콘솔 설정이나 민감한 API 키 발급 없이도, 구글 시트의 무료 Apps Script 기능(웹앱 '모든 사용자' 배포)을 통해 즉시 `POST` 통신으로 자동 시트 생성 및 갱신이 이루어지는 아키텍처 채택.
  - *이유*: 일반 사용자도 1분 안에 자신의 구글 계정 시트에 게임 데이터가 실시간으로 쌓이게 만들 수 있는 가장 직관적이고 강력한 방식.
  - *대안 검토*: 복잡한 GCP OAuth 권한 설정이나 유료 데이터베이스 대신, 로컬 IndexedDB/LocalStorage 영구 저장 + Apps Script Webhook 투트랙을 결합하여 오프라인에서도 100% 작동 보장.

- **Decision 3: JBL 10개 구단 25년사 데이터베이스 내장**
  - *선택*: 난하 지도, 신사 식약, 서강 로간, 지도 지누 등 유저가 제공한 실제 텍스트 파일의 10개 구단과 1~25회 역대 우승 족보를 코드에 시딩하여 즉시 몰입 가능한 리그 환경 구축.
  - *선택*: 각 팀별로 모기업 성격과 홈구장 특성(예: 지도돔=타자 친화 돔구장, 챔필=투수 친화 구장 등)을 반영한 홈 팩터(Park Factor) 부여.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JBL Baseball Club Manager                       │
├────────────────────────────────────────────────────────────────────────┤
│  Top Navigation (Brand Wordmark — View Tabs — Quick Save / Sheet Sync) │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │    Game Navigation    │  │           Main Active View            │  │
│  │ ───────────────────── │  │ ───────────────────────────────────── │  │
│  │ • 1. 구단 사옥 대시보드│  │ [Dashboard View]                      │  │
│  │ • 2. 실시간 경기 중계 │  │   - 리그 순위표, 다음 상대 매치업     │  │
│  │ • 3. 1군/2군 로스터   │  │   - 팀 타선/투수진 핵심 지표          │  │
│  │ • 4. 선수 훈련/육성   │  │ [Live Ballpark Broadcast]             │  │
│  │ • 5. 트레이드 마켓    │  │   - R-H-E 스코어보드 & B-S-O 램프     │  │
│  │ • 6. 신인 드래프트    │  │   - 2D 다이아몬드 베이스 러너         │  │
│  │ • 7. 리그 기록실/명예 │  │   - 9분할 스트라이크존 투구 궤적      │  │
│  │ • 8. 구글 시트 연동   │  │   - 투구별 텍스트 중계 피드 (속도제어)│  │
│  │                       │  │   - 감독 작전 (번트/도루/투수교체 등) │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                             Core Engines                               │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Pitch Sim Engine      │  │ Franchise & Roster State Store        │  │
│  │ (Velocity/Zone/Rolls) │  │ (10 Teams, 250+ Players, Schedules)   │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ Web Audio SFX Synth   │  │ Apps Script Exporter & Webhook Sync   │  │
│  │ (Hit/Catch/Crowd FX)  │  │ (Multi-Tab Sheet Generator + CSV/JSON)│  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (POST Payload)
                     Google Apps Script Web App
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │             User's Google Spreadsheet Tabs             │
       │  [구단정보] [선수단_타자] [선수단_투수] [리그순위]      │
       │  [박스스코어_기록] [드래프트_트레이드]                 │
       └────────────────────────────────────────────────────────┘
```

### Data Model & Entities

```typescript
// 구단 정보
interface Team {
  id: string;
  name: string;           // e.g. "난하 지도", "지도 지누"
  owner: string;          // e.g. "Jido corp.", "JiNu"
  homeStadium: string;    // e.g. "지도대학교야구장", "지도돔"
  foundedYear: number;
  championships: number;  // 역대 우승 횟수
  budget: number;         // 구단 자금
  trainingFacilityLevel: number;
  wins: number;
  losses: number;
  draws: number;
  runsScored: number;
  runsAllowed: number;
}

// 선수 데이터
interface Player {
  id: string;
  name: string;
  teamId: string;
  role: 'BATTER' | 'PITCHER';
  position: 'SP' | 'RP' | 'CP' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
  tier: 'FIRST_TEAM' | 'SECOND_TEAM'; // 1군 / 2군
  age: number;
  potential: 'S' | 'A' | 'B' | 'C' | 'D'; // 잠재력
  condition: number; // 0-100 컨디션
  stamina: number;   // 체력

  // 타자 능력치 & 시즌 기록
  batterStats?: {
    contact: number;  // 1-100
    power: number;    // 1-100
    eye: number;      // 선구안 1-100
    speed: number;    // 주력 1-100
    defense: number;  // 수비력 1-100
    clutch: number;   // 득점권 멘탈 1-100
    // 시즌 성적
    games: number;
    atBats: number;
    hits: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    rbi: number;
    runs: number;
    walks: number;
    strikeouts: number;
    stolenBases: number;
  };

  // 투수 능력치 & 시즌 기록
  pitcherStats?: {
    velocity: number; // km/h (135 ~ 160)
    control: number;  // 제구력 1-100
    stuff: number;    // 구위 1-100
    repertoire: { [pitchType: string]: number }; // 직구, 슬라이더, 커브, 체인지업, 포크
    // 시즌 성적
    games: number;
    inningsPitched: number; // 아웃카운트 기준 / 3
    wins: number;
    losses: number;
    saves: number;
    holds: number;
    earnedRuns: number;
    hitsAllowed: number;
    walksAllowed: number;
    strikeouts: number;
    homeRunsAllowed: number;
    pitchesCount: number;
  };
}

// 실시간 투구 및 경기 상황
interface GameState {
  gameId: string;
  homeTeam: Team;
  awayTeam: Team;
  inning: number;
  isTop: boolean; // 초/말
  outs: number;
  balls: number;
  strikes: number;
  bases: { first: Player | null; second: Player | null; third: Player | null };
  score: { away: number; home: number };
  inningScores: { away: number[]; home: number[] };
  currentBatter: Player;
  currentPitcher: Player;
  battingOrderAway: Player[];
  battingOrderHome: Player[];
  currentOrderIndexAway: number;
  currentOrderIndexHome: number;
  playLogs: PlayLogEntry[];
  isFinished: boolean;
  boxScore: GameBoxScore;
}
```

### Google Apps Script Integration Details
- 생성되는 Apps Script 코드 (`Code.gs`)는 Google Sheets의 `SpreadsheetApp.getActiveSpreadsheet()` API를 사용합니다.
- 웹앱 URL로 전달된 JSON 페이로드를 파싱하여 다음 6개의 시트를 없으면 자동 생성하고 있으면 깔끔하게 최신 데이터로 리프레시합니다:
  1. `[구단정보]`: 팀명, 소유주, 연고지 홈구장, 역대 우승 횟수, 현재 시즌 승무패 및 승률.
  2. `[타자명단_성적]`: 타율(AVG), 타석(AB), 안타(H), 2루타(2B), 3루타(3B), 홈런(HR), 타점(RBI), 득점(R), 도루(SB), 출루율(OBP), 장타율(SLG), OPS.
  3. `[투수명단_성적]`: 평균자책점(ERA), 다승(W), 패전(L), 세이브(SV), 홀드(HLD), 이닝(IP), 탈삼진(SO), 피안타(H), 사사구(BB), WHIP.
  4. `[리그순위표]`: 1위부터 10위까지 순위, 승, 무, 패, 승률, 게임차, 최근 5경기, 팀 타율, 팀 ERA.
  5. `[경기일정_박스스코어]`: 매 경기 날짜, 상대팀, 이닝별 스코어(R-H-E), 승리/패전/세이브 투수, 결승타.
  6. `[트레이드_드래프트_이력]`: 발생한 트레이드 내역 및 시즌별 신인 드래프트 지명 선수 명단.

---

## 5. Verification & Quality Assurance Plan

1. **시뮬레이션 엔진 무결성**:
   - 9이닝 정규 경기 진행 시 볼카운트(3스트라이크 아웃, 4볼 출루), 3아웃 공수교대, 주자 진루(단타 시 1루 주자 2루/3루, 희생플라이), 잔루(LOB), 연장전(최대 12이닝) 룰 완전 준수 검증.
   - 1구 진행, 1타석 진행, 이닝 스킵, 경기 스킵 버튼이 즉각적인 상태 전환을 일으키는지 확인.
2. **선수 육성 & 로스터 관리**:
   - 1군/2군 교체, 라인업 타순 변경, 투수 보직 변경이 즉각 경기 라인업에 반영되는지 검증.
   - 훈련 포인트 소모 시 스탯 증가 및 경기 후 경험치 누적 확인.
3. **트레이드 & 드래프트**:
   - AI 구단의 논리적인 트레이드 제안 수락/거절 알고리즘 확인.
   - 신인 드래프트 역순 지명 및 선수단 즉시 입단 로직 확인.
4. **Apps Script & 파일 내보내기**:
   - Apps Script 원클릭 복사 기능, Webhook 테스트 페이로드 생성, CSV 및 JSON 백업 파일 정상 다운로드 확인.
5. **빌드 & 린트 통과**:
   - `compile_applet` 및 `lint_applet`을 실행하여 TypeScript 타입 오류 및 린트 경고 제로 상태 확인.
