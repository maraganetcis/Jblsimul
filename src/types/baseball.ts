/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Position = 
  | 'SP' | 'RP' | 'CP' // 투수 (선발, 불펜, 마무리)
  | 'C' | '1B' | '2B' | '3B' | 'SS' // 내야수 & 포수
  | 'LF' | 'CF' | 'RF' // 외야수
  | 'DH'; // 지명타자

export type PotentialGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface BatterStats {
  contact: number;  // 1-99: 타격 정확도
  power: number;    // 1-99: 장타력 및 비거리
  eye: number;      // 1-99: 선구안 (볼 골라내기)
  speed: number;    // 1-99: 주력 (도루 및 추가 진루)
  defense: number;  // 1-99: 수비 안정성 및 송구
  clutch: number;   // 1-99: 득점권 집중력

  // 시즌 누적 성적
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
  caughtStealing: number;
}

export interface PitcherStats {
  velocity: number; // 130 - 160 km/h: 최고 직구 구속
  control: number;  // 1-99: 제구력 (볼넷 억제)
  stuff: number;    // 1-99: 구위 (피안타/피홈런 억제, 탈삼진)
  stamina: number;  // 1-99: 투구수 소화 능력
  clutch: number;   // 1-99: 위기관리 능력
  
  // 구종 숙련도 (1-99)
  repertoire: {
    fourSeam: number;
    slider: number;
    curve: number;
    changeup: number;
    forkball: number;
  };

  // 시즌 누적 성적
  games: number;
  gamesStarted: number;
  inningsOuts: number; // 아웃카운트 단위 (3 outs = 1 inning)
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
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  role: 'BATTER' | 'PITCHER';
  primaryPosition: Position;
  secondaryPosition?: Position;
  tier: 'FIRST_TEAM' | 'SECOND_TEAM';
  age: number;
  potential: PotentialGrade;
  currentStamina: number; // 0 - 100 경기 내 실시간 체력
  condition: number;      // 50 - 100 경기 당일 컨디션
  exp: number;            // 성장 경험치
  level: number;
  isInjured: boolean;
  injuryDays: number;
  
  batterStats?: BatterStats;
  pitcherStats?: PitcherStats;
}

export interface Team {
  id: string;
  name: string;           // e.g. "난하 지도", "지도 지누"
  owner: string;          // e.g. "Jido corp.", "JiNu"
  homeStadium: string;    // e.g. "지도대학교야구장", "지도돔"
  foundedYear: number;
  championships: number;  // 역대 우승 수 (CSV 원본 데이터)
  color: string;          // 구단 메인 컬러 (Hex)
  secondaryColor: string;
  logoInitial: string;
  staminaParkFactor: number; // 1.0 = 표준, 1.1 = 타자친화, 0.9 = 투수친화

  // 재정 및 시설
  budget: number; // 단위: 만원
  facilityLevels: {
    battingCage: number;  // 타격 훈련장
    pitchingLab: number;  // 투구 분석 연구소
    weightRoom: number;   // 웨이트 트레이닝장
    medicalCenter: number;// 의료/재활 센터
  };

  // 시즌 성적
  wins: number;
  losses: number;
  draws: number;
  runsScored: number;
  runsAllowed: number;
}

export interface HistorySeason {
  seasonNumber: number;
  champion: string;
}

export interface PitchResult {
  pitchNumber: number;
  pitchType: string;
  velocity: number;
  zoneRow: number; // 0, 1, 2 (Top, Mid, Low)
  zoneCol: number; // 0, 1, 2 (In, Mid, Out)
  isStrikeZone: boolean;
  isSwing: boolean;
  call: 'BALL' | 'CALLED_STRIKE' | 'SWINGING_STRIKE' | 'FOUL' | 'IN_PLAY';
  outcomeDetail: string;
  hitType?: 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'HOMERUN' | 'GROUNDOUT' | 'FLYOUT' | 'LINEOUT' | 'DOUBLE_PLAY' | 'SAC_FLY' | 'ERROR';
  hitDistance?: number; // 미터
  runsScoredOnPlay: number;
  narrative: string;
}

export interface PlayLogEntry {
  id: string;
  inning: number;
  isTop: boolean;
  batterName: string;
  pitcherName: string;
  balls: number;
  strikes: number;
  outs: number;
  description: string;
  highlightType?: 'HIT' | 'HOMERUN' | 'OUT' | 'STRIKEOUT' | 'WALK' | 'RUN' | 'TACTIC';
}

export interface PlayerGameBoxStat {
  playerId: string;
  teamId: string;
  role: 'BATTER' | 'PITCHER';
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
  caughtStealing: number;
  gamesStarted: number;
  inningsOuts: number;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  earnedRuns: number;
  hitsAllowed: number;
  walksAllowed: number;
  pitcherStrikeouts: number;
  homeRunsAllowed: number;
  pitchesCount: number;
}

export interface LiveGameState {
  gameId: string;
  isUserGame: boolean;
  homeTeam: Team;
  awayTeam: Team;
  inning: number;
  isTop: boolean;
  outs: number;
  balls: number;
  strikes: number;
  bases: {
    first: Player | null;
    second: Player | null;
    third: Player | null;
  };
  score: {
    away: number;
    home: number;
  };
  inningScores: {
    away: number[];
    home: number[];
  };
  hits: {
    away: number;
    home: number;
  };
  errors: {
    away: number;
    home: number;
  };
  
  // 라인업 및 투수
  battingOrderAway: Player[];
  battingOrderHome: Player[];
  orderIndexAway: number;
  orderIndexHome: number;
  currentPitcherAway: Player;
  currentPitcherHome: Player;

  pitchCountAway: number;
  pitchCountHome: number;

  playerBoxStats: Record<string, PlayerGameBoxStat>;

  lastPitch?: PitchResult;
  playLogs: PlayLogEntry[];
  isFinished: boolean;
  winningTeamId?: string;
  losingTeamId?: string;
  savePitcherId?: string;
  winningPitcherId?: string;
  losingPitcherId?: string;
}

export interface ScheduleItem {
  id: string;
  day: number;
  awayTeamId: string;
  homeTeamId: string;
  isPlayed: boolean;
  awayScore?: number;
  homeScore?: number;
}

export interface TradeProposal {
  id: string;
  targetTeamId: string;
  offeredPlayerIds: string[];
  requestedPlayerIds: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  evaluationText: string;
}

export interface DraftProspect {
  id: string;
  name: string;
  role: 'BATTER' | 'PITCHER';
  position: Position;
  school: string; // 고교/대학교
  age: number;
  potential: PotentialGrade;
  scoutReport: string;
  keyStatsPreview: string;
  isDrafted: boolean;
  draftedByTeamId?: string;
  playerData: Player;
}

export interface MatchRecord {
  id: string;
  day: number;
  seasonNumber: number;
  dateStr: string;
  awayTeamName: string;
  homeTeamName: string;
  awayScore: number;
  homeScore: number;
  result: 'WIN' | 'LOSS' | 'DRAW';
  winningTeamName: string;
  awayHits: number;
  homeHits: number;
  awayErrors: number;
  homeErrors: number;
  summary: string;
  isUserMatch?: boolean;
}

export type ApprovalCategory = 'TRADE_INCOMING' | 'TRADE_LEAGUE' | 'PROMOTION_RECOMMEND';

export interface PendingApproval {
  id: string;
  category: ApprovalCategory;
  title: string;
  subtitle: string;
  createdAtDay: number;
  seasonNumber: number;
  fromTeamId: string;
  toTeamId: string;
  offeredPlayer?: Player;
  requestedPlayer?: Player;
  targetPlayer?: Player;
  evaluationSummary: string;
}

export interface AutoGrowthLog {
  id: string;
  day: number;
  seasonNumber: number;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  position: Position;
  newLevel: number;
  statGainText: string;
}

