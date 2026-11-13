/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Team, HistorySeason, Player, Position, PotentialGrade, DraftProspect } from '../types/baseball';

export const INITIAL_JBL_TEAMS: Team[] = [
  {
    id: 'team_jido',
    name: '난하 지도',
    owner: 'Jido corp.',
    homeStadium: '지도대학교야구장',
    foundedYear: 3,
    championships: 5,
    color: '#2563EB', // Royal Blue
    secondaryColor: '#60A5FA',
    logoInitial: 'JD',
    staminaParkFactor: 1.02,
    budget: 500000,
    facilityLevels: { battingCage: 3, pitchingLab: 3, weightRoom: 2, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_cis',
    name: '안소 시스',
    owner: 'CISCT',
    homeStadium: '시스스테디움',
    foundedYear: 7,
    championships: 2,
    color: '#0D9488', // Teal
    secondaryColor: '#2DD4BF',
    logoInitial: 'CS',
    staminaParkFactor: 0.98,
    budget: 420000,
    facilityLevels: { battingCage: 2, pitchingLab: 2, weightRoom: 3, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_shikyak',
    name: '신사 식약',
    owner: '지도식약',
    homeStadium: '챔필',
    foundedYear: 2,
    championships: 4,
    color: '#DC2626', // Crimson Red
    secondaryColor: '#F87171',
    logoInitial: 'SY',
    staminaParkFactor: 0.95, // 투수 친화 구장
    budget: 480000,
    facilityLevels: { battingCage: 2, pitchingLab: 3, weightRoom: 2, medicalCenter: 3 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_limit',
    name: '아세 리미트',
    owner: 'limit airways',
    homeStadium: '아세리미트필드',
    foundedYear: 10,
    championships: 2,
    color: '#4F46E5', // Indigo
    secondaryColor: '#818CF8',
    logoInitial: 'LM',
    staminaParkFactor: 1.05,
    budget: 450000,
    facilityLevels: { battingCage: 3, pitchingLab: 2, weightRoom: 2, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_hangye',
    name: '신여 한계',
    owner: '한계메디컬',
    homeStadium: '그랜드파크',
    foundedYear: 11,
    championships: 1,
    color: '#059669', // Emerald
    secondaryColor: '#34D399',
    logoInitial: 'HG',
    staminaParkFactor: 1.0,
    budget: 390000,
    facilityLevels: { battingCage: 2, pitchingLab: 2, weightRoom: 2, medicalCenter: 4 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_rogan',
    name: '서강 로간',
    owner: '로간선박',
    homeStadium: '서강구장',
    foundedYear: 4,
    championships: 5,
    color: '#D97706', // Amber/Navy
    secondaryColor: '#FBBF24',
    logoInitial: 'RG',
    staminaParkFactor: 1.08, // 타자 친화 구장
    budget: 520000,
    facilityLevels: { battingCage: 4, pitchingLab: 2, weightRoom: 3, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_shijak',
    name: '부서 시작',
    owner: '시작 운송',
    homeStadium: '부서구장',
    foundedYear: 3,
    championships: 2,
    color: '#EA580C', // Orange
    secondaryColor: '#FB923C',
    logoInitial: 'SJ',
    staminaParkFactor: 1.0,
    budget: 400000,
    facilityLevels: { battingCage: 2, pitchingLab: 2, weightRoom: 2, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_xer',
    name: '마성 엑설',
    owner: 'XER airlines',
    homeStadium: '마성엑설구장',
    foundedYear: 5,
    championships: 1,
    color: '#7C3AED', // Purple
    secondaryColor: '#A78BFA',
    logoInitial: 'XR',
    staminaParkFactor: 1.04,
    budget: 380000,
    facilityLevels: { battingCage: 2, pitchingLab: 2, weightRoom: 3, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_bygle',
    name: '파천 바이글',
    owner: '바이글 모터스',
    homeStadium: '파천스피드파크',
    foundedYear: 9,
    championships: 1,
    color: '#0284C7', // Sky Blue
    secondaryColor: '#38BDF8',
    logoInitial: 'BG',
    staminaParkFactor: 0.96,
    budget: 410000,
    facilityLevels: { battingCage: 2, pitchingLab: 3, weightRoom: 2, medicalCenter: 2 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
  {
    id: 'team_jinu',
    name: '지도 지누',
    owner: 'JiNu',
    homeStadium: '지도돔',
    foundedYear: 8,
    championships: 2, // 24회, 25회 연속 우승팀!
    color: '#E11D48', // Rose Red
    secondaryColor: '#FB7185',
    logoInitial: 'JN',
    staminaParkFactor: 1.12, // 돔구장 & 대형 펜스
    budget: 550000,
    facilityLevels: { battingCage: 4, pitchingLab: 4, weightRoom: 3, medicalCenter: 3 },
    wins: 0,
    losses: 0,
    draws: 0,
    runsScored: 0,
    runsAllowed: 0,
  },
];

// JBL 1회차 ~ 25회차 역대 우승 족보 (CSV 데이터 원본 반영)
export const JBL_HISTORICAL_CHAMPIONS: HistorySeason[] = [
  { seasonNumber: 1, champion: '신사 식약' },
  { seasonNumber: 2, champion: '신사 식약' },
  { seasonNumber: 3, champion: '난하 지도' },
  { seasonNumber: 4, champion: '서강 로간' },
  { seasonNumber: 5, champion: '서강 로간' },
  { seasonNumber: 6, champion: '부서 시작' },
  { seasonNumber: 7, champion: '파천 바이글' },
  { seasonNumber: 8, champion: '신사 식약' },
  { seasonNumber: 9, champion: '마성 엑설' },
  { seasonNumber: 10, champion: '난하 지도' },
  { seasonNumber: 11, champion: '난하 지도' },
  { seasonNumber: 12, champion: '서강 로간' },
  { seasonNumber: 13, champion: '서강 로간' },
  { seasonNumber: 14, champion: '서강 로간' },
  { seasonNumber: 15, champion: '난하 지도' },
  { seasonNumber: 16, champion: '난하 지도' },
  { seasonNumber: 17, champion: '신사 식약' },
  { seasonNumber: 18, champion: '부서 시작' },
  { seasonNumber: 19, champion: '아세 리미트' },
  { seasonNumber: 20, champion: '안소 시스' },
  { seasonNumber: 21, champion: '아세 리미트' },
  { seasonNumber: 22, champion: '안소 시스' },
  { seasonNumber: 23, champion: '신여 한계' },
  { seasonNumber: 24, champion: '지도 지누' },
  { seasonNumber: 25, champion: '지도 지누' },
];

// 선수 이름 생성 풀
const KOREAN_LAST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '고', '문', '양', '손', '배', '백', '허', '유', '남', '심'];
const KOREAN_FIRST_NAMES = [
  '현우', '도현', '민재', '서진', '지후', '하준', '도윤', '시우', '예준', '건우',
  '선우', '민준', '우진', '지훈', '승우', '준혁', '유준', '은우', '시윤', '동현',
  '승현', '태윤', '성민', '재원', '진우', '현준', '지원', '태양', '정우', '민성',
  '준서', '상원', '강민', '영호', '찬우', '병헌', '재민', '광현', '대호', '정후',
  '의지', '세웅', '창민', '형우', '성범', '동원', '선동', '찬호', '종범', '승엽'
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generatePlayer(teamId: string, role: 'BATTER' | 'PITCHER', position: Position, tier: 'FIRST_TEAM' | 'SECOND_TEAM', potential?: PotentialGrade): Player {
  const name = `${getRandomItem(KOREAN_LAST_NAMES)}${getRandomItem(KOREAN_FIRST_NAMES)}`;
  const grade: PotentialGrade = potential || (Math.random() < 0.05 ? 'S' : Math.random() < 0.2 ? 'A' : Math.random() < 0.5 ? 'B' : Math.random() < 0.85 ? 'C' : 'D');
  const baseBoost = grade === 'S' ? 12 : grade === 'A' ? 7 : grade === 'B' ? 2 : grade === 'C' ? -3 : -8;
  const isSecondTeam = tier === 'SECOND_TEAM';
  const tierMod = isSecondTeam ? -8 : 0;
  const age = isSecondTeam ? getRandomInt(19, 24) : getRandomInt(23, 34);

  const player: Player = {
    id: `p_${teamId}_${Math.random().toString(36).substring(2, 9)}`,
    name,
    teamId,
    role,
    primaryPosition: position,
    tier,
    age,
    potential: grade,
    currentStamina: 100,
    condition: getRandomInt(75, 100),
    exp: 0,
    level: isSecondTeam ? getRandomInt(1, 3) : getRandomInt(3, 8),
    isInjured: false,
    injuryDays: 0,
  };

  if (role === 'BATTER') {
    player.batterStats = {
      contact: Math.min(99, Math.max(40, getRandomInt(55, 82) + baseBoost + tierMod)),
      power: Math.min(99, Math.max(35, getRandomInt(50, 85) + baseBoost + tierMod)),
      eye: Math.min(99, Math.max(40, getRandomInt(52, 80) + baseBoost + tierMod)),
      speed: Math.min(99, Math.max(40, getRandomInt(50, 88) + baseBoost + tierMod)),
      defense: Math.min(99, Math.max(45, getRandomInt(55, 84) + baseBoost + tierMod)),
      clutch: Math.min(99, Math.max(40, getRandomInt(50, 80) + baseBoost)),
      games: 0,
      atBats: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      rbi: 0,
      runs: 0,
      walks: 0,
      strikeouts: 0,
      stolenBases: 0,
      caughtStealing: 0,
    };
  } else {
    const isSP = position === 'SP';
    player.pitcherStats = {
      velocity: getRandomInt(140, 153) + (grade === 'S' ? 4 : grade === 'A' ? 2 : 0) + (isSecondTeam ? -3 : 0),
      control: Math.min(99, Math.max(40, getRandomInt(52, 82) + baseBoost + tierMod)),
      stuff: Math.min(99, Math.max(45, getRandomInt(55, 86) + baseBoost + tierMod)),
      stamina: isSP ? Math.min(99, Math.max(65, getRandomInt(70, 92) + baseBoost)) : Math.min(99, Math.max(40, getRandomInt(45, 65))),
      clutch: Math.min(99, Math.max(40, getRandomInt(50, 82) + baseBoost)),
      repertoire: {
        fourSeam: Math.min(99, getRandomInt(65, 88) + baseBoost),
        slider: Math.min(99, getRandomInt(50, 85) + baseBoost),
        curve: Math.min(99, getRandomInt(45, 80) + baseBoost),
        changeup: Math.min(99, getRandomInt(40, 80) + baseBoost),
        forkball: Math.min(99, getRandomInt(40, 78) + baseBoost),
      },
      games: 0,
      gamesStarted: 0,
      inningsOuts: 0,
      wins: 0,
      losses: 0,
      saves: 0,
      holds: 0,
      earnedRuns: 0,
      hitsAllowed: 0,
      walksAllowed: 0,
      strikeouts: 0,
      homeRunsAllowed: 0,
      pitchesCount: 0,
    };
  }

  return player;
}

export function generateTeamRoster(teamId: string): Player[] {
  const players: Player[] = [];

  // 1군 투수진: 선발 5명, 불펜 4명, 마무리 1명 = 10명
  for (let i = 0; i < 5; i++) {
    players.push(generatePlayer(teamId, 'PITCHER', 'SP', 'FIRST_TEAM'));
  }
  for (let i = 0; i < 4; i++) {
    players.push(generatePlayer(teamId, 'PITCHER', 'RP', 'FIRST_TEAM'));
  }
  players.push(generatePlayer(teamId, 'PITCHER', 'CP', 'FIRST_TEAM', 'A'));

  // 1군 야수진: C, 1B, 2B, 3B, SS, LF, CF, RF, DH + 백업 3명 = 12명
  const mainPositions: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  mainPositions.forEach((pos) => {
    players.push(generatePlayer(teamId, 'BATTER', pos, 'FIRST_TEAM'));
  });
  players.push(generatePlayer(teamId, 'BATTER', 'C', 'FIRST_TEAM')); // 백업 포수
  players.push(generatePlayer(teamId, 'BATTER', 'SS', 'FIRST_TEAM')); // 백업 내야
  players.push(generatePlayer(teamId, 'BATTER', 'CF', 'FIRST_TEAM')); // 백업 외야

  // 2군 유망주: 투수 4명, 타자 4명 = 8명
  players.push(generatePlayer(teamId, 'PITCHER', 'SP', 'SECOND_TEAM'));
  players.push(generatePlayer(teamId, 'PITCHER', 'SP', 'SECOND_TEAM'));
  players.push(generatePlayer(teamId, 'PITCHER', 'RP', 'SECOND_TEAM'));
  players.push(generatePlayer(teamId, 'PITCHER', 'CP', 'SECOND_TEAM'));

  players.push(generatePlayer(teamId, 'BATTER', 'C', 'SECOND_TEAM'));
  players.push(generatePlayer(teamId, 'BATTER', 'SS', 'SECOND_TEAM'));
  players.push(generatePlayer(teamId, 'BATTER', '1B', 'SECOND_TEAM'));
  players.push(generatePlayer(teamId, 'BATTER', 'CF', 'SECOND_TEAM'));

  return players;
}

export function generateAllLeaguePlayers(teams: Team[]): Record<string, Player[]> {
  const rosterMap: Record<string, Player[]> = {};
  teams.forEach((team) => {
    rosterMap[team.id] = generateTeamRoster(team.id);
  });
  return rosterMap;
}

// 신인 드래프트 풀 생성 (고교/대학 유망주 20명)
export function generateDraftProspects(): DraftProspect[] {
  const schools = ['덕수고', '유신고', '북일고', '휘문고', '경남고', '광주일고', '연세대', '고려대', '성균관대', '동국대'];
  const prospects: DraftProspect[] = [];

  const specs = [
    { name: '강시우', role: 'PITCHER' as const, pos: 'SP' as const, pot: 'S' as const, note: '최고 156km/h 강속구와 낙차 큰 슬라이더를 구사하는 고교 최대어' },
    { name: '박태양', role: 'BATTER' as const, pos: 'SS' as const, pot: 'S' as const, note: '타격 천재로 불리며 빠른 배트 스피드와 넓은 수비 범위를 자랑하는 5툴 유격수' },
    { name: '김건우', role: 'PITCHER' as const, pos: 'SP' as const, pot: 'A' as const, note: '칼날 제구력과 3가지 이상의 변화구를 마음대로 꽂아 넣는 완성형 좌완 선발' },
    { name: '이도현', role: 'BATTER' as const, pos: '1B' as const, pot: 'A' as const, note: '체격 조건이 압도적이며 밀어쳐서도 장외 홈런을 만들어내는 거포 유망주' },
    { name: '최준혁', role: 'BATTER' as const, pos: 'CF' as const, pot: 'A' as const, note: '100m 11초 초반의 준족에 타구 판단 능력이 뛰어난 리드오프 중견수 자원' },
    { name: '정하준', role: 'PITCHER' as const, pos: 'CP' as const, pot: 'A' as const, note: '150km/h 묵직한 돌직구와 날카로운 포크볼로 삼진을 쓸어 담는 클로저형 투수' },
    { name: '윤민재', role: 'BATTER' as const, pos: 'C' as const, pot: 'A' as const, note: '강한 어깨(팝타임 1.88초)와 탁월한 투수 리드를 지닌 차세대 안방마님' },
    { name: '장예준', role: 'PITCHER' as const, pos: 'SP' as const, pot: 'B' as const, note: '구속보다는 회전수와 무브먼트가 돋보이는 테크니션 우완 투수' },
    { name: '임우진', role: 'BATTER' as const, pos: '3B' as const, pot: 'B' as const, note: '강한 손목 힘을 바탕으로 한 장타 생산력과 강견 핫코너 수비수' },
    { name: '한선우', role: 'PITCHER' as const, pos: 'RP' as const, pot: 'B' as const, note: '좌타자 킬러 슬라이더를 장착한 대학 리그 최고의 좌완 셋업맨' },
    { name: '오동현', role: 'BATTER' as const, pos: '2B' as const, pot: 'B' as const, note: '뛰어난 컨택 능력과 야구 센스로 삼진을 거의 당하지 않는 교타자' },
    { name: '서유준', role: 'PITCHER' as const, pos: 'SP' as const, pot: 'B' as const, note: '체력과 이닝 소화력이 뛰어난 대학 무대 최다승 선발 자원' },
    { name: '신승현', role: 'BATTER' as const, pos: 'RF' as const, pot: 'B' as const, note: '외야 전 포지션 소화 가능하며 보살 능력이 뛰어난 레이저 송구의 주인공' },
    { name: '권도윤', role: 'BATTER' as const, pos: 'LF' as const, pot: 'C' as const, note: '공격력에 장점이 있는 중장거리 타자' },
    { name: '황은우', role: 'PITCHER' as const, pos: 'RP' as const, pot: 'C' as const, note: '사이드암 특유의 까다로운 궤적으로 땅볼을 잘 유도하는 언더핸드' },
    { name: '안재원', role: 'BATTER' as const, pos: 'C' as const, pot: 'C' as const, note: '포구와 블로킹 기본기가 탄탄한 수비형 포수 유망주' },
  ];

  specs.forEach((s, idx) => {
    const school = getRandomItem(schools);
    const age = school.endsWith('고') ? 19 : 23;
    const dummyPlayer = generatePlayer('draft_pool', s.role, s.pos, 'SECOND_TEAM', s.pot);
    dummyPlayer.name = s.name;
    dummyPlayer.age = age;

    prospects.push({
      id: `draft_${idx + 1}`,
      name: s.name,
      role: s.role,
      position: s.pos,
      school,
      age,
      potential: s.pot,
      scoutReport: s.note,
      keyStatsPreview: s.role === 'PITCHER' ? `구속 ${dummyPlayer.pitcherStats?.velocity}km/h · 구위 ${dummyPlayer.pitcherStats?.stuff}` : `컨택 ${dummyPlayer.batterStats?.contact} · 파워 ${dummyPlayer.batterStats?.power}`,
      isDrafted: false,
      playerData: dummyPlayer,
    });
  });

  return prospects;
}
