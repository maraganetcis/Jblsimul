/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AutoGrowthLog, LiveGameState, PendingApproval, PitchResult, PlayLogEntry, Player, PlayerGameBoxStat, Team } from '../types/baseball';
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
  options?: { isUserGame?: boolean; rotationDay?: number }
): LiveGameState {
  const awayBatters = awayRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM').slice(0, 9);
  const homeBatters = homeRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM').slice(0, 9);

  // Fallback if roster has fewer than 9 first-team batters
  const safeAwayBatters = awayBatters.length > 0 ? awayBatters : awayRoster.filter(p => p.role === 'BATTER').slice(0, 9);
  const safeHomeBatters = homeBatters.length > 0 ? homeBatters : homeRoster.filter(p => p.role === 'BATTER').slice(0, 9);

  const awaySPs = awayRoster.filter(p => p.role === 'PITCHER' && p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM');
  const homeSPs = homeRoster.filter(p => p.role === 'PITCHER' && p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM');

  const rotIdx = Math.max(0, (options?.rotationDay || 1) - 1);
  const awaySP =
    awaySPs[rotIdx % Math.max(1, awaySPs.length)] ||
    awayRoster.find(p => p.role === 'PITCHER')!;
  const homeSP =
    homeSPs[rotIdx % Math.max(1, homeSPs.length)] ||
    homeRoster.find(p => p.role === 'PITCHER')!;

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

export function simulateNextPitch(
  state: LiveGameState,
  tactic: TacticChoice = 'NORMAL',
  silent = false
): LiveGameState {
  if (state.isFinished) return state;

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
  currentDay: number
): { nextPlayersMap: Record<string, Player[]>; growthLogs: AutoGrowthLog[] } {
  const nextMap: Record<string, Player[]> = {};
  const growthLogs: AutoGrowthLog[] = [];

  const potExpMap: Record<string, number> = { S: 52, A: 42, B: 32, C: 24, D: 16 };

  teams.forEach(team => {
    const roster = playersMap[team.id] || [];
    const batFac = team.facilityLevels?.battingCage || 2;
    const pitchFac = team.facilityLevels?.pitchingLab || 2;
    const weightFac = team.facilityLevels?.weightRoom || 2;
    const medFac = team.facilityLevels?.medicalCenter || 2;

    nextMap[team.id] = roster.map(player => {
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
          // Pick 2 distinct stats to improve
          const first = statKeys[Math.floor(Math.random() * statKeys.length)];
          let second = statKeys[Math.floor(Math.random() * statKeys.length)];
          if (second.key === first.key) {
            second = statKeys[(statKeys.indexOf(first) + 1) % statKeys.length];
          }
          const boost1 = player.potential === 'S' || player.potential === 'A' ? 2 : 1;
          const boost2 = 1;
          nextBatterStats[first.key] = Math.min(99, nextBatterStats[first.key] + boost1);
          nextBatterStats[second.key] = Math.min(99, nextBatterStats[second.key] + boost2);
          gainedParts.push(`${first.label}+${boost1}`, `${second.label}+${boost2}`);
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
  });

  return { nextPlayersMap: nextMap, growthLogs };
}

export function generateDailyApprovals(
  teams: Team[],
  playersMap: Record<string, Player[]>,
  userTeamId: string,
  seasonNumber: number,
  currentDay: number,
  growthLogs: AutoGrowthLog[]
): PendingApproval[] {
  const approvals: PendingApproval[] = [];
  const userTeam = teams.find(t => t.id === userTeamId);
  const userRoster = playersMap[userTeamId] || [];
  const otherTeams = teams.filter(t => t.id !== userTeamId);

  if (!userTeam || otherTeams.length === 0 || userRoster.length === 0) return approvals;

  // 1) 타 구단이 우리 구단에 트레이드 제안 (매 경기 후 55% 확률)
  if (Math.random() < 0.55) {
    const shuffledOthers = [...otherTeams].sort(() => Math.random() - 0.5);
    for (const opp of shuffledOthers) {
      const oppRoster = playersMap[opp.id] || [];
      if (oppRoster.length === 0) continue;

      const userCandidate = userRoster[Math.floor(Math.random() * userRoster.length)];
      const userVal = calculatePlayerTradeValue(userCandidate);

      // 비슷한 가치의 상대 선수 찾기
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
    return p?.tier === 'SECOND_TEAM';
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

