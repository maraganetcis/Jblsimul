/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AutoGrowthLog,
  AwardWinnerEntry,
  FreeAgent,
  LeagueNewsItem,
  LiveGameState,
  PendingApproval,
  PitchResult,
  PlayLogEntry,
  Player,
  PlayerGameBoxStat,
  Position,
  PostseasonSeries,
  PostseasonState,
  SeasonAwardRecord,
  Team,
} from '../types/baseball';
import { generatePlayer } from '../data/initialLeagueData';
import { soundEffects } from './audio';

export type TacticChoice = 'NORMAL' | 'BUNT' | 'STEAL' | 'INTENTIONAL_WALK' | 'HIT_AND_RUN';

function createEmptyBoxStat(player: Player, isStartingPitcher = false): PlayerGameBoxStat {
  return {
    playerId: player.id,
    teamId: player.teamId,
    role: player.role,
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
    gamesStarted: isStartingPitcher ? 1 : 0,
    inningsOuts: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    holds: 0,
    earnedRuns: 0,
    hitsAllowed: 0,
    walksAllowed: 0,
    pitcherStrikeouts: 0,
    homeRunsAllowed: 0,
    pitchesCount: 0,
  };
}

function ensureBoxStat(
  boxMap: Record<string, PlayerGameBoxStat>,
  player: Player,
  isStartingPitcher = false
): Record<string, PlayerGameBoxStat> {
  if (boxMap[player.id]) return boxMap;
  return {
    ...boxMap,
    [player.id]: createEmptyBoxStat(player, isStartingPitcher),
  };
}

function updateBoxStat(
  boxMap: Record<string, PlayerGameBoxStat>,
  player: Player,
  updater: (prev: PlayerGameBoxStat) => PlayerGameBoxStat
): Record<string, PlayerGameBoxStat> {
  const curr = boxMap[player.id] || createEmptyBoxStat(player);
  return {
    ...boxMap,
    [player.id]: updater({ ...curr }),
  };
}

export function createNewGame(
  awayTeam: Team,
  homeTeam: Team,
  awayRoster: Player[],
  homeRoster: Player[],
  options?: { isUserGame?: boolean; rotationDay?: number; autoBullpen?: boolean }
): LiveGameState {
  const healthyAwayBatters = awayRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM' && !p.isInjured).slice(0, 9);
  const healthyHomeBatters = homeRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM' && !p.isInjured).slice(0, 9);

  const awayBatters =
    healthyAwayBatters.length >= 9
      ? healthyAwayBatters
      : awayRoster.filter(p => p.role === 'BATTER' && !p.isInjured).slice(0, 9);
  const homeBatters =
    healthyHomeBatters.length >= 9
      ? healthyHomeBatters
      : homeRoster.filter(p => p.role === 'BATTER' && !p.isInjured).slice(0, 9);

  // Fallback if roster has fewer than 9 healthy batters
  const safeAwayBatters = awayBatters.length > 0 ? awayBatters : awayRoster.filter(p => p.role === 'BATTER').slice(0, 9);
  const safeHomeBatters = homeBatters.length > 0 ? homeBatters : homeRoster.filter(p => p.role === 'BATTER').slice(0, 9);

  const awaySPs = awayRoster.filter(p => p.role === 'PITCHER' && p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM' && !p.isInjured);
  const homeSPs = homeRoster.filter(p => p.role === 'PITCHER' && p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM' && !p.isInjured);

  const rotIdx = Math.max(0, (options?.rotationDay || 1) - 1);
  const awaySP =
    awaySPs[rotIdx % Math.max(1, awaySPs.length)] ||
    awayRoster.find(p => p.role === 'PITCHER' && !p.isInjured) ||
    awayRoster.find(p => p.role === 'PITCHER')!;
  const homeSP =
    homeSPs[rotIdx % Math.max(1, homeSPs.length)] ||
    homeRoster.find(p => p.role === 'PITCHER' && !p.isInjured) ||
    homeRoster.find(p => p.role === 'PITCHER')!;

  const awayBullpenFirst = awayRoster.filter(
    p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && !p.isInjured && p.id !== awaySP?.id
  );
  const homeBullpenFirst = homeRoster.filter(
    p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && !p.isInjured && p.id !== homeSP?.id
  );
  const bullpenAway =
    awayBullpenFirst.length > 0
      ? awayBullpenFirst
      : awayRoster.filter(p => p.role === 'PITCHER' && !p.isInjured && p.id !== awaySP?.id);
  const bullpenHome =
    homeBullpenFirst.length > 0
      ? homeBullpenFirst
      : homeRoster.filter(p => p.role === 'PITCHER' && !p.isInjured && p.id !== homeSP?.id);

  let initialBoxStats: Record<string, PlayerGameBoxStat> = {};
  safeAwayBatters.forEach(b => {
    initialBoxStats = ensureBoxStat(initialBoxStats, b, false);
  });
  safeHomeBatters.forEach(b => {
    initialBoxStats = ensureBoxStat(initialBoxStats, b, false);
  });
  if (awaySP) initialBoxStats = ensureBoxStat(initialBoxStats, awaySP, true);
  if (homeSP) initialBoxStats = ensureBoxStat(initialBoxStats, homeSP, true);

  return {
    gameId: `game_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    isUserGame: options?.isUserGame ?? true,
    homeTeam,
    awayTeam,
    inning: 1,
    isTop: true,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 0 },
    inningScores: {
      away: [0],
      home: [],
    },
    hits: { away: 0, home: 0 },
    errors: { away: 0, home: 0 },
    battingOrderAway: safeAwayBatters,
    battingOrderHome: safeHomeBatters,
    orderIndexAway: 0,
    orderIndexHome: 0,
    currentPitcherAway: { ...awaySP },
    currentPitcherHome: { ...homeSP },
    pitchCountAway: 0,
    pitchCountHome: 0,
    bullpenAway,
    bullpenHome,
    usedPitcherIdsAway: awaySP ? [awaySP.id] : [],
    usedPitcherIdsHome: homeSP ? [homeSP.id] : [],
    autoBullpen: options?.autoBullpen ?? true,
    playerBoxStats: initialBoxStats,
    playLogs: [
      {
        id: `log_start`,
        inning: 1,
        isTop: true,
        batterName: safeAwayBatters[0]?.name || '타자',
        pitcherName: homeSP?.name || '투수',
        balls: 0,
        strikes: 0,
        outs: 0,
        description: `⚾ ${homeTeam.homeStadium}에서 펼쳐지는 ${awayTeam.name} vs ${homeTeam.name}의 경기가 시작됩니다! 선발 투수: ${homeSP?.name}(${homeTeam.name}) vs ${awaySP?.name}(${awayTeam.name})`,
        highlightType: 'TACTIC',
      }
    ],
    isFinished: false,
  };
}

function maybeAutoSubstituteBullpen(state: LiveGameState): LiveGameState {
  if (state.isFinished || state.autoBullpen === false) return state;
  // 새 타석 시작(0-0 카운트)일 때만 자연스럽게 투수 교체
  if (state.balls !== 0 || state.strikes !== 0) return state;

  const isHomeDefending = state.isTop;
  const defendingTeam = isHomeDefending ? state.homeTeam : state.awayTeam;
  const currentPitcher = isHomeDefending ? state.currentPitcherHome : state.currentPitcherAway;
  const pitchCount = isHomeDefending ? state.pitchCountHome : state.pitchCountAway;
  const bullpen = isHomeDefending ? (state.bullpenHome || []) : (state.bullpenAway || []);
  const usedIds = isHomeDefending
    ? (state.usedPitcherIdsHome || [currentPitcher.id])
    : (state.usedPitcherIdsAway || [currentPitcher.id]);

  if (!currentPitcher || bullpen.length === 0) return state;

  const available = bullpen.filter(p => !usedIds.includes(p.id) && p.id !== currentPitcher.id && !p.isInjured);
  if (available.length === 0) return state;

  const defendingScore = isHomeDefending ? state.score.home : state.score.away;
  const attackingScore = isHomeDefending ? state.score.away : state.score.home;
  const lead = defendingScore - attackingScore;
  const isSaveSituation = state.inning >= 9 && lead > 0 && lead <= 3;

  const box = state.playerBoxStats?.[currentPitcher.id];
  const earnedRuns = box?.earnedRuns || 0;
  const hitsAllowed = box?.hitsAllowed || 0;
  const stamina = currentPitcher.pitcherStats?.stamina || 70;

  let shouldSub = false;
  let subReason = '';

  if (currentPitcher.primaryPosition === 'SP') {
    const spLimit = Math.round(78 + (stamina - 60) * 0.65);
    if (isSaveSituation && available.some(p => p.primaryPosition === 'CP')) {
      shouldSub = true;
      subReason = '9회 세이브 상황 마무리 투입';
    } else if (pitchCount >= spLimit) {
      shouldSub = true;
      subReason = `투구수 한계(${pitchCount}구) 도달`;
    } else if (state.inning >= 5 && pitchCount >= 62 && (earnedRuns >= 4 || hitsAllowed >= 7)) {
      shouldSub = true;
      subReason = '실점 누적·피안타 관리 교체';
    }
  } else if (currentPitcher.primaryPosition === 'RP') {
    const rpLimit = Math.round(24 + (stamina - 60) * 0.25);
    if (isSaveSituation && available.some(p => p.primaryPosition === 'CP')) {
      shouldSub = true;
      subReason = '9회 세이브 상황 마무리 투입';
    } else if (pitchCount >= rpLimit) {
      shouldSub = true;
      subReason = `구원 투구수 피로(${pitchCount}구)`;
    } else if (pitchCount >= 12 && earnedRuns >= 3) {
      shouldSub = true;
      subReason = '위기 상황 필승조 조기 가동';
    }
  } else if (currentPitcher.primaryPosition === 'CP') {
    const cpLimit = Math.round(32 + (stamina - 60) * 0.2);
    if (pitchCount >= cpLimit) {
      shouldSub = true;
      subReason = `마무리 투구수 한계(${pitchCount}구)`;
    }
  }

  if (!shouldSub) return state;

  const scorePitcherFit = (p: Player) => {
    const st = p.pitcherStats;
    const base = (st?.control || 60) + (st?.stuff || 60) + ((st?.velocity || 140) - 130);
    if (isSaveSituation) {
      if (p.primaryPosition === 'CP') return base + 200;
      if (p.primaryPosition === 'RP') return base + 80;
      return base;
    }
    if (state.inning >= 6) {
      if (p.primaryPosition === 'RP') return base + 120;
      if (p.primaryPosition === 'CP' && state.inning >= 9) return base + 100;
      return base;
    }
    if (p.primaryPosition === 'RP') return base + 100;
    if (p.primaryPosition === 'SP') return base + 60;
    return base;
  };

  const nextPitcher = [...available].sort((a, b) => scorePitcherFit(b) - scorePitcherFit(a))[0];
  if (!nextPitcher) return state;

  let nextBoxStats = { ...(state.playerBoxStats || {}) };
  // 중간 계투가 6~8회 리드 상황에서 아웃카운트를 잡고 내려갈 때 홀드 부여
  if (
    currentPitcher.primaryPosition !== 'SP' &&
    state.inning >= 6 &&
    state.inning <= 8 &&
    lead > 0 &&
    lead <= 3 &&
    (box?.inningsOuts || 0) >= 1
  ) {
    nextBoxStats = updateBoxStat(nextBoxStats, currentPitcher, s => ({ ...s, holds: s.holds + 1 }));
  }
  nextBoxStats = ensureBoxStat(nextBoxStats, nextPitcher, false);

  const subLog: PlayLogEntry = {
    id: `autobp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    inning: state.inning,
    isTop: state.isTop,
    batterName: '',
    pitcherName: nextPitcher.name,
    balls: state.balls,
    strikes: state.strikes,
    outs: state.outs,
    description: `🔄 [자동 불펜 교체] ${defendingTeam.name} 벤치 가동! ${currentPitcher.name}(${pitchCount}구) → ${nextPitcher.name}(${nextPitcher.primaryPosition}, ${nextPitcher.pitcherStats?.velocity || 144}km/h) 등판 (${subReason})`,
    highlightType: 'TACTIC',
  };

  if (isHomeDefending) {
    return {
      ...state,
      currentPitcherHome: { ...nextPitcher },
      pitchCountHome: 0,
      usedPitcherIdsHome: [...usedIds, nextPitcher.id],
      playerBoxStats: nextBoxStats,
      playLogs: [subLog, ...state.playLogs],
    };
  }
  return {
    ...state,
    currentPitcherAway: { ...nextPitcher },
    pitchCountAway: 0,
    usedPitcherIdsAway: [...usedIds, nextPitcher.id],
    playerBoxStats: nextBoxStats,
    playLogs: [subLog, ...state.playLogs],
  };
}

export function simulateNextPitch(
  rawState: LiveGameState,
  tactic: TacticChoice = 'NORMAL',
  silent = false
): LiveGameState {
  if (rawState.isFinished) return rawState;

  const state = tactic === 'NORMAL' ? maybeAutoSubstituteBullpen(rawState) : rawState;

  const currentBatters = state.isTop ? state.battingOrderAway : state.battingOrderHome;
  const currentOrderIdx = state.isTop ? state.orderIndexAway : state.orderIndexHome;
  const currentBatter = currentBatters[currentOrderIdx % currentBatters.length];
  const currentPitcher = state.isTop ? state.currentPitcherHome : state.currentPitcherAway;

  if (!currentBatter || !currentPitcher) {
    return { ...state, isFinished: true };
  }

  let newBalls = state.balls;
  let newStrikes = state.strikes;
  let newOuts = state.outs;
  let newBases = { ...state.bases };
  const newScore = { ...state.score };
  const newHits = { ...state.hits };
  const newErrors = { ...state.errors };
  const newInningScores = {
    away: [...state.inningScores.away],
    home: [...state.inningScores.home],
  };

  let boxStats = { ...(state.playerBoxStats || {}) };
  boxStats = ensureBoxStat(boxStats, currentBatter);
  boxStats = ensureBoxStat(boxStats, currentPitcher);

  const currentPitchCount = (state.isTop ? state.pitchCountHome : state.pitchCountAway) + 1;
  const nextPitchCountAway = state.isTop ? state.pitchCountAway : currentPitchCount;
  const nextPitchCountHome = state.isTop ? currentPitchCount : state.pitchCountHome;

  // 투수 투구수 누적
  boxStats = updateBoxStat(boxStats, currentPitcher, s => ({
    ...s,
    pitchesCount: s.pitchesCount + 1,
  }));

  // 구종 선택
  const pitchTypes = ['직구', '슬라이더', '커브', '체인지업', '포크볼'];
  const pitchType = pitchTypes[Math.floor(Math.random() * pitchTypes.length)];
  const baseVelo = currentPitcher.pitcherStats?.velocity || 144;
  const staminaPenalty = Math.max(0, (currentPitchCount - 65) * 0.1);
  const velocity = Math.round(baseVelo - staminaPenalty + (Math.random() * 4 - 2));

  // 고의사구 처리
  if (tactic === 'INTENTIONAL_WALK') {
    if (!silent) soundEffects.playUmpireCall(false);
    const advanceResult = advanceRunnersOnWalk(newBases, currentBatter);
    newBases = advanceResult.bases;
    if (advanceResult.runsScored > 0) {
      if (state.isTop) {
        newScore.away += advanceResult.runsScored;
        newInningScores.away[state.inning - 1] = (newInningScores.away[state.inning - 1] || 0) + advanceResult.runsScored;
      } else {
        newScore.home += advanceResult.runsScored;
        newInningScores.home[state.inning - 1] = (newInningScores.home[state.inning - 1] || 0) + advanceResult.runsScored;
      }
      boxStats = updateBoxStat(boxStats, currentBatter, s => ({ ...s, rbi: s.rbi + advanceResult.runsScored }));
      boxStats = updateBoxStat(boxStats, currentPitcher, s => ({ ...s, earnedRuns: s.earnedRuns + advanceResult.runsScored }));
      advanceResult.scoredRunners.forEach(r => {
        boxStats = updateBoxStat(boxStats, r, s => ({ ...s, runs: s.runs + 1 }));
      });
    }
    boxStats = updateBoxStat(boxStats, currentBatter, s => ({ ...s, walks: s.walks + 1 }));
    boxStats = updateBoxStat(boxStats, currentPitcher, s => ({ ...s, walksAllowed: s.walksAllowed + 1 }));

    const logText = `${currentPitcher.name} 투수, ${currentBatter.name} 타자에게 벤치의 지시로 고의사구를 허용합니다. (1루 출루)`;
    return finalizePlateAppearance(
      { ...state, pitchCountAway: nextPitchCountAway, pitchCountHome: nextPitchCountHome, playerBoxStats: boxStats },
      logText,
      'WALK',
      newBases,
      newScore,
      newInningScores,
      newHits,
      newErrors,
      newOuts,
      undefined,
      silent
    );
  }

  // 도루 시도 처리
  if (tactic === 'STEAL' && (newBases.first || newBases.second)) {
    const runner = newBases.first || newBases.second;
    const runnerSpeed = runner?.batterStats?.speed || 60;
    const catcherDefense = 70;
    const isSuccess = Math.random() * 100 < (runnerSpeed * 0.9 - catcherDefense * 0.2 + 25);

    if (isSuccess) {
      if (!silent) soundEffects.playCrowdCheer(false);
      if (newBases.first && !newBases.second) {
        newBases.second = newBases.first;
        newBases.first = null;
      } else if (newBases.second && !newBases.third) {
        newBases.third = newBases.second;
        newBases.second = null;
      }
      if (runner) {
        boxStats = updateBoxStat(boxStats, runner, s => ({ ...s, stolenBases: s.stolenBases + 1 }));
      }
      const logEntry: PlayLogEntry = {
        id: `steal_${Date.now()}_${Math.random()}`,
        inning: state.inning,
        isTop: state.isTop,
        batterName: currentBatter.name,
        pitcherName: currentPitcher.name,
        balls: state.balls,
        strikes: state.strikes,
        outs: state.outs,
        description: `⚡ ${runner?.name} 주자의 전격적인 도루 시도! 포수의 송구보다 빠르게 베이스를 훔쳐냅니다! (도루 성공)`,
        highlightType: 'TACTIC',
      };
      return {
        ...state,
        pitchCountAway: nextPitchCountAway,
        pitchCountHome: nextPitchCountHome,
        playerBoxStats: boxStats,
        bases: newBases,
        playLogs: [logEntry, ...state.playLogs],
      };
    } else {
      if (!silent) {
        soundEffects.playCatch();
        soundEffects.playUmpireCall(false);
      }
      newOuts += 1;
      if (newBases.first) newBases.first = null;
      else if (newBases.second) newBases.second = null;

      if (runner) {
        boxStats = updateBoxStat(boxStats, runner, s => ({ ...s, caughtStealing: s.caughtStealing + 1 }));
      }
      boxStats = updateBoxStat(boxStats, currentPitcher, s => ({ ...s, inningsOuts: s.inningsOuts + 1 }));

      const logEntry: PlayLogEntry = {
        id: `steal_fail_${Date.now()}_${Math.random()}`,
        inning: state.inning,
        isTop: state.isTop,
        batterName: currentBatter.name,
        pitcherName: currentPitcher.name,
        balls: state.balls,
        strikes: state.strikes,
        outs: newOuts,
        description: `❌ ${runner?.name} 주자의 무리한 도루 시도! 포수의 정확한 2루 송구에 태그아웃 됩니다!`,
        highlightType: 'OUT',
      };
      if (newOuts >= 3) {
        return handleInningChange({
          ...state,
          pitchCountAway: nextPitchCountAway,
          pitchCountHome: nextPitchCountHome,
          playerBoxStats: boxStats,
          outs: newOuts,
          bases: newBases,
          playLogs: [logEntry, ...state.playLogs],
        }, silent);
      }
      return {
        ...state,
        pitchCountAway: nextPitchCountAway,
        pitchCountHome: nextPitchCountHome,
        playerBoxStats: boxStats,
        outs: newOuts,
        bases: newBases,
        playLogs: [logEntry, ...state.playLogs],
      };
    }
  }

  // 스트라이크존 투구 확률 계산
  const control = currentPitcher.pitcherStats?.control || 60;
  const eye = currentBatter.batterStats?.eye || 60;
  const contact = currentBatter.batterStats?.contact || 60;
  const power = currentBatter.batterStats?.power || 60;
  const stuff = currentPitcher.pitcherStats?.stuff || 60;

  const inZoneProb = 0.52 + (control - 60) * 0.003;
  const isStrikeZone = Math.random() < inZoneProb;
  const zoneRow = isStrikeZone ? Math.floor(Math.random() * 3) : (Math.random() < 0.5 ? -1 : 3);
  const zoneCol = isStrikeZone ? Math.floor(Math.random() * 3) : (Math.random() < 0.5 ? -1 : 3);

  // 타자 스윙 여부 결정
  const swingProb = isStrikeZone
    ? 0.72 + (contact - stuff) * 0.002
    : Math.max(0.12, 0.32 - (eye - 60) * 0.004 + (state.strikes === 2 ? 0.22 : 0));
  const isSwing = tactic === 'BUNT' ? true : Math.random() < swingProb;

  let pitchResult: PitchResult;

  if (!isSwing) {
    if (isStrikeZone) {
      newStrikes += 1;
      if (!silent) {
        soundEffects.playCatch();
        soundEffects.playUmpireCall(newStrikes === 3);
      }
      pitchResult = {
        pitchNumber: currentPitchCount,
        pitchType,
        velocity,
        zoneRow: Math.max(0, Math.min(2, zoneRow)),
        zoneCol: Math.max(0, Math.min(2, zoneCol)),
        isStrikeZone: true,
        isSwing: false,
        call: 'CALLED_STRIKE',
        outcomeDetail: '스트라이크!',
        runsScoredOnPlay: 0,
        narrative: `${currentPitchCount}구 ${velocity}km/h ${pitchType}, 스트라이크 존 한복판을 그대로 통과합니다! (루킹 스트라이크)`,
      };
    } else {
      newBalls += 1;
      if (!silent) soundEffects.playCatch();
      pitchResult = {
        pitchNumber: currentPitchCount,
        pitchType,
        velocity,
        zoneRow: zoneRow < 0 ? 0 : 2,
        zoneCol: zoneCol < 0 ? 0 : 2,
        isStrikeZone: false,
        isSwing: false,
        call: 'BALL',
        outcomeDetail: '볼!',
        runsScoredOnPlay: 0,
        narrative: `${currentPitchCount}구 ${velocity}km/h ${pitchType}, 존을 벗어나는 볼입니다. 타자 잘 참아냅니다.`,
      };
    }
  } else {
    if (tactic === 'BUNT') {
      const buntSuccess = Math.random() < 0.75;
      if (buntSuccess) {
        if (!silent) soundEffects.playBatHit(false, 30);
        newOuts += 1;
        if (newBases.second) {
          newBases.third = newBases.second;
          newBases.second = null;
        }
        if (newBases.first) {
          newBases.second = newBases.first;
          newBases.first = null;
        }
        boxStats = updateBoxStat(boxStats, currentPitcher, s => ({ ...s, inningsOuts: s.inningsOuts + 1 }));
        pitchResult = {
          pitchNumber: currentPitchCount,
          pitchType,
          velocity,
          zoneRow: 1,
          zoneCol: 1,
          isStrikeZone: true,
          isSwing: true,
          call: 'IN_PLAY',
          hitType: 'GROUNDOUT',
          outcomeDetail: '희생번트 성공',
          runsScoredOnPlay: 0,
          narrative: `🎯 ${currentBatter.name} 타자 침착하게 1루쪽으로 희생번트를 성공시키며 주자를 진루시킵니다! (타자 아웃)`,
        };
        return finalizePlateAppearance(
          { ...state, pitchCountAway: nextPitchCountAway, pitchCountHome: nextPitchCountHome, playerBoxStats: boxStats },
          pitchResult.narrative,
          'OUT',
          newBases,
          newScore,
          newInningScores,
          newHits,
          newErrors,
          newOuts,
          pitchResult,
          silent
        );
      } else {
        newStrikes += 1;
        if (!silent) soundEffects.playFoul();
        pitchResult = {
          pitchNumber: currentPitchCount,
          pitchType,
          velocity,
          zoneRow: 1,
          zoneCol: 1,
          isStrikeZone: true,
          isSwing: true,
          call: 'FOUL',
          outcomeDetail: '번트 파울',
          runsScoredOnPlay: 0,
          narrative: `번트 댄 공이 파울라인 밖으로 굴러나갑니다. (파울 스트라이크)`,
        };
      }
    } else {
      const whiffProb = isStrikeZone
        ? Math.max(0.08, 0.22 + (stuff - contact) * 0.003)
        : Math.max(0.35, 0.58 + (stuff - eye) * 0.003);
      const isWhiff = Math.random() < whiffProb;

      if (isWhiff) {
        newStrikes += 1;
        if (!silent) {
          soundEffects.playCatch();
          soundEffects.playUmpireCall(newStrikes === 3);
        }
        pitchResult = {
          pitchNumber: currentPitchCount,
          pitchType,
          velocity,
          zoneRow: Math.max(0, Math.min(2, zoneRow)),
          zoneCol: Math.max(0, Math.min(2, zoneCol)),
          isStrikeZone,
          isSwing: true,
          call: 'SWINGING_STRIKE',
          outcomeDetail: '헛스윙!',
          runsScoredOnPlay: 0,
          narrative: `${currentPitchCount}구 ${velocity}km/h 날카로운 ${pitchType}! 배트가 허공을 가릅니다! (헛스윙)`,
        };
      } else {
        const foulProb = 0.38 + (state.strikes === 2 ? 0.12 : 0);
        const isFoul = Math.random() < foulProb;

        if (isFoul) {
          if (newStrikes < 2) newStrikes += 1;
          if (!silent) soundEffects.playFoul();
          pitchResult = {
            pitchNumber: currentPitchCount,
            pitchType,
            velocity,
            zoneRow: Math.max(0, Math.min(2, zoneRow)),
            zoneCol: Math.max(0, Math.min(2, zoneCol)),
            isStrikeZone,
            isSwing: true,
            call: 'FOUL',
            outcomeDetail: '파울!',
            runsScoredOnPlay: 0,
            narrative: `${velocity}km/h ${pitchType}을 밀어쳤으나 빗맞으며 파울 플라이/관중석으로 들어갑니다.`,
          };
        } else {
          return handleInPlayHit(
            { ...state, pitchCountAway: nextPitchCountAway, pitchCountHome: nextPitchCountHome, playerBoxStats: boxStats },
            currentBatter,
            currentPitcher,
            velocity,
            pitchType,
            zoneRow,
            zoneCol,
            power,
            contact,
            newBases,
            newScore,
            newInningScores,
            newHits,
            newErrors,
            newOuts,
            silent
          );
        }
      }
    }
  }

  // 볼넷 체크
  if (newBalls >= 4) {
    if (!silent) soundEffects.playUmpireCall(false);
    const advanceResult = advanceRunnersOnWalk(newBases, currentBatter);
    newBases = advanceResult.bases;
    if (advanceResult.runsScored > 0) {
      if (state.isTop) {
        newScore.away += advanceResult.runsScored;
        newInningScores.away[state.inning - 1] = (newInningScores.away[state.inning - 1] || 0) + advanceResult.runsScored;
      } else {
        newScore.home += advanceResult.runsScored;
        newInningScores.home[state.inning - 1] = (newInningScores.home[state.inning - 1] || 0) + advanceResult.runsScored;
      }
      boxStats = updateBoxStat(boxStats, currentBatter, s => ({ ...s, rbi: s.rbi + advanceResult.runsScored }));
      boxStats = updateBoxStat(boxStats, currentPitcher, s => ({ ...s, earnedRuns: s.earnedRuns + advanceResult.runsScored }));
      advanceResult.scoredRunners.forEach(r => {
        boxStats = updateBoxStat(boxStats, r, s => ({ ...s, runs: s.runs + 1 }));
      });
    }
    boxStats = updateBoxStat(boxStats, currentBatter, s => ({ ...s, walks: s.walks + 1 }));
    boxStats = updateBoxStat(boxStats, currentPitcher, s => ({ ...s, walksAllowed: s.walksAllowed + 1 }));

    const narrative = `📢 4구째 볼! ${currentBatter.name} 선수가 침착하게 볼넷을 골라 1루로 걸어나갑니다!`;
    return finalizePlateAppearance(
      { ...state, pitchCountAway: nextPitchCountAway, pitchCountHome: nextPitchCountHome, playerBoxStats: boxStats },
      narrative,
      'WALK',
      newBases,
      newScore,
      newInningScores,
      newHits,
      newErrors,
      newOuts,
      pitchResult,
      silent
    );
  }

  // 삼진 체크
  if (newStrikes >= 3) {
    newOuts += 1;
    if (!silent) soundEffects.playUmpireCall(true);
    boxStats = updateBoxStat(boxStats, currentBatter, s => ({
      ...s,
      atBats: s.atBats + 1,
      strikeouts: s.strikeouts + 1,
    }));
    boxStats = updateBoxStat(boxStats, currentPitcher, s => ({
      ...s,
      inningsOuts: s.inningsOuts + 1,
      pitcherStrikeouts: s.pitcherStrikeouts + 1,
    }));

    const narrative = `🔥 3구 삼진 아웃! ${currentPitcher.name} 투수의 위력적인 ${velocity}km/h ${pitchType}에 ${currentBatter.name} 타자 삼진으로 물러납니다!`;
    return finalizePlateAppearance(
      { ...state, pitchCountAway: nextPitchCountAway, pitchCountHome: nextPitchCountHome, playerBoxStats: boxStats },
      narrative,
      'STRIKEOUT',
      newBases,
      newScore,
      newInningScores,
      newHits,
      newErrors,
      newOuts,
      pitchResult,
      silent
    );
  }

  // 일반 볼/스트라이크 투구 로그
  const logEntry: PlayLogEntry = {
    id: `pitch_${Date.now()}_${Math.random()}`,
    inning: state.inning,
    isTop: state.isTop,
    batterName: currentBatter.name,
    pitcherName: currentPitcher.name,
    balls: newBalls,
    strikes: newStrikes,
    outs: newOuts,
    description: pitchResult.narrative,
  };

  return {
    ...state,
    pitchCountAway: nextPitchCountAway,
    pitchCountHome: nextPitchCountHome,
    playerBoxStats: boxStats,
    balls: newBalls,
    strikes: newStrikes,
    outs: newOuts,
    lastPitch: pitchResult,
    playLogs: [logEntry, ...state.playLogs],
  };
}

function handleInPlayHit(
  state: LiveGameState,
  batter: Player,
  pitcher: Player,
  velocity: number,
  pitchType: string,
  zoneRow: number,
  zoneCol: number,
  power: number,
  contact: number,
  bases: { first: Player | null; second: Player | null; third: Player | null },
  score: { away: number; home: number },
  inningScores: { away: number[]; home: number[] },
  hits: { away: number; home: number },
  errors: { away: number; home: number },
  outs: number,
  silent = false
): LiveGameState {
  const parkFactor = state.homeTeam.staminaParkFactor || 1.0;
  const contactMod = (contact - 65) * 0.0025;
  const hrChance = Math.max(0.02, (power * 0.0016 - 0.04) * parkFactor);
  const extraBaseChance = 0.16 + (power * 0.001);
  const singleChance = Math.max(0.20, 0.28 + contactMod);
  const hitRoll = Math.random();

  let runsScored = 0;
  const scoredRunners: Player[] = [];
  let newBases = { ...bases };
  let logText = '';
  let highlight: PlayLogEntry['highlightType'] = 'HIT';
  let hitType: PitchResult['hitType'] = 'SINGLE';
  let hitDistance = Math.round(85 + (power * 0.35) + (Math.random() * 20));
  let boxStats = { ...(state.playerBoxStats || {}) };

  if (hitRoll < hrChance) {
    // 홈런 (Home Run!)
    hitType = 'HOMERUN';
    hitDistance = Math.round(115 + (power * 0.25) + (Math.random() * 25));
    if (!silent) soundEffects.playBatHit(true, power);
    highlight = 'HOMERUN';

    let runnersOnBase = 1;
    scoredRunners.push(batter);
    if (newBases.first) { runnersOnBase += 1; scoredRunners.push(newBases.first); }
    if (newBases.second) { runnersOnBase += 1; scoredRunners.push(newBases.second); }
    if (newBases.third) { runnersOnBase += 1; scoredRunners.push(newBases.third); }
    runsScored = runnersOnBase;

    newBases = { first: null, second: null, third: null };
    if (state.isTop) hits.away += 1;
    else hits.home += 1;

    boxStats = updateBoxStat(boxStats, batter, s => ({
      ...s,
      atBats: s.atBats + 1,
      hits: s.hits + 1,
      homeRuns: s.homeRuns + 1,
      rbi: s.rbi + runsScored,
    }));
    boxStats = updateBoxStat(boxStats, pitcher, s => ({
      ...s,
      hitsAllowed: s.hitsAllowed + 1,
      homeRunsAllowed: s.homeRunsAllowed + 1,
      earnedRuns: s.earnedRuns + runsScored,
    }));

    const hrTypes = ['솔로', '2점', '3점', '만루'];
    const hrDesc = hrTypes[Math.min(3, runnersOnBase - 1)];
    logText = `💥💥 경쾌한 타구음! ${batter.name} 타자가 ${pitcher.name}의 ${velocity}km/h ${pitchType}을 완벽하게 통타! 좌중간 담장을 까마득하게 넘어가는 비거리 ${hitDistance}m 특대형 ${hrDesc} 홈런을 쏘아 올립니다!`;
  } else if (hitRoll < hrChance + extraBaseChance * 0.5) {
    // 2루타 (Double)
    hitType = 'DOUBLE';
    if (!silent) soundEffects.playBatHit(false, power);
    if (newBases.third) { runsScored += 1; scoredRunners.push(newBases.third); newBases.third = null; }
    if (newBases.second) { runsScored += 1; scoredRunners.push(newBases.second); newBases.second = null; }
    if (newBases.first) {
      if (Math.random() < 0.6) { runsScored += 1; scoredRunners.push(newBases.first); }
      else { newBases.third = newBases.first; }
      newBases.first = null;
    }
    newBases.second = batter;
    if (state.isTop) hits.away += 1;
    else hits.home += 1;

    boxStats = updateBoxStat(boxStats, batter, s => ({
      ...s,
      atBats: s.atBats + 1,
      hits: s.hits + 1,
      doubles: s.doubles + 1,
      rbi: s.rbi + runsScored,
    }));
    boxStats = updateBoxStat(boxStats, pitcher, s => ({
      ...s,
      hitsAllowed: s.hitsAllowed + 1,
      earnedRuns: s.earnedRuns + runsScored,
    }));

    logText = `⚡ 우중간을 완전히 가르는 깊숙한 타구! ${batter.name} 타자 여유 있게 2루까지 내달립니다! (2루타)`;
  } else if (hitRoll < hrChance + extraBaseChance * 0.5 + singleChance) {
    // 단타 (Single)
    hitType = 'SINGLE';
    if (!silent) soundEffects.playBatHit(false, power * 0.8);
    if (newBases.third) { runsScored += 1; scoredRunners.push(newBases.third); newBases.third = null; }
    if (newBases.second) {
      if (Math.random() < 0.55) { runsScored += 1; scoredRunners.push(newBases.second); }
      else { newBases.third = newBases.second; }
      newBases.second = null;
    }
    if (newBases.first) {
      newBases.second = newBases.first;
      newBases.first = null;
    }
    newBases.first = batter;
    if (state.isTop) hits.away += 1;
    else hits.home += 1;

    boxStats = updateBoxStat(boxStats, batter, s => ({
      ...s,
      atBats: s.atBats + 1,
      hits: s.hits + 1,
      rbi: s.rbi + runsScored,
    }));
    boxStats = updateBoxStat(boxStats, pitcher, s => ({
      ...s,
      hitsAllowed: s.hitsAllowed + 1,
      earnedRuns: s.earnedRuns + runsScored,
    }));

    logText = `⚾ 깨끗한 중전 안타! ${batter.name} 선수의 날카로운 스윙이 중견수 앞에 떨어집니다!`;
  } else {
    // 아웃 (땅볼, 플라이, 병살타)
    if (!silent) soundEffects.playCatch();
    if (outs < 2 && newBases.first && Math.random() < 0.28) {
      // 병살타
      outs += 2;
      hitType = 'DOUBLE_PLAY';
      newBases.first = null;
      if (newBases.third && outs < 3) { runsScored += 1; scoredRunners.push(newBases.third); newBases.third = null; }
      boxStats = updateBoxStat(boxStats, batter, s => ({ ...s, atBats: s.atBats + 1 }));
      boxStats = updateBoxStat(boxStats, pitcher, s => ({
        ...s,
        inningsOuts: s.inningsOuts + 2,
        earnedRuns: s.earnedRuns + runsScored,
      }));
      logText = `🚫 유격수 앞 날카로운 땅볼! 2루 터치 거쳐 1루까지 완벽한 6-4-3 더블플레이로 연결됩니다! (병살타)`;
      highlight = 'OUT';
    } else if (newBases.third && outs < 2 && Math.random() < 0.35) {
      // 희생플라이
      outs += 1;
      hitType = 'SAC_FLY';
      runsScored += 1;
      scoredRunners.push(newBases.third);
      newBases.third = null;
      boxStats = updateBoxStat(boxStats, batter, s => ({ ...s, rbi: s.rbi + 1 }));
      boxStats = updateBoxStat(boxStats, pitcher, s => ({
        ...s,
        inningsOuts: s.inningsOuts + 1,
        earnedRuns: s.earnedRuns + 1,
      }));
      logText = `🎯 중견수 깊숙한 플라이 아웃! 그 사이 3루 주자가 태그업하여 여유 있게 홈을 밟습니다! (희생플라이)`;
      highlight = 'OUT';
    } else {
      // 일반 아웃
      outs += 1;
      hitType = Math.random() < 0.5 ? 'GROUNDOUT' : 'FLYOUT';
      boxStats = updateBoxStat(boxStats, batter, s => ({ ...s, atBats: s.atBats + 1 }));
      boxStats = updateBoxStat(boxStats, pitcher, s => ({ ...s, inningsOuts: s.inningsOuts + 1 }));
      logText = hitType === 'GROUNDOUT'
        ? `내야 땅볼 타구, 1루수가 침착하게 잡아 베이스를 터치하며 타자를 아웃 처리합니다.`
        : `높게 뜬 타구, 우익수가 침착하게 포구 위치를 잡고 뜬공으로 처리합니다.`;
      highlight = 'OUT';
    }
  }

  // 득점 주자 runs 누적
  scoredRunners.forEach(runner => {
    boxStats = updateBoxStat(boxStats, runner, s => ({ ...s, runs: s.runs + 1 }));
  });

  if (runsScored > 0) {
    if (state.isTop) {
      score.away += runsScored;
      inningScores.away[state.inning - 1] = (inningScores.away[state.inning - 1] || 0) + runsScored;
    } else {
      score.home += runsScored;
      inningScores.home[state.inning - 1] = (inningScores.home[state.inning - 1] || 0) + runsScored;
    }
    if (!silent) soundEffects.playCrowdCheer(true);
  }

  const pitchResult: PitchResult = {
    pitchNumber: state.isTop ? state.pitchCountHome : state.pitchCountAway,
    pitchType,
    velocity,
    zoneRow: Math.max(0, Math.min(2, zoneRow)),
    zoneCol: Math.max(0, Math.min(2, zoneCol)),
    isStrikeZone: true,
    isSwing: true,
    call: 'IN_PLAY',
    outcomeDetail: hitType === 'HOMERUN' ? '홈런!' : hitType === 'DOUBLE' ? '2루타!' : hitType === 'SINGLE' ? '안타!' : '아웃!',
    hitType,
    hitDistance,
    runsScoredOnPlay: runsScored,
    narrative: logText,
  };

  return finalizePlateAppearance(
    { ...state, playerBoxStats: boxStats },
    logText,
    highlight,
    newBases,
    score,
    inningScores,
    hits,
    errors,
    outs,
    pitchResult,
    silent
  );
}

function advanceRunnersOnWalk(
  bases: { first: Player | null; second: Player | null; third: Player | null },
  batter: Player
): {
  bases: { first: Player | null; second: Player | null; third: Player | null };
  runsScored: number;
  scoredRunners: Player[];
} {
  let runsScored = 0;
  const scoredRunners: Player[] = [];
  const newBases = { ...bases };

  if (newBases.first) {
    if (newBases.second) {
      if (newBases.third) {
        runsScored = 1;
        scoredRunners.push(newBases.third);
      }
      newBases.third = newBases.second;
    }
    newBases.second = newBases.first;
  }
  newBases.first = batter;
  return { bases: newBases, runsScored, scoredRunners };
}

function applyFinalPitcherDecisions(state: LiveGameState): LiveGameState {
  if (!state.winningTeamId || !state.losingTeamId) return state;

  const isHomeWinner = state.winningTeamId === state.homeTeam.id;
  const winPitcher = isHomeWinner ? state.currentPitcherHome : state.currentPitcherAway;
  const losePitcher = isHomeWinner ? state.currentPitcherAway : state.currentPitcherHome;
  const scoreDiff = Math.abs(state.score.home - state.score.away);

  let boxStats = { ...(state.playerBoxStats || {}) };
  if (winPitcher) {
    boxStats = updateBoxStat(boxStats, winPitcher, s => ({
      ...s,
      wins: s.wins + 1,
      saves: s.saves + (winPitcher.primaryPosition === 'CP' && scoreDiff <= 3 ? 1 : 0),
    }));
  }
  if (losePitcher) {
    boxStats = updateBoxStat(boxStats, losePitcher, s => ({
      ...s,
      losses: s.losses + 1,
    }));
  }

  return {
    ...state,
    playerBoxStats: boxStats,
    winningPitcherId: winPitcher?.id,
    losingPitcherId: losePitcher?.id,
  };
}

function finalizePlateAppearance(
  state: LiveGameState,
  narrative: string,
  highlight: PlayLogEntry['highlightType'],
  bases: { first: Player | null; second: Player | null; third: Player | null },
  score: { away: number; home: number },
  inningScores: { away: number[]; home: number[] },
  hits: { away: number; home: number },
  errors: { away: number; home: number },
  outs: number,
  lastPitch?: PitchResult,
  silent = false
): LiveGameState {
  const currentBatter = state.isTop
    ? state.battingOrderAway[state.orderIndexAway % state.battingOrderAway.length]
    : state.battingOrderHome[state.orderIndexHome % state.battingOrderHome.length];
  const currentPitcher = state.isTop ? state.currentPitcherHome : state.currentPitcherAway;

  const logEntry: PlayLogEntry = {
    id: `pa_${Date.now()}_${Math.random()}`,
    inning: state.inning,
    isTop: state.isTop,
    batterName: currentBatter.name,
    pitcherName: currentPitcher.name,
    balls: state.balls,
    strikes: state.strikes,
    outs,
    description: narrative,
    highlightType: highlight,
  };

  const nextOrderAway = state.isTop ? state.orderIndexAway + 1 : state.orderIndexAway;
  const nextOrderHome = !state.isTop ? state.orderIndexHome + 1 : state.orderIndexHome;

  // 9회말 끝내기 승리 체크
  if (state.inning >= 9 && !state.isTop && score.home > score.away) {
    if (!silent) soundEffects.playCrowdCheer(true);
    return applyFinalPitcherDecisions({
      ...state,
      score,
      inningScores,
      hits,
      errors,
      outs,
      bases,
      balls: 0,
      strikes: 0,
      orderIndexAway: nextOrderAway,
      orderIndexHome: nextOrderHome,
      lastPitch: lastPitch || state.lastPitch,
      playLogs: [
        {
          id: `walkoff_${Date.now()}`,
          inning: state.inning,
          isTop: false,
          batterName: currentBatter.name,
          pitcherName: currentPitcher.name,
          balls: 0,
          strikes: 0,
          outs,
          description: `🎉🎉 ${state.homeTeam.name}의 극적인 끝내기 승리! 경기가 그대로 종료됩니다!`,
          highlightType: 'RUN',
        },
        logEntry,
        ...state.playLogs
      ],
      isFinished: true,
      winningTeamId: state.homeTeam.id,
      losingTeamId: state.awayTeam.id,
    });
  }

  // 3아웃 공수교대 체크
  if (outs >= 3) {
    return handleInningChange({
      ...state,
      score,
      inningScores,
      hits,
      errors,
      outs,
      bases,
      balls: 0,
      strikes: 0,
      orderIndexAway: nextOrderAway,
      orderIndexHome: nextOrderHome,
      lastPitch: lastPitch || state.lastPitch,
      playLogs: [logEntry, ...state.playLogs],
    }, silent);
  }

  return {
    ...state,
    score,
    inningScores,
    hits,
    errors,
    outs,
    bases,
    balls: 0,
    strikes: 0,
    orderIndexAway: nextOrderAway,
    orderIndexHome: nextOrderHome,
    lastPitch: lastPitch || state.lastPitch,
    playLogs: [logEntry, ...state.playLogs],
  };
}

function handleInningChange(state: LiveGameState, silent = false): LiveGameState {
  if (!silent) soundEffects.playUmpireCall(false);

  // 9회초 종료 시 홈팀 리드인 경우 9회말 없이 즉시 홈팀 승리 종료
  if (state.inning >= 9 && state.isTop && state.score.home > state.score.away) {
    return applyFinalPitcherDecisions({
      ...state,
      isFinished: true,
      winningTeamId: state.homeTeam.id,
      losingTeamId: state.awayTeam.id,
      playLogs: [
        {
          id: `end_game_${Date.now()}`,
          inning: state.inning,
          isTop: true,
          batterName: '',
          pitcherName: '',
          balls: 0,
          strikes: 0,
          outs: 3,
          description: `🏁 9회초 종료와 함께 ${state.homeTeam.name}의 승리로 경기가 종료됩니다! 최종 스코어 ${state.awayTeam.name} ${state.score.away} : ${state.score.home} ${state.homeTeam.name}`,
          highlightType: 'TACTIC',
        },
        ...state.playLogs,
      ],
    });
  }

  // 9회말 이후 무승부/경기종료 체크
  if (state.inning >= 9 && !state.isTop) {
    if (state.score.away !== state.score.home || state.inning >= 12) {
      const winningTeam = state.score.away > state.score.home ? state.awayTeam : state.score.home > state.score.away ? state.homeTeam : undefined;
      return applyFinalPitcherDecisions({
        ...state,
        isFinished: true,
        winningTeamId: winningTeam?.id,
        losingTeamId: winningTeam ? (winningTeam.id === state.homeTeam.id ? state.awayTeam.id : state.homeTeam.id) : undefined,
        playLogs: [
          {
            id: `end_game_${Date.now()}`,
            inning: state.inning,
            isTop: false,
            batterName: '',
            pitcherName: '',
            balls: 0,
            strikes: 0,
            outs: 3,
            description: winningTeam
              ? `🏁 경기 종료! ${winningTeam.name} 승리! 최종 스코어 ${state.awayTeam.name} ${state.score.away} : ${state.score.home} ${state.homeTeam.name}`
              : `🏁 12회 연장 접전 끝에 무승부로 경기가 종료됩니다.`,
            highlightType: 'TACTIC',
          },
          ...state.playLogs,
        ],
      });
    }
  }

  const nextIsTop = !state.isTop;
  const nextInning = state.isTop ? state.inning : state.inning + 1;

  const newInningScores = {
    away: [...state.inningScores.away],
    home: [...state.inningScores.home],
  };

  if (nextIsTop) {
    newInningScores.away.push(0);
  } else {
    newInningScores.home.push(0);
  }

  const changeLog: PlayLogEntry = {
    id: `change_${Date.now()}`,
    inning: nextInning,
    isTop: nextIsTop,
    batterName: '',
    pitcherName: '',
    balls: 0,
    strikes: 0,
    outs: 0,
    description: `🔄 3아웃 공수교대! ${nextInning}회${nextIsTop ? '초' : '말'} 공격으로 이어집니다.`,
    highlightType: 'TACTIC',
  };

  return {
    ...state,
    inning: nextInning,
    isTop: nextIsTop,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: { first: null, second: null, third: null },
    inningScores: newInningScores,
    playLogs: [changeLog, ...state.playLogs],
  };
}

// 1타석 빠르게 시뮬레이션
export function simulateFullPlateAppearance(state: LiveGameState, tactic: TacticChoice = 'NORMAL', silent = false): LiveGameState {
  let curr = state;
  const initialOrderIdx = curr.isTop ? curr.orderIndexAway : curr.orderIndexHome;
  const initialInning = curr.inning;
  const initialIsTop = curr.isTop;

  while (!curr.isFinished) {
    curr = simulateNextPitch(curr, tactic, silent);
    const newOrderIdx = curr.isTop ? curr.orderIndexAway : curr.orderIndexHome;
    if (newOrderIdx !== initialOrderIdx || curr.inning !== initialInning || curr.isTop !== initialIsTop) {
      break;
    }
  }
  return curr;
}

// 반 이닝(Half-Inning) 스킵
export function simulateHalfInning(state: LiveGameState, silent = false): LiveGameState {
  let curr = state;
  const targetInning = curr.inning;
  const targetIsTop = curr.isTop;

  while (!curr.isFinished && curr.inning === targetInning && curr.isTop === targetIsTop) {
    curr = simulateNextPitch(curr, 'NORMAL', silent);
  }
  return curr;
}

// 경기 종료까지 전체 시뮬레이션
export function simulateUntilGameFinish(state: LiveGameState, silent = false): LiveGameState {
  let curr = state;
  let guard = 0;
  while (!curr.isFinished && guard < 1200) {
    curr = simulateNextPitch(curr, 'NORMAL', silent);
    guard += 1;
  }
  return curr;
}

// CPU 팀 간 타구장 경기 빠른 무음 시뮬레이션
export function simulateCpuMatch(
  awayTeam: Team,
  homeTeam: Team,
  awayRoster: Player[],
  homeRoster: Player[],
  rotationDay = 1
): LiveGameState {
  const initial = createNewGame(awayTeam, homeTeam, awayRoster, homeRoster, {
    isUserGame: false,
    rotationDay,
  });
  return simulateUntilGameFinish(initial, true);
}

// 종료된 경기의 playerBoxStats를 전체 구단 선수단(playersMap) 시즌 누적 기록에 합산
export function mergeGameStatsIntoPlayersMap(
  playersMap: Record<string, Player[]>,
  finishedGame: LiveGameState
): Record<string, Player[]> {
  const boxStats = finishedGame.playerBoxStats || {};
  const nextMap: Record<string, Player[]> = { ...playersMap };

  const targetTeamIds = [finishedGame.awayTeam.id, finishedGame.homeTeam.id];
  targetTeamIds.forEach(teamId => {
    const roster = nextMap[teamId];
    if (!roster) return;

    nextMap[teamId] = roster.map(player => {
      const box = boxStats[player.id];
      if (!box) return player;

      if (player.role === 'BATTER' && player.batterStats) {
        return {
          ...player,
          exp: player.exp + 20 + box.hits * 10 + box.homeRuns * 25,
          batterStats: {
            ...player.batterStats,
            games: player.batterStats.games + 1,
            atBats: player.batterStats.atBats + box.atBats,
            hits: player.batterStats.hits + box.hits,
            doubles: player.batterStats.doubles + box.doubles,
            triples: player.batterStats.triples + box.triples,
            homeRuns: player.batterStats.homeRuns + box.homeRuns,
            rbi: player.batterStats.rbi + box.rbi,
            runs: player.batterStats.runs + box.runs,
            walks: player.batterStats.walks + box.walks,
            strikeouts: player.batterStats.strikeouts + box.strikeouts,
            stolenBases: player.batterStats.stolenBases + box.stolenBases,
            caughtStealing: player.batterStats.caughtStealing + box.caughtStealing,
          },
        };
      }

      if (player.role === 'PITCHER' && player.pitcherStats) {
        return {
          ...player,
          exp: player.exp + 25 + box.pitcherStrikeouts * 8 + box.wins * 30,
          pitcherStats: {
            ...player.pitcherStats,
            games: player.pitcherStats.games + 1,
            gamesStarted: player.pitcherStats.gamesStarted + box.gamesStarted,
            inningsOuts: player.pitcherStats.inningsOuts + box.inningsOuts,
            wins: player.pitcherStats.wins + box.wins,
            losses: player.pitcherStats.losses + box.losses,
            saves: player.pitcherStats.saves + box.saves,
            holds: player.pitcherStats.holds + box.holds,
            earnedRuns: player.pitcherStats.earnedRuns + box.earnedRuns,
            hitsAllowed: player.pitcherStats.hitsAllowed + box.hitsAllowed,
            walksAllowed: player.pitcherStats.walksAllowed + box.walksAllowed,
            strikeouts: player.pitcherStats.strikeouts + box.pitcherStrikeouts,
            homeRunsAllowed: player.pitcherStats.homeRunsAllowed + box.homeRunsAllowed,
            pitchesCount: player.pitcherStats.pitchesCount + box.pitchesCount,
          },
        };
      }

      return player;
    });
  });

  return nextMap;
}

export function calculatePlayerTradeValue(p: Player): number {
  let base = 50;
  const potBoost =
    p.potential === 'S' ? 35 : p.potential === 'A' ? 22 : p.potential === 'B' ? 12 : p.potential === 'C' ? 0 : -10;
  const ageFactor = p.age <= 23 ? 15 : p.age <= 28 ? 10 : p.age <= 32 ? 2 : -12;

  if (p.role === 'BATTER' && p.batterStats) {
    const { contact, power, eye, defense } = p.batterStats;
    base = contact * 0.35 + power * 0.35 + eye * 0.15 + defense * 0.15;
  } else if (p.role === 'PITCHER' && p.pitcherStats) {
    const { velocity, control, stuff } = p.pitcherStats;
    const veloScore = (velocity - 130) * 2;
    base = veloScore * 0.3 + control * 0.35 + stuff * 0.35;
  }
  return Math.round(base + potBoost + ageFactor + Math.min(10, (p.level - 1) * 1.5));
}

export function autoDevelopAllLeaguePlayers(
  playersMap: Record<string, Player[]>,
  teams: Team[],
  seasonNumber: number,
  currentDay: number,
  userTeamId?: string
): {
  nextPlayersMap: Record<string, Player[]>;
  growthLogs: AutoGrowthLog[];
  newlyInjuredUserPlayers: Player[];
  recoveredCount: number;
} {
  const nextMap: Record<string, Player[]> = {};
  const growthLogs: AutoGrowthLog[] = [];
  const newlyInjuredUserPlayers: Player[] = [];
  let recoveredCount = 0;

  const potExpMap: Record<string, number> = { S: 52, A: 42, B: 32, C: 24, D: 16 };

  teams.forEach(team => {
    const roster = playersMap[team.id] || [];
    const batFac = team.facilityLevels?.battingCage || 2;
    const pitchFac = team.facilityLevels?.pitchingLab || 2;
    const weightFac = team.facilityLevels?.weightRoom || 2;
    const medFac = team.facilityLevels?.medicalCenter || 2;
    const injuryProb = Math.max(0.005, 0.018 - medFac * 0.0025);

    const updatedRoster = roster.map(player => {
      // 1) 부상 회복 처리
      if (player.isInjured) {
        const healStep = medFac >= 4 ? 2 : 1;
        const remainDays = Math.max(0, (player.injuryDays || 1) - healStep);
        if (remainDays === 0) {
          recoveredCount += 1;
          return {
            ...player,
            isInjured: false,
            injuryDays: 0,
            condition: 86,
            currentStamina: 95,
          };
        }
        return {
          ...player,
          injuryDays: remainDays,
          condition: Math.max(55, (player.condition || 60) + 2),
        };
      }

      // 2) 일일 부상 발생 체크 (1군 주전 위주 소확률)
      if (player.tier === 'FIRST_TEAM' && Math.random() < injuryProb) {
        const days = Math.floor(Math.random() * 5) + 3; // 3~7일 부상
        const injuredPlayer: Player = {
          ...player,
          isInjured: true,
          injuryDays: days,
          tier: 'SECOND_TEAM', // 부상자 명단(2군 말소)
          condition: 55,
        };
        if (userTeamId && team.id === userTeamId) {
          newlyInjuredUserPlayers.push(injuredPlayer);
        }
        return injuredPlayer;
      }

      // 3) 경험치 & 스탯 자동 육성
      const potExp = potExpMap[player.potential] || 24;
      const ageBonus = player.age <= 22 ? 28 : player.age <= 26 ? 18 : player.age <= 30 ? 10 : 4;
      const tierBonus = player.tier === 'SECOND_TEAM' ? 22 : 8;
      const facilityBonus =
        (player.role === 'BATTER' ? batFac : pitchFac) * 6 + weightFac * 4;
      const randomSpark = Math.floor(Math.random() * 20);

      let nextExp = (player.exp || 0) + potExp + ageBonus + tierBonus + facilityBonus + randomSpark;
      let nextLevel = player.level || 1;
      let nextBatterStats = player.batterStats ? { ...player.batterStats } : undefined;
      let nextPitcherStats = player.pitcherStats ? { ...player.pitcherStats } : undefined;
      const gainedParts: string[] = [];

      while (nextExp >= 200) {
        nextExp -= 200;
        nextLevel += 1;

        if (player.role === 'BATTER' && nextBatterStats) {
          const statKeys: Array<{ key: 'contact' | 'power' | 'eye' | 'speed' | 'defense' | 'clutch'; label: string }> = [
            { key: 'contact', label: '컨택' },
            { key: 'power', label: '파워' },
            { key: 'eye', label: '선구안' },
            { key: 'speed', label: '주력' },
            { key: 'defense', label: '수비' },
            { key: 'clutch', label: '클러치' },
          ];
          const first = statKeys[Math.floor(Math.random() * statKeys.length)];
          let second = statKeys[Math.floor(Math.random() * statKeys.length)];
          if (second.key === first.key) {
            second = statKeys[(statKeys.indexOf(first) + 1) % statKeys.length];
          }
          const boost1 = player.potential === 'S' || player.potential === 'A' ? 2 : 1;
          nextBatterStats[first.key] = Math.min(99, nextBatterStats[first.key] + boost1);
          nextBatterStats[second.key] = Math.min(99, nextBatterStats[second.key] + 1);
          gainedParts.push(`${first.label}+${boost1}`, `${second.label}+1`);
        } else if (player.role === 'PITCHER' && nextPitcherStats) {
          const roll = Math.random();
          if (roll < 0.28 && nextPitcherStats.velocity < 162) {
            nextPitcherStats.velocity = Math.min(162, nextPitcherStats.velocity + 1);
            nextPitcherStats.stuff = Math.min(99, nextPitcherStats.stuff + 1);
            gainedParts.push('구속+1km/h', '구위+1');
          } else {
            const pKeys: Array<{ key: 'control' | 'stuff' | 'stamina' | 'clutch'; label: string }> = [
              { key: 'control', label: '제구' },
              { key: 'stuff', label: '구위' },
              { key: 'stamina', label: '체력' },
              { key: 'clutch', label: '위기관리' },
            ];
            const first = pKeys[Math.floor(Math.random() * pKeys.length)];
            const second = pKeys[(pKeys.indexOf(first) + 1) % pKeys.length];
            const boost1 = player.potential === 'S' || player.potential === 'A' ? 2 : 1;
            nextPitcherStats[first.key] = Math.min(99, nextPitcherStats[first.key] + boost1);
            nextPitcherStats[second.key] = Math.min(99, nextPitcherStats[second.key] + 1);
            gainedParts.push(`${first.label}+${boost1}`, `${second.label}+1`);
          }
        }
      }

      if (gainedParts.length > 0) {
        growthLogs.push({
          id: `grow_${currentDay}_${player.id}_${Math.random().toString(36).slice(2, 6)}`,
          day: currentDay,
          seasonNumber,
          teamId: team.id,
          teamName: team.name,
          playerId: player.id,
          playerName: player.name,
          position: player.primaryPosition,
          newLevel: nextLevel,
          statGainText: gainedParts.slice(0, 3).join(', '),
        });
      }

      const nextCondition = Math.min(100, Math.max(65, (player.condition || 80) + medFac + Math.floor(Math.random() * 7) - 3));
      const nextStamina = Math.min(100, (player.currentStamina || 90) + 15 + medFac * 3);

      return {
        ...player,
        exp: nextExp,
        level: nextLevel,
        condition: nextCondition,
        currentStamina: nextStamina,
        batterStats: nextBatterStats,
        pitcherStats: nextPitcherStats,
      };
    });

    // 4) CPU 구단 자동 1·2군 로테이션 보충 (건강한 2군 최고 가치 선수 자동 콜업)
    if (!userTeamId || team.id !== userTeamId) {
      const firstBattersCount = updatedRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM' && !p.isInjured).length;
      const firstPitchersCount = updatedRoster.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && !p.isInjured).length;

      let rotatedRoster = [...updatedRoster];
      if (firstBattersCount < 9) {
        const bestHealthyResBatter = rotatedRoster
          .filter(p => p.role === 'BATTER' && p.tier === 'SECOND_TEAM' && !p.isInjured)
          .sort((a, b) => calculatePlayerTradeValue(b) - calculatePlayerTradeValue(a))[0];
        if (bestHealthyResBatter) {
          rotatedRoster = rotatedRoster.map(p =>
            p.id === bestHealthyResBatter.id ? { ...p, tier: 'FIRST_TEAM' } : p
          );
        }
      }
      if (firstPitchersCount < 6) {
        const bestHealthyResPitcher = rotatedRoster
          .filter(p => p.role === 'PITCHER' && p.tier === 'SECOND_TEAM' && !p.isInjured)
          .sort((a, b) => calculatePlayerTradeValue(b) - calculatePlayerTradeValue(a))[0];
        if (bestHealthyResPitcher) {
          rotatedRoster = rotatedRoster.map(p =>
            p.id === bestHealthyResPitcher.id ? { ...p, tier: 'FIRST_TEAM' } : p
          );
        }
      }
      nextMap[team.id] = rotatedRoster;
    } else {
      nextMap[team.id] = updatedRoster;
    }
  });

  return { nextPlayersMap: nextMap, growthLogs, newlyInjuredUserPlayers, recoveredCount };
}

export function generateDailyApprovals(
  teams: Team[],
  playersMap: Record<string, Player[]>,
  userTeamId: string,
  seasonNumber: number,
  currentDay: number,
  growthLogs: AutoGrowthLog[],
  newlyInjuredUserPlayers: Player[] = []
): PendingApproval[] {
  const approvals: PendingApproval[] = [];
  const userTeam = teams.find(t => t.id === userTeamId);
  const userRoster = playersMap[userTeamId] || [];
  const otherTeams = teams.filter(t => t.id !== userTeamId);

  if (!userTeam || otherTeams.length === 0 || userRoster.length === 0) return approvals;

  // 0) 우리 구단 1군 부상자 발생 시 2군 대체 콜업 결재 알림
  newlyInjuredUserPlayers.forEach(injured => {
    const replacement = userRoster
      .filter(p => p.tier === 'SECOND_TEAM' && !p.isInjured && p.role === injured.role)
      .sort((a, b) => calculatePlayerTradeValue(b) - calculatePlayerTradeValue(a))[0];
    if (replacement) {
      approvals.push({
        id: `appr_inj_${currentDay}_${injured.id}`,
        category: 'INJURY_REPLACEMENT',
        title: `🚑 ${injured.name} 부상 이탈 — 대체 선수 콜업 결재`,
        subtitle: `부상 기간 ${injured.injuryDays}일 진단 · 수석 코치가 2군 대체 자원 콜업을 요청했습니다.`,
        createdAtDay: currentDay,
        seasonNumber,
        fromTeamId: userTeam.id,
        toTeamId: userTeam.id,
        offeredPlayer: injured,
        targetPlayer: replacement,
        evaluationSummary: `${injured.name}(${injured.primaryPosition}) 선수가 ${injured.injuryDays}일 부상으로 2군 재활군으로 이동했습니다. 2군에서 컨디션(${replacement.condition}%)이 가장 좋은 ${replacement.name}(${replacement.primaryPosition}, Lv.${replacement.level}) 선수를 즉시 1군에 대체 콜업할까요?`,
      });
    }
  });

  // 1) 타 구단이 우리 구단에 트레이드 제안 (매 경기 후 55% 확률)
  if (Math.random() < 0.55) {
    const shuffledOthers = [...otherTeams].sort(() => Math.random() - 0.5);
    for (const opp of shuffledOthers) {
      const oppRoster = playersMap[opp.id] || [];
      if (oppRoster.length === 0) continue;

      const userCandidate = userRoster[Math.floor(Math.random() * userRoster.length)];
      const userVal = calculatePlayerTradeValue(userCandidate);

      const matchedOpp = oppRoster.find(op => Math.abs(calculatePlayerTradeValue(op) - userVal) <= 12);
      if (matchedOpp) {
        const oppVal = calculatePlayerTradeValue(matchedOpp);
        approvals.push({
          id: `appr_trade_${currentDay}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          category: 'TRADE_INCOMING',
          title: `${opp.name} 구단의 공식 트레이드 제안`,
          subtitle: `${opp.name} 단장이 1:1 맞트레이드를 긴급 타진해왔습니다.`,
          createdAtDay: currentDay,
          seasonNumber,
          fromTeamId: opp.id,
          toTeamId: userTeam.id,
          offeredPlayer: matchedOpp,
          requestedPlayer: userCandidate,
          evaluationSummary: `${opp.name}의 ${matchedOpp.name}(${matchedOpp.primaryPosition}, 가치 ${oppVal}점)을 영입하고 우리 구단 ${userCandidate.name}(${userCandidate.primaryPosition}, 가치 ${userVal}점)을 보내는 트레이드입니다. 승인 시 즉시 명단이 교체됩니다.`,
        });
        break;
      }
    }
  }

  // 2) 타 구단 간 리그 커미셔너 트레이드 승인 요청 (25% 확률)
  if (otherTeams.length >= 2 && Math.random() < 0.25) {
    const teamA = otherTeams[Math.floor(Math.random() * otherTeams.length)];
    const remaining = otherTeams.filter(t => t.id !== teamA.id);
    const teamB = remaining[Math.floor(Math.random() * remaining.length)];
    const rosterA = playersMap[teamA.id] || [];
    const rosterB = playersMap[teamB.id] || [];

    if (rosterA.length > 0 && rosterB.length > 0) {
      const pA = rosterA[Math.floor(Math.random() * rosterA.length)];
      const valA = calculatePlayerTradeValue(pA);
      const pB = rosterB.find(p => Math.abs(calculatePlayerTradeValue(p) - valA) <= 14);
      if (pB) {
        approvals.push({
          id: `appr_lg_${currentDay}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          category: 'TRADE_LEAGUE',
          title: `리그 트레이드 커미셔너 승인 요청`,
          subtitle: `${teamA.name} ↔ ${teamB.name} 구단 간 합의안 도착`,
          createdAtDay: currentDay,
          seasonNumber,
          fromTeamId: teamA.id,
          toTeamId: teamB.id,
          offeredPlayer: pA,
          requestedPlayer: pB,
          evaluationSummary: `${teamA.name}(${pA.name}, ${pA.primaryPosition}) ↔ ${teamB.name}(${pB.name}, ${pB.primaryPosition}) 간 타 구단 트레이드가 합의되었습니다. 감독 겸 커미셔너 권한으로 승인 여부를 결정하세요.`,
        });
      }
    }
  }

  // 3) 자동 육성으로 성장한 2군 유망주 1군 콜업 건의
  const userLeveledReserve = growthLogs.find(g => {
    if (g.teamId !== userTeamId) return false;
    const p = userRoster.find(r => r.id === g.playerId);
    return p?.tier === 'SECOND_TEAM' && !p.isInjured;
  });

  if (userLeveledReserve) {
    const reservePlayer = userRoster.find(p => p.id === userLeveledReserve.playerId);
    if (reservePlayer) {
      approvals.push({
        id: `appr_promo_${currentDay}_${reservePlayer.id}`,
        category: 'PROMOTION_RECOMMEND',
        title: `2군 유망주 ${reservePlayer.name} 1군 콜업 건의`,
        subtitle: `수석 코치가 자동 육성 성과를 바탕으로 1군 승격을 추천했습니다.`,
        createdAtDay: currentDay,
        seasonNumber,
        fromTeamId: userTeam.id,
        toTeamId: userTeam.id,
        targetPlayer: reservePlayer,
        evaluationSummary: `${reservePlayer.name}(${reservePlayer.primaryPosition}, Lv.${reservePlayer.level}) 선수가 자동 훈련으로 급성장(${userLeveledReserve.statGainText})했습니다. 승인 시 즉시 1군 엔트리로 콜업됩니다.`,
      });
    }
  }

  return approvals;
}

export function estimatePlayerSalary(p: Player): number {
  const val = calculatePlayerTradeValue(p);
  return Math.max(3000, Math.round((val * val) * 1.4)); // 단위: 만원 (최소 3,000만원 ~ 수억대)
}

export function generateFreeAgentPool(seasonNumber: number, teams: Team[]): FreeAgent[] {
  const batterPositions: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  const pitcherPositions: Position[] = ['SP', 'SP', 'RP', 'RP', 'CP'];
  const notes = [
    '다년간 검증된 즉시전력감 베테랑',
    '장타력·클러치 능력을 갖춘 FA 최대어',
    '안정적인 수비와 출루율을 자랑하는 핵심 전력',
    '불펜 필승조 및 이닝 소화 능력이 뛰어난 투수',
    '해외 리그·독립야구에서 복귀한 숨은 진주',
  ];

  const pool: FreeAgent[] = [];
  for (let i = 0; i < 14; i++) {
    const isPitcher = i % 2 === 1;
    const role = isPitcher ? 'PITCHER' : 'BATTER';
    const pos = isPitcher
      ? pitcherPositions[i % pitcherPositions.length]
      : batterPositions[i % batterPositions.length];
    const potential = i < 3 ? 'S' : i < 7 ? 'A' : i < 11 ? 'B' : 'C';
    const player = generatePlayer('fa_pool', role, pos, 'FIRST_TEAM', potential);
    player.age = 26 + (i % 8);
    player.level = 3 + (i % 4);
    player.condition = 92;

    if (role === 'BATTER' && player.batterStats) {
      player.batterStats.contact = Math.min(95, player.batterStats.contact + 6);
      player.batterStats.power = Math.min(95, player.batterStats.power + 5);
    } else if (role === 'PITCHER' && player.pitcherStats) {
      player.pitcherStats.velocity = Math.min(158, player.pitcherStats.velocity + 3);
      player.pitcherStats.stuff = Math.min(95, player.pitcherStats.stuff + 6);
    }

    const prevTeam = teams[(seasonNumber + i) % Math.max(1, teams.length)];
    const askingPrice = Math.round(estimatePlayerSalary(player) * (1.05 + (i % 3) * 0.1));

    pool.push({
      id: `fa_${seasonNumber}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      player,
      askingPrice,
      previousTeamName: prevTeam?.name || '해외 리그',
      contractYears: i < 4 ? 3 : i < 9 ? 2 : 1,
      marketNote: notes[i % notes.length],
    });
  }

  return pool.sort((a, b) => b.askingPrice - a.askingPrice);
}

export function createPostseasonBracket(sortedTeams: Team[], seasonNumber: number): PostseasonState {
  const seeds = sortedTeams.slice(0, 5).map(t => t.id);
  const wcSeries: PostseasonSeries = {
    id: `ps_${seasonNumber}_wc`,
    roundIndex: 0,
    roundName: '와일드카드',
    bestOf: 2,
    winsNeeded: 2,
    higherSeedTeamId: seeds[3], // 4위 (1승 어드밴티지 보유)
    lowerSeedTeamId: seeds[4],  // 5위
    higherWins: 1,
    lowerWins: 0,
    gamesLog: [],
  };

  return {
    seasonNumber,
    seeds,
    currentRoundIndex: 0,
    seriesList: [wcSeries],
  };
}

export function simulatePostseasonNextGame(
  postseason: PostseasonState,
  teams: Team[],
  playersMap: Record<string, Player[]>
): PostseasonState {
  if (postseason.championTeamId) return postseason;

  const activeIdx = postseason.seriesList.findIndex(s => !s.winnerTeamId);
  if (activeIdx === -1) return postseason;

  const series = postseason.seriesList[activeIdx];
  const higherTeam = teams.find(t => t.id === series.higherSeedTeamId);
  const lowerTeam = teams.find(t => t.id === series.lowerSeedTeamId);
  if (!higherTeam || !lowerTeam) return postseason;

  // 상위 시드가 홀수 경기 홈구장 어드밴티지
  const gameNumber = series.gamesLog.length + 1;
  const isHigherHome = gameNumber % 2 === 1;
  const awayTeam = isHigherHome ? lowerTeam : higherTeam;
  const homeTeam = isHigherHome ? higherTeam : lowerTeam;

  let simGame = simulateCpuMatch(
    awayTeam,
    homeTeam,
    playersMap[awayTeam.id] || [],
    playersMap[homeTeam.id] || [],
    gameNumber
  );

  let awayScore = simGame.score.away;
  let homeScore = simGame.score.home;
  // 포스트시즌 무승부 방지 (연장 끝내기)
  if (awayScore === homeScore) {
    if (Math.random() < 0.55) homeScore += 1;
    else awayScore += 1;
  }

  const winnerTeamId = homeScore > awayScore ? homeTeam.id : awayTeam.id;
  const nextHigherWins = series.higherWins + (winnerTeamId === higherTeam.id ? 1 : 0);
  const nextLowerWins = series.lowerWins + (winnerTeamId === lowerTeam.id ? 1 : 0);

  let seriesWinnerId: string | undefined;
  if (nextHigherWins >= series.winsNeeded) seriesWinnerId = higherTeam.id;
  else if (nextLowerWins >= series.winsNeeded) seriesWinnerId = lowerTeam.id;

  const updatedSeries: PostseasonSeries = {
    ...series,
    higherWins: nextHigherWins,
    lowerWins: nextLowerWins,
    winnerTeamId: seriesWinnerId,
    gamesLog: [
      ...series.gamesLog,
      {
        gameNumber,
        awayTeamName: awayTeam.name,
        homeTeamName: homeTeam.name,
        awayScore,
        homeScore,
        winnerTeamId,
      },
    ],
  };

  const nextSeriesList = [...postseason.seriesList];
  nextSeriesList[activeIdx] = updatedSeries;

  let nextRoundIndex = postseason.currentRoundIndex;
  let championTeamId = postseason.championTeamId;

  if (seriesWinnerId) {
    if (series.roundIndex === 0) {
      // 와일드카드 종료 -> 준플레이오프 (3위 vs WC 승자, 3전 2선승)
      nextRoundIndex = 1;
      nextSeriesList.push({
        id: `ps_${postseason.seasonNumber}_semi`,
        roundIndex: 1,
        roundName: '준플레이오프',
        bestOf: 3,
        winsNeeded: 2,
        higherSeedTeamId: postseason.seeds[2],
        lowerSeedTeamId: seriesWinnerId,
        higherWins: 0,
        lowerWins: 0,
        gamesLog: [],
      });
    } else if (series.roundIndex === 1) {
      // 준플레이오프 종료 -> 플레이오프 (2위 vs 준PO 승자, 5전 3선승)
      nextRoundIndex = 2;
      nextSeriesList.push({
        id: `ps_${postseason.seasonNumber}_po`,
        roundIndex: 2,
        roundName: '플레이오프',
        bestOf: 5,
        winsNeeded: 3,
        higherSeedTeamId: postseason.seeds[1],
        lowerSeedTeamId: seriesWinnerId,
        higherWins: 0,
        lowerWins: 0,
        gamesLog: [],
      });
    } else if (series.roundIndex === 2) {
      // 플레이오프 종료 -> JBL 한국시리즈 (1위 vs PO 승자, 7전 4선승)
      nextRoundIndex = 3;
      nextSeriesList.push({
        id: `ps_${postseason.seasonNumber}_ks`,
        roundIndex: 3,
        roundName: 'JBL 한국시리즈',
        bestOf: 7,
        winsNeeded: 4,
        higherSeedTeamId: postseason.seeds[0],
        lowerSeedTeamId: seriesWinnerId,
        higherWins: 0,
        lowerWins: 0,
        gamesLog: [],
      });
    } else if (series.roundIndex === 3) {
      championTeamId = seriesWinnerId;
    }
  }

  return {
    ...postseason,
    currentRoundIndex: nextRoundIndex,
    seriesList: nextSeriesList,
    championTeamId,
  };
}

/**
 * 구단 로스터 자동 최적화:
 * 1) 부상 중인 1군 선수를 2군 재활군으로 이동하고, 건강한 2군 최고 능력치 선수를 1군으로 보충
 * 2) 1군 타자 타순(1~9번)을 테이블세터(출루·주력) -> 중심타선(파워·클러치) 순으로 자동 정렬
 * 3) 1군 투수 로테이션을 1~5선발(SP) -> 셋업(RP) -> 마무리(CP) 순으로 자동 정리
 */
export function autoOptimizeTeamRoster(roster: Player[]): Player[] {
  let next = roster.map(p => ({ ...p }));

  // 1) 부상 1군 선수 2군 전환
  next = next.map(p => (p.tier === 'FIRST_TEAM' && p.isInjured ? { ...p, tier: 'SECOND_TEAM' as const } : p));

  // 2) 건강한 1군 야수 최소 9명 확보
  const healthyFirstBatters = next.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM' && !p.isInjured);
  if (healthyFirstBatters.length < 9) {
    const needed = 9 - healthyFirstBatters.length;
    const candidates = next
      .filter(p => p.role === 'BATTER' && p.tier === 'SECOND_TEAM' && !p.isInjured)
      .sort((a, b) => calculatePlayerTradeValue(b) - calculatePlayerTradeValue(a))
      .slice(0, needed);
    const callIds = new Set(candidates.map(c => c.id));
    next = next.map(p => (callIds.has(p.id) ? { ...p, tier: 'FIRST_TEAM' as const } : p));
  }

  // 3) 건강한 1군 투수 최소 7명(선발 포함) 확보
  const healthyFirstPitchers = next.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && !p.isInjured);
  if (healthyFirstPitchers.length < 7) {
    const needed = 7 - healthyFirstPitchers.length;
    const candidates = next
      .filter(p => p.role === 'PITCHER' && p.tier === 'SECOND_TEAM' && !p.isInjured)
      .sort((a, b) => calculatePlayerTradeValue(b) - calculatePlayerTradeValue(a))
      .slice(0, needed);
    const callIds = new Set(candidates.map(c => c.id));
    next = next.map(p => (callIds.has(p.id) ? { ...p, tier: 'FIRST_TEAM' as const } : p));
  }

  const firstBatters = next.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM');
  const firstPitchers = next.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM');
  const secondTeam = next.filter(p => p.tier === 'SECOND_TEAM');

  // 타순 자동 최적화
  const sortedBatters = [...firstBatters].sort((a, b) => {
    const sa = a.batterStats;
    const sb = b.batterStats;
    const scoreA = (sa?.contact || 60) * 1.1 + (sa?.power || 60) * 1.0 + (sa?.eye || 60) * 0.9;
    const scoreB = (sb?.contact || 60) * 1.1 + (sb?.power || 60) * 1.0 + (sb?.eye || 60) * 0.9;
    return scoreB - scoreA;
  });

  if (sortedBatters.length >= 5) {
    const top5 = sortedBatters.slice(0, 5);
    const rest = sortedBatters.slice(5);
    const leadoff = [...top5].sort(
      (a, b) =>
        ((b.batterStats?.speed || 0) + (b.batterStats?.eye || 0)) -
        ((a.batterStats?.speed || 0) + (a.batterStats?.eye || 0))
    );
    const first = leadoff[0];
    const second = leadoff[1];
    const cleanups = top5
      .filter(p => p.id !== first.id && p.id !== second.id)
      .sort((a, b) => (b.batterStats?.power || 0) - (a.batterStats?.power || 0));
    sortedBatters.splice(0, sortedBatters.length, first, second, ...cleanups, ...rest);
  }

  // 투수 로테이션 자동 정렬: SP (능력치 순) -> RP -> CP
  const roleOrder: Record<string, number> = { SP: 0, RP: 1, CP: 2 };
  const sortedPitchers = [...firstPitchers].sort((a, b) => {
    const ra = roleOrder[a.primaryPosition] ?? 1;
    const rb = roleOrder[b.primaryPosition] ?? 1;
    if (ra !== rb) return ra - rb;
    return calculatePlayerTradeValue(b) - calculatePlayerTradeValue(a);
  });

  return [...sortedBatters, ...sortedPitchers, ...secondTeam];
}

/**
 * 종료된 경기에서 노히트/완봉, 10탈삼진, 멀티홈런, 4안타 등 속보 뉴스 자동 생성
 */
export function detectMatchHighlightNews(
  game: LiveGameState,
  seasonNumber: number,
  day: number
): LeagueNewsItem[] {
  const items: LeagueNewsItem[] = [];
  const boxList = Object.values(game.playerBoxStats || {});
  const rosterLookup = [
    ...game.battingOrderAway,
    ...game.battingOrderHome,
    game.currentPitcherAway,
    game.currentPitcherHome,
    ...(game.bullpenAway || []),
    ...(game.bullpenHome || []),
  ];

  const findInfo = (playerId: string) => {
    const p = rosterLookup.find(r => r.id === playerId);
    const team = p?.teamId === game.homeTeam.id ? game.homeTeam : game.awayTeam;
    return { player: p, team };
  };

  // 타자 대기록
  boxList
    .filter(b => b.role === 'BATTER')
    .forEach(b => {
      const { player, team } = findInfo(b.playerId);
      if (!player) return;
      if (b.homeRuns >= 2) {
        items.push({
          id: `news_hr_${game.gameId}_${b.playerId}`,
          seasonNumber,
          day,
          category: 'RECORD',
          title: `🔥 ${team.name} ${player.name}, 한 경기 ${b.homeRuns}홈런 폭발!`,
          detail: `${game.awayTeam.name} ${game.score.away}:${game.score.home} ${game.homeTeam.name} 경기에서 ${b.atBats}타수 ${b.hits}안타 ${b.homeRuns}홈런 ${b.rbi}타점 맹활약`,
        });
      } else if (b.hits >= 4) {
        items.push({
          id: `news_hit_${game.gameId}_${b.playerId}`,
          seasonNumber,
          day,
          category: 'RECORD',
          title: `🏏 ${team.name} ${player.name}, ${b.hits}안타 맹타 휘둘러`,
          detail: `${b.atBats}타수 ${b.hits}안타 ${b.rbi}타점으로 타선을 이끌었습니다.`,
        });
      }
    });

  // 투수 대기록
  boxList
    .filter(p => p.role === 'PITCHER')
    .forEach(p => {
      const { player, team } = findInfo(p.playerId);
      if (!player) return;
      if (p.inningsOuts >= 27 && p.earnedRuns === 0 && p.hitsAllowed === 0) {
        items.push({
          id: `news_nh_${game.gameId}_${p.playerId}`,
          seasonNumber,
          day,
          category: 'RECORD',
          title: `👑 [대기록] ${team.name} ${player.name}, 노히트 노런 달성!`,
          detail: `9이닝 ${p.pitcherStrikeouts}탈삼진 무실점 완벽투로 JBL 역사를 새로 썼습니다!`,
        });
      } else if (p.inningsOuts >= 24 && p.earnedRuns === 0) {
        items.push({
          id: `news_so_${game.gameId}_${p.playerId}`,
          seasonNumber,
          day,
          category: 'RECORD',
          title: `⚡ ${team.name} ${player.name}, 완봉급 무실점 역투`,
          detail: `${Math.floor(p.inningsOuts / 3)}이닝 ${p.pitcherStrikeouts}탈삼진 무실점으로 상대 타선을 봉쇄했습니다.`,
        });
      } else if (p.pitcherStrikeouts >= 9) {
        items.push({
          id: `news_k_${game.gameId}_${p.playerId}`,
          seasonNumber,
          day,
          category: 'RECORD',
          title: `💨 닥터K ${player.name}(${team.name}), ${p.pitcherStrikeouts}탈삼진 쇼`,
          detail: `${Math.floor(p.inningsOuts / 3)}.${p.inningsOuts % 3}이닝 동안 ${p.pitcherStrikeouts}개의 삼진을 뽑아냈습니다.`,
        });
      }
    });

  // 대승 / 1점 차 명승부
  const diff = Math.abs(game.score.home - game.score.away);
  if (diff >= 7) {
    const winT = game.score.home > game.score.away ? game.homeTeam : game.awayTeam;
    const loseT = game.score.home > game.score.away ? game.awayTeam : game.homeTeam;
    items.push({
      id: `news_blow_${game.gameId}`,
      seasonNumber,
      day,
      category: 'MATCH',
      title: `📢 ${winT.name}, ${loseT.name} 상대 ${diff}점 차 화력 대승`,
      detail: `${game.awayTeam.name} ${game.score.away} : ${game.score.home} ${game.homeTeam.name} (${game.hits.away}안타 vs ${game.hits.home}안타)`,
    });
  }

  return items;
}

/**
 * 시즌 결산 MVP, 신인왕, 개인 타이틀, 골든글러브 자동 선정
 */
export function computeSeasonAwards(
  seasonNumber: number,
  championTeamName: string,
  teams: Team[],
  playersMap: Record<string, Player[]>
): SeasonAwardRecord {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const allBatters: Array<{ player: Player; team: Team }> = [];
  const allPitchers: Array<{ player: Player; team: Team }> = [];

  teams.forEach(t => {
    (playersMap[t.id] || []).forEach(p => {
      if (p.role === 'BATTER') allBatters.push({ player: p, team: t });
      if (p.role === 'PITCHER') allPitchers.push({ player: p, team: t });
    });
  });

  const makeEntry = (player: Player, team: Team, summary: string, posOverride?: string): AwardWinnerEntry => ({
    playerId: player.id,
    playerName: player.name,
    teamId: team.id,
    teamName: team.name,
    position: posOverride || player.primaryPosition,
    summary,
  });

  const batterAvg = (p: Player) => {
    const s = p.batterStats;
    return s && s.atBats > 0 ? s.hits / s.atBats : (s?.contact || 60) / 300;
  };
  const batterOps = (p: Player) => {
    const s = p.batterStats;
    if (!s || s.atBats === 0) return 0.7;
    const obp = (s.hits + s.walks) / Math.max(1, s.atBats + s.walks);
    const slg = (s.hits + s.doubles + s.triples * 2 + s.homeRuns * 3) / s.atBats;
    return obp + slg;
  };
  const batterWarProxy = (p: Player, team: Team) => {
    const s = p.batterStats;
    const teamBonus = (team.wins - team.losses) * 0.25;
    if (!s || s.atBats === 0) return (s?.contact || 60) + (s?.power || 60) + teamBonus;
    return s.hits * 1.1 + s.homeRuns * 4.5 + s.rbi * 0.9 + s.walks * 0.7 + s.stolenBases * 0.8 + teamBonus;
  };
  const pitcherWarProxy = (p: Player, team: Team) => {
    const s = p.pitcherStats;
    const teamBonus = (team.wins - team.losses) * 0.25;
    if (!s || s.inningsOuts === 0) return (s?.stuff || 60) + (s?.control || 60) + teamBonus;
    const ip = s.inningsOuts / 3;
    const era = (s.earnedRuns * 9) / Math.max(1, ip);
    return s.wins * 7 + s.saves * 4 + s.holds * 2 + s.strikeouts * 0.7 + Math.max(0, (4.8 - era) * 10) + teamBonus;
  };
  const pitcherEra = (p: Player) => {
    const s = p.pitcherStats;
    const ip = (s?.inningsOuts || 0) / 3;
    return ip > 0 ? (s!.earnedRuns * 9) / ip : 3.99;
  };

  // MVP (타자 + 투수 통합 최고 활약)
  const mvpCandidates = [
    ...allBatters.map(x => ({
      ...x,
      score: batterWarProxy(x.player, x.team),
      summary: x.player.batterStats?.atBats
        ? `타율 ${batterAvg(x.player).toFixed(3)} · ${x.player.batterStats.homeRuns}홈런 · ${x.player.batterStats.rbi}타점`
        : `컨택 ${x.player.batterStats?.contact} · 파워 ${x.player.batterStats?.power}`,
    })),
    ...allPitchers.map(x => ({
      ...x,
      score: pitcherWarProxy(x.player, x.team),
      summary: x.player.pitcherStats?.inningsOuts
        ? `${x.player.pitcherStats.wins}승 ${x.player.pitcherStats.losses}패 · ERA ${pitcherEra(x.player).toFixed(2)} · ${x.player.pitcherStats.strikeouts}K`
        : `구속 ${x.player.pitcherStats?.velocity}km/h · 구위 ${x.player.pitcherStats?.stuff}`,
    })),
  ].sort((a, b) => b.score - a.score);

  const mvpPick = mvpCandidates[0];

  // 신인왕 (만 22세 이하)
  const rookieCandidates = mvpCandidates.filter(c => c.player.age <= 22);
  const rookiePick = rookieCandidates[0] || mvpCandidates[mvpCandidates.length - 1] || mvpPick;

  // 타격왕
  const avgPick = [...allBatters]
    .filter(x => (x.player.batterStats?.atBats || 0) >= 5 || allBatters.every(b => (b.player.batterStats?.atBats || 0) < 5))
    .sort((a, b) => batterAvg(b.player) - batterAvg(a.player))[0] || allBatters[0];

  // 홈런왕
  const hrPick = [...allBatters].sort(
    (a, b) => (b.player.batterStats?.homeRuns || 0) - (a.player.batterStats?.homeRuns || 0) || batterOps(b.player) - batterOps(a.player)
  )[0];

  // 타점왕
  const rbiPick = [...allBatters].sort(
    (a, b) => (b.player.batterStats?.rbi || 0) - (a.player.batterStats?.rbi || 0)
  )[0];

  // 다승왕
  const winsPick = [...allPitchers].sort(
    (a, b) => (b.player.pitcherStats?.wins || 0) - (a.player.pitcherStats?.wins || 0) || pitcherEra(a.player) - pitcherEra(b.player)
  )[0];

  // 방어율왕
  const eraPool = allPitchers.filter(x => (x.player.pitcherStats?.inningsOuts || 0) >= 9);
  const eraPick = [...(eraPool.length > 0 ? eraPool : allPitchers)].sort(
    (a, b) => pitcherEra(a.player) - pitcherEra(b.player)
  )[0];

  // 탈삼진왕
  const kPick = [...allPitchers].sort(
    (a, b) => (b.player.pitcherStats?.strikeouts || 0) - (a.player.pitcherStats?.strikeouts || 0)
  )[0];

  // 골든글러브 (투수, 포수, 내야 4개, 외야 3명, 지명타자)
  const pickPos = (positions: Position[], label: string): AwardWinnerEntry => {
    if (positions.includes('SP')) {
      const topP = [...allPitchers].sort((a, b) => pitcherWarProxy(b.player, b.team) - pitcherWarProxy(a.player, a.team))[0];
      const s = topP.player.pitcherStats;
      return makeEntry(
        topP.player,
        topP.team,
        s?.inningsOuts ? `${s.wins}승 · ERA ${pitcherEra(topP.player).toFixed(2)} · ${s.strikeouts}K` : `구속 ${s?.velocity}km/h`,
        label
      );
    }
    const pool = allBatters.filter(x => positions.includes(x.player.primaryPosition));
    const chosen = [...(pool.length > 0 ? pool : allBatters)].sort(
      (a, b) => batterWarProxy(b.player, b.team) - batterWarProxy(a.player, a.team)
    )[0];
    const bs = chosen.player.batterStats;
    return makeEntry(
      chosen.player,
      chosen.team,
      bs?.atBats ? `타율 ${batterAvg(chosen.player).toFixed(3)} · ${bs.homeRuns}홈런 · ${bs.rbi}타점` : `컨택 ${bs?.contact}`,
      label
    );
  };

  const ofSorted = [...allBatters]
    .filter(x => ['LF', 'CF', 'RF'].includes(x.player.primaryPosition))
    .sort((a, b) => batterWarProxy(b.player, b.team) - batterWarProxy(a.player, a.team));

  const goldenGlove: AwardWinnerEntry[] = [
    pickPos(['SP', 'RP', 'CP'], '투수'),
    pickPos(['C'], '포수'),
    pickPos(['1B'], '1루수'),
    pickPos(['2B'], '2루수'),
    pickPos(['3B'], '3루수'),
    pickPos(['SS'], '유격수'),
    ...[0, 1, 2].map(idx => {
      const pick = ofSorted[idx] || allBatters[idx % allBatters.length];
      const bs = pick.player.batterStats;
      return makeEntry(
        pick.player,
        pick.team,
        bs?.atBats ? `타율 ${batterAvg(pick.player).toFixed(3)} · ${bs.homeRuns}홈런 · ${bs.rbi}타점` : `컨택 ${bs?.contact}`,
        '외야수'
      );
    }),
    pickPos(['DH'], '지명타자'),
  ];

  const fallbackTeam = teams[0] || teamMap.values().next().value!;

  return {
    seasonNumber,
    championTeamName,
    mvp: makeEntry(mvpPick.player, mvpPick.team, mvpPick.summary),
    rookieOfYear: makeEntry(rookiePick.player, rookiePick.team, rookiePick.summary),
    battingTitle: makeEntry(
      avgPick.player,
      avgPick.team,
      `타율 ${batterAvg(avgPick.player).toFixed(3)} (${avgPick.player.batterStats?.hits || 0}안타)`
    ),
    homeRunKing: makeEntry(
      hrPick.player,
      hrPick.team,
      `${hrPick.player.batterStats?.homeRuns || 0}홈런 (${hrPick.player.batterStats?.rbi || 0}타점)`
    ),
    rbiKing: makeEntry(
      rbiPick.player,
      rbiPick.team,
      `${rbiPick.player.batterStats?.rbi || 0}타점 (타율 ${batterAvg(rbiPick.player).toFixed(3)})`
    ),
    winsKing: makeEntry(
      winsPick.player,
      winsPick.team,
      `${winsPick.player.pitcherStats?.wins || 0}승 ${winsPick.player.pitcherStats?.losses || 0}패`
    ),
    eraKing: makeEntry(
      eraPick.player,
      eraPick.team,
      `ERA ${pitcherEra(eraPick.player).toFixed(2)}`
    ),
    strikeoutKing: makeEntry(
      kPick.player,
      kPick.team,
      `${kPick.player.pitcherStats?.strikeouts || 0}탈삼진`
    ),
    goldenGlove,
  };
}


