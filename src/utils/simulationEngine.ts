/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LiveGameState, PitchResult, PlayLogEntry, Player, Team } from '../types/baseball';
import { soundEffects } from './audio';

export type TacticChoice = 'NORMAL' | 'BUNT' | 'STEAL' | 'INTENTIONAL_WALK' | 'HIT_AND_RUN';

export function createNewGame(awayTeam: Team, homeTeam: Team, awayRoster: Player[], homeRoster: Player[]): LiveGameState {
  const awayBatters = awayRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM').slice(0, 9);
  const homeBatters = homeRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM').slice(0, 9);

  const awaySP = awayRoster.find(p => p.role === 'PITCHER' && p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM') || awayRoster.find(p => p.role === 'PITCHER')!;
  const homeSP = homeRoster.find(p => p.role === 'PITCHER' && p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM') || homeRoster.find(p => p.role === 'PITCHER')!;

  return {
    gameId: `game_${Date.now()}`,
    isUserGame: true,
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
    battingOrderAway: awayBatters,
    battingOrderHome: homeBatters,
    orderIndexAway: 0,
    orderIndexHome: 0,
    currentPitcherAway: { ...awaySP },
    currentPitcherHome: { ...homeSP },
    pitchCountAway: 0,
    pitchCountHome: 0,
    playLogs: [
      {
        id: `log_start`,
        inning: 1,
        isTop: true,
        batterName: awayBatters[0]?.name || '타자',
        pitcherName: homeSP.name,
        balls: 0,
        strikes: 0,
        outs: 0,
        description: `⚾ ${homeTeam.homeStadium}에서 펼쳐지는 ${awayTeam.name} vs ${homeTeam.name}의 경기가 시작됩니다! 선발 투수: ${homeSP.name}(${homeTeam.name}) vs ${awaySP.name}(${awayTeam.name})`,
        highlightType: 'TACTIC',
      }
    ],
    isFinished: false,
  };
}

export function simulateNextPitch(state: LiveGameState, tactic: TacticChoice = 'NORMAL'): LiveGameState {
  if (state.isFinished) return state;

  const currentTeam = state.isTop ? state.awayTeam : state.homeTeam;
  const defenseTeam = state.isTop ? state.homeTeam : state.awayTeam;
  const currentBatters = state.isTop ? state.battingOrderAway : state.battingOrderHome;
  const currentOrderIdx = state.isTop ? state.orderIndexAway : state.orderIndexHome;
  const currentBatter = currentBatters[currentOrderIdx % currentBatters.length];
  const currentPitcher = state.isTop ? state.currentPitcherHome : state.currentPitcherAway;

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

  const currentPitchCount = (state.isTop ? state.pitchCountHome : state.pitchCountAway) + 1;
  if (state.isTop) state.pitchCountHome = currentPitchCount;
  else state.pitchCountAway = currentPitchCount;

  // 구종 선택
  const pitchTypes = ['직구', '슬라이더', '커브', '체인지업', '포크볼'];
  const pitchType = pitchTypes[Math.floor(Math.random() * pitchTypes.length)];
  const baseVelo = currentPitcher.pitcherStats?.velocity || 144;
  const staminaPenalty = Math.max(0, (currentPitchCount - 65) * 0.1);
  const velocity = Math.round(baseVelo - staminaPenalty + (Math.random() * 4 - 2));

  // 고의사구 처리
  if (tactic === 'INTENTIONAL_WALK') {
    soundEffects.playUmpireCall(false);
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
    }
    const logText = `${currentPitcher.name} 투수, ${currentBatter.name} 타자에게 벤치의 지시로 고의사구를 허용합니다. (1루 출루)`;
    return finalizePlateAppearance(state, logText, 'WALK', newBases, newScore, newInningScores, newHits, newErrors, newOuts);
  }

  // 도루 시도 처리
  if (tactic === 'STEAL' && (newBases.first || newBases.second)) {
    const runner = newBases.first || newBases.second;
    const runnerSpeed = runner?.batterStats?.speed || 60;
    const catcherDefense = 70;
    const isSuccess = Math.random() * 100 < (runnerSpeed * 0.9 - catcherDefense * 0.2 + 25);

    if (isSuccess) {
      soundEffects.playCrowdCheer(false);
      if (newBases.first && !newBases.second) {
        newBases.second = newBases.first;
        newBases.first = null;
      } else if (newBases.second && !newBases.third) {
        newBases.third = newBases.second;
        newBases.second = null;
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
      return { ...state, bases: newBases, playLogs: [logEntry, ...state.playLogs] };
    } else {
      soundEffects.playCatch();
      soundEffects.playUmpireCall(false);
      newOuts += 1;
      if (newBases.first) newBases.first = null;
      else if (newBases.second) newBases.second = null;

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
        return handleInningChange({ ...state, outs: newOuts, bases: newBases, playLogs: [logEntry, ...state.playLogs] });
      }
      return { ...state, outs: newOuts, bases: newBases, playLogs: [logEntry, ...state.playLogs] };
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
      soundEffects.playCatch();
      soundEffects.playUmpireCall(newStrikes === 3);
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
      soundEffects.playCatch();
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
    // 스윙 시: 번트, 헛스윙, 파울, 인플레이 타구 계산
    if (tactic === 'BUNT') {
      const buntSuccess = Math.random() < 0.75;
      if (buntSuccess) {
        soundEffects.playBatHit(false, 30);
        newOuts += 1;
        // 주자 진루
        if (newBases.second) {
          newBases.third = newBases.second;
          newBases.second = null;
        }
        if (newBases.first) {
          newBases.second = newBases.first;
          newBases.first = null;
        }
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
        return finalizePlateAppearance(state, pitchResult.narrative, 'OUT', newBases, newScore, newInningScores, newHits, newErrors, newOuts, pitchResult);
      } else {
        newStrikes += 1;
        soundEffects.playFoul();
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
      // 일반 스윙
      const whiffProb = isStrikeZone
        ? Math.max(0.08, 0.22 + (stuff - contact) * 0.003)
        : Math.max(0.35, 0.58 + (stuff - eye) * 0.003);
      const isWhiff = Math.random() < whiffProb;

      if (isWhiff) {
        newStrikes += 1;
        soundEffects.playCatch();
        soundEffects.playUmpireCall(newStrikes === 3);
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
        // 배트에 맞춤: 파울 vs 페어 인플레이
        const foulProb = 0.38 + (state.strikes === 2 ? 0.12 : 0);
        const isFoul = Math.random() < foulProb;

        if (isFoul) {
          if (newStrikes < 2) newStrikes += 1;
          soundEffects.playFoul();
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
          // 인플레이 타구 (In-Play Hit / Out)
          return handleInPlayHit(state, currentBatter, currentPitcher, velocity, pitchType, zoneRow, zoneCol, power, contact, newBases, newScore, newInningScores, newHits, newErrors, newOuts);
        }
      }
    }
  }

  // 볼넷 혹은 삼진 체크
  if (newBalls >= 4) {
    soundEffects.playUmpireCall(false);
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
    }
    const narrative = `📢 4구째 볼! ${currentBatter.name} 선수가 침착하게 볼넷을 골라 1루로 걸어나갑니다!`;
    return finalizePlateAppearance(state, narrative, 'WALK', newBases, newScore, newInningScores, newHits, newErrors, newOuts, pitchResult);
  }

  if (newStrikes >= 3) {
    newOuts += 1;
    soundEffects.playUmpireCall(true);
    const narrative = `🔥 3구 삼진 아웃! ${currentPitcher.name} 투수의 위력적인 ${velocity}km/h ${pitchType}에 ${currentBatter.name} 타자 삼진으로 물러납니다!`;
    return finalizePlateAppearance(state, narrative, 'STRIKEOUT', newBases, newScore, newInningScores, newHits, newErrors, newOuts, pitchResult);
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
  outs: number
): LiveGameState {
  const parkFactor = state.homeTeam.staminaParkFactor || 1.0;
  const hrChance = Math.max(0.02, (power * 0.0016 - 0.04) * parkFactor);
  const extraBaseChance = 0.16 + (power * 0.001);
  const hitRoll = Math.random();

  let runsScored = 0;
  let newBases = { ...bases };
  let logText = '';
  let highlight: PlayLogEntry['highlightType'] = 'HIT';
  let hitType: PitchResult['hitType'] = 'SINGLE';
  let hitDistance = Math.round(85 + (power * 0.35) + (Math.random() * 20));

  if (hitRoll < hrChance) {
    // 홈런 (Home Run!)
    hitType = 'HOMERUN';
    hitDistance = Math.round(115 + (power * 0.25) + (Math.random() * 25));
    soundEffects.playBatHit(true, power);
    highlight = 'HOMERUN';

    let runnersOnBase = 1; // 타자 본인
    if (newBases.first) runnersOnBase += 1;
    if (newBases.second) runnersOnBase += 1;
    if (newBases.third) runnersOnBase += 1;
    runsScored = runnersOnBase;

    newBases = { first: null, second: null, third: null };
    if (state.isTop) hits.away += 1;
    else hits.home += 1;

    const hrTypes = ['솔로', '2점', '3점', '만루'];
    const hrDesc = hrTypes[Math.min(3, runnersOnBase - 1)];
    logText = `💥💥 경쾌한 타구음! ${batter.name} 타자가 ${pitcher.name}의 ${velocity}km/h ${pitchType}을 완벽하게 통타! 좌중간 담장을 까마득하게 넘어가는 비거리 ${hitDistance}m 특대형 ${hrDesc} 홈런을 쏘아 올립니다!`;
  } else if (hitRoll < hrChance + extraBaseChance * 0.5) {
    // 2루타 (Double)
    hitType = 'DOUBLE';
    soundEffects.playBatHit(false, power);
    if (newBases.third) { runsScored += 1; newBases.third = null; }
    if (newBases.second) { runsScored += 1; newBases.second = null; }
    if (newBases.first) {
      if (Math.random() < 0.6) { runsScored += 1; }
      else { newBases.third = newBases.first; }
      newBases.first = null;
    }
    newBases.second = batter;
    if (state.isTop) hits.away += 1;
    else hits.home += 1;
    logText = `⚡ 우중간을 완전히 가르는 깊숙한 타구! ${batter.name} 타자 여유 있게 2루까지 내달립니다! (2루타)`;
  } else if (hitRoll < hrChance + extraBaseChance * 0.5 + 0.28) {
    // 단타 (Single)
    hitType = 'SINGLE';
    soundEffects.playBatHit(false, power * 0.8);
    if (newBases.third) { runsScored += 1; newBases.third = null; }
    if (newBases.second) {
      if (Math.random() < 0.55) { runsScored += 1; }
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
    logText = `⚾ 깨끗한 중전 안타! ${batter.name} 선수의 날카로운 스윙이 중견수 앞에 떨어집니다!`;
  } else {
    // 아웃 (땅볼, 플라이, 병살타)
    soundEffects.playCatch();
    if (outs < 2 && newBases.first && Math.random() < 0.28) {
      // 6-4-3 or 4-6-3 병살타 (Double Play)
      outs += 2;
      hitType = 'DOUBLE_PLAY';
      newBases.first = null;
      if (newBases.third && outs < 3) { runsScored += 1; newBases.third = null; }
      logText = `🚫 유격수 앞 날카로운 땅볼! 2루 터치 거쳐 1루까지 완벽한 6-4-3 더블플레이로 연결됩니다! (병살타)`;
      highlight = 'OUT';
    } else if (newBases.third && outs < 2 && Math.random() < 0.35) {
      // 희생플라이
      outs += 1;
      hitType = 'SAC_FLY';
      runsScored += 1;
      newBases.third = null;
      logText = `🎯 중견수 깊숙한 플라이 아웃! 그 사이 3루 주자가 태그업하여 여유 있게 홈을 밟습니다! (희생플라이)`;
      highlight = 'OUT';
    } else {
      // 일반 아웃 (땅볼/뜬공)
      outs += 1;
      hitType = Math.random() < 0.5 ? 'GROUNDOUT' : 'FLYOUT';
      logText = hitType === 'GROUNDOUT'
        ? `내야 땅볼 타구, 1루수가 침착하게 잡아 베이스를 터치하며 타자를 아웃 처리합니다.`
        : `높게 뜬 타구, 우익수가 침착하게 포구 위치를 잡고 뜬공으로 처리합니다.`;
      highlight = 'OUT';
    }
  }

  if (runsScored > 0) {
    if (state.isTop) {
      score.away += runsScored;
      inningScores.away[state.inning - 1] = (inningScores.away[state.inning - 1] || 0) + runsScored;
    } else {
      score.home += runsScored;
      inningScores.home[state.inning - 1] = (inningScores.home[state.inning - 1] || 0) + runsScored;
    }
    soundEffects.playCrowdCheer(true);
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

  return finalizePlateAppearance(state, logText, highlight, newBases, score, inningScores, hits, errors, outs, pitchResult);
}

function advanceRunnersOnWalk(bases: { first: Player | null; second: Player | null; third: Player | null }, batter: Player): {
  bases: { first: Player | null; second: Player | null; third: Player | null };
  runsScored: number;
} {
  let runsScored = 0;
  const newBases = { ...bases };

  if (newBases.first) {
    if (newBases.second) {
      if (newBases.third) {
        // 만루 밀어내기 볼넷
        runsScored = 1;
      }
      newBases.third = newBases.second;
    }
    newBases.second = newBases.first;
  }
  newBases.first = batter;
  return { bases: newBases, runsScored };
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
  lastPitch?: PitchResult
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

  // 다음 타순 인덱스
  const nextOrderAway = state.isTop ? state.orderIndexAway + 1 : state.orderIndexAway;
  const nextOrderHome = !state.isTop ? state.orderIndexHome + 1 : state.orderIndexHome;

  // 9회말 끝내기 승리 체크
  if (state.inning >= 9 && !state.isTop && score.home > score.away) {
    soundEffects.playCrowdCheer(true);
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
    };
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
    });
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

function handleInningChange(state: LiveGameState): LiveGameState {
  soundEffects.playUmpireCall(false);

  // 9회초 종료 시 홈팀 리드인 경우 9회말 없이 즉시 홈팀 승리 종료
  if (state.inning >= 9 && state.isTop && state.score.home > state.score.away) {
    return {
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
    };
  }

  // 9회말 이후 무승부/경기종료 체크
  if (state.inning >= 9 && !state.isTop) {
    if (state.score.away !== state.score.home || state.inning >= 12) {
      // 경기 종료
      const winningTeam = state.score.away > state.score.home ? state.awayTeam : state.score.home > state.score.away ? state.homeTeam : undefined;
      return {
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
      };
    }
  }

  // 이닝 교대 (초 -> 말 또는 말 -> 다음 회초)
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
export function simulateFullPlateAppearance(state: LiveGameState, tactic: TacticChoice = 'NORMAL'): LiveGameState {
  let curr = state;
  const initialOrderIdx = curr.isTop ? curr.orderIndexAway : curr.orderIndexHome;
  const initialInning = curr.inning;
  const initialIsTop = curr.isTop;

  while (!curr.isFinished) {
    curr = simulateNextPitch(curr, tactic);
    const newOrderIdx = curr.isTop ? curr.orderIndexAway : curr.orderIndexHome;
    if (newOrderIdx !== initialOrderIdx || curr.inning !== initialInning || curr.isTop !== initialIsTop) {
      break;
    }
  }
  return curr;
}

// 반 이닝(Half-Inning) 스킵
export function simulateHalfInning(state: LiveGameState): LiveGameState {
  let curr = state;
  const targetInning = curr.inning;
  const targetIsTop = curr.isTop;

  while (!curr.isFinished && curr.inning === targetInning && curr.isTop === targetIsTop) {
    curr = simulateNextPitch(curr, 'NORMAL');
  }
  return curr;
}

// 경기 종료까지 전체 시뮬레이션
export function simulateUntilGameFinish(state: LiveGameState): LiveGameState {
  let curr = state;
  while (!curr.isFinished) {
    curr = simulateNextPitch(curr, 'NORMAL');
  }
  return curr;
}
