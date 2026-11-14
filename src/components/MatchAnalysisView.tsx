/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Wrench,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Sparkles,
  Play,
  ArrowLeftRight,
  Target,
  Activity,
} from 'lucide-react';
import { MatchRecord, PendingApproval, Player, Team } from '../types/baseball';
import { calculatePlayerTradeValue } from '../utils/simulationEngine';
import { soundEffects } from '../utils/audio';

interface MatchAnalysisViewProps {
  userTeam: Team;
  allTeams: Team[];
  userRoster: Player[];
  allPlayers: Record<string, Player[]>;
  matchHistory: MatchRecord[];
  seasonNumber: number;
  currentDay: number;
  onUpdateTeam: (updatedTeam: Team) => void;
  onUpdateTeamRoster: (teamId: string, updatedRoster: Player[]) => void;
  onQueueTradeApproval: (approval: PendingApproval) => void;
  onOpenPlayerDetail: (player: Player) => void;
  onStartMatch: () => void;
}

interface WeaknessRecommendation {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'GOOD';
  category: string;
  title: string;
  diagnosis: string;
  actionLabel: string;
  cost: number; // 단위: 만원 (0이면 무료 전술/편성 보완)
  isApplied?: boolean;
  onFix: () => void;
}

export const MatchAnalysisView: React.FC<MatchAnalysisViewProps> = ({
  userTeam,
  allTeams,
  userRoster,
  allPlayers,
  matchHistory,
  seasonNumber,
  currentDay,
  onUpdateTeam,
  onUpdateTeamRoster,
  onQueueTradeApproval,
  onOpenPlayerDetail,
  onStartMatch,
}) => {
  const [toast, setToast] = useState<{ type: 'SUCCESS' | 'ERROR'; text: string } | null>(null);
  const [appliedFixIds, setAppliedFixIds] = useState<string[]>([]);

  const showToast = (type: 'SUCCESS' | 'ERROR', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. 우리 구단 vs 리그 전체 전력/기록 비교 계산
  const analytics = useMemo(() => {
    const computeTeamMetrics = (teamId: string) => {
      const roster = allPlayers[teamId] || [];
      const batters = roster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM');
      const pitchers = roster.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM');
      const allBat = batters.length > 0 ? batters : roster.filter(p => p.role === 'BATTER');
      const allPit = pitchers.length > 0 ? pitchers : roster.filter(p => p.role === 'PITCHER');

      const avgContact = allBat.length
        ? allBat.reduce((s, p) => s + (p.batterStats?.contact || 60), 0) / allBat.length
        : 60;
      const avgPower = allBat.length
        ? allBat.reduce((s, p) => s + (p.batterStats?.power || 60), 0) / allBat.length
        : 60;
      const avgEye = allBat.length
        ? allBat.reduce((s, p) => s + (p.batterStats?.eye || 60), 0) / allBat.length
        : 60;
      const avgSpeed = allBat.length
        ? allBat.reduce((s, p) => s + (p.batterStats?.speed || 60), 0) / allBat.length
        : 60;
      const avgDefense = allBat.length
        ? allBat.reduce((s, p) => s + (p.batterStats?.defense || 60), 0) / allBat.length
        : 60;

      const avgControl = allPit.length
        ? allPit.reduce((s, p) => s + (p.pitcherStats?.control || 60), 0) / allPit.length
        : 60;
      const avgStuff = allPit.length
        ? allPit.reduce((s, p) => s + (p.pitcherStats?.stuff || 60), 0) / allPit.length
        : 60;
      const avgVelo = allPit.length
        ? allPit.reduce((s, p) => s + (p.pitcherStats?.velocity || 143), 0) / allPit.length
        : 143;

      let totalAB = 0;
      let totalH = 0;
      let totalHR = 0;
      let totalBB = 0;
      let totalOuts = 0;
      let totalER = 0;
      let totalHA = 0;
      let totalBBA = 0;

      roster.forEach(p => {
        if (p.batterStats) {
          totalAB += p.batterStats.atBats;
          totalH += p.batterStats.hits;
          totalHR += p.batterStats.homeRuns;
          totalBB += p.batterStats.walks;
        }
        if (p.pitcherStats) {
          totalOuts += p.pitcherStats.inningsOuts;
          totalER += p.pitcherStats.earnedRuns;
          totalHA += p.pitcherStats.hitsAllowed;
          totalBBA += p.pitcherStats.walksAllowed;
        }
      });

      const batAvg = totalAB > 0 ? totalH / totalAB : 0;
      const obp = totalAB + totalBB > 0 ? (totalH + totalBB) / (totalAB + totalBB) : 0;
      const era = totalOuts > 0 ? (totalER * 9) / (totalOuts / 3) : 0;
      const whip = totalOuts > 0 ? (totalHA + totalBBA) / (totalOuts / 3) : 0;

      return {
        avgContact,
        avgPower,
        avgEye,
        avgSpeed,
        avgDefense,
        avgControl,
        avgStuff,
        avgVelo,
        batAvg,
        obp,
        totalHR,
        era,
        whip,
        totalAB,
        totalOuts,
      };
    };

    const my = computeTeamMetrics(userTeam.id);
    const others = allTeams.map(t => computeTeamMetrics(t.id));
    const n = Math.max(1, others.length);

    const league = {
      avgContact: others.reduce((s, x) => s + x.avgContact, 0) / n,
      avgPower: others.reduce((s, x) => s + x.avgPower, 0) / n,
      avgEye: others.reduce((s, x) => s + x.avgEye, 0) / n,
      avgSpeed: others.reduce((s, x) => s + x.avgSpeed, 0) / n,
      avgDefense: others.reduce((s, x) => s + x.avgDefense, 0) / n,
      avgControl: others.reduce((s, x) => s + x.avgControl, 0) / n,
      avgStuff: others.reduce((s, x) => s + x.avgStuff, 0) / n,
      avgVelo: others.reduce((s, x) => s + x.avgVelo, 0) / n,
      batAvg: others.reduce((s, x) => s + x.batAvg, 0) / n,
      era: others.filter(x => x.totalOuts > 0).length
        ? others.filter(x => x.totalOuts > 0).reduce((s, x) => s + x.era, 0) / others.filter(x => x.totalOuts > 0).length
        : 0,
    };

    // 최근 우리 팀 경기 기록 분석
    const userMatches = matchHistory.filter(
      m => m.isUserMatch || m.homeTeamName === userTeam.name || m.awayTeamName === userTeam.name
    );

    let matchWins = 0;
    let matchLosses = 0;
    let totalScored = 0;
    let totalAllowed = 0;
    let totalMyHits = 0;
    let oneRunLosses = 0;

    const h2hMap: Record<string, { wins: number; losses: number; draws: number; rs: number; ra: number }> = {};

    userMatches.forEach(m => {
      const isHome = m.homeTeamName === userTeam.name;
      const myScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;
      const myHits = isHome ? m.homeHits : m.awayHits;
      const oppName = isHome ? m.awayTeamName : m.homeTeamName;

      totalScored += myScore;
      totalAllowed += oppScore;
      totalMyHits += myHits;

      if (myScore > oppScore) matchWins += 1;
      else if (myScore < oppScore) {
        matchLosses += 1;
        if (oppScore - myScore === 1) oneRunLosses += 1;
      }

      const curr = h2hMap[oppName] || { wins: 0, losses: 0, draws: 0, rs: 0, ra: 0 };
      if (myScore > oppScore) curr.wins += 1;
      else if (myScore < oppScore) curr.losses += 1;
      else curr.draws += 1;
      curr.rs += myScore;
      curr.ra += oppScore;
      h2hMap[oppName] = curr;
    });

    const gamesPlayed = userMatches.length;
    const avgScored = gamesPlayed > 0 ? totalScored / gamesPlayed : 0;
    const avgAllowed = gamesPlayed > 0 ? totalAllowed / gamesPlayed : 0;
    const avgHits = gamesPlayed > 0 ? totalMyHits / gamesPlayed : 0;

    // 1군/2군 전력 역전 여부 체크
    const firstBatters = userRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM');
    const secondBatters = userRoster.filter(p => p.role === 'BATTER' && p.tier === 'SECOND_TEAM');
    const firstPitchers = userRoster.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM');
    const secondPitchers = userRoster.filter(p => p.role === 'PITCHER' && p.tier === 'SECOND_TEAM');

    const batterScore = (p: Player) =>
      p.batterStats ? p.batterStats.contact * 0.4 + p.batterStats.power * 0.35 + p.batterStats.eye * 0.25 : 0;
    const pitcherScore = (p: Player) =>
      p.pitcherStats ? p.pitcherStats.control * 0.4 + p.pitcherStats.stuff * 0.4 + (p.pitcherStats.velocity - 120) * 0.5 : 0;

    const weakestFirstBatter = [...firstBatters].sort((a, b) => batterScore(a) - batterScore(b))[0];
    const strongestSecondBatter = [...secondBatters].sort((a, b) => batterScore(b) - batterScore(a))[0];

    const weakestFirstPitcher = [...firstPitchers].sort((a, b) => pitcherScore(a) - pitcherScore(b))[0];
    const strongestSecondPitcher = [...secondPitchers].sort((a, b) => pitcherScore(b) - pitcherScore(a))[0];

    const hasLineupUpgrade =
      Boolean(weakestFirstBatter && strongestSecondBatter && batterScore(strongestSecondBatter) > batterScore(weakestFirstBatter) + 1);
    const hasPitcherUpgrade =
      Boolean(weakestFirstPitcher && strongestSecondPitcher && pitcherScore(strongestSecondPitcher) > pitcherScore(weakestFirstPitcher) + 1);

    // 타순 정렬 최적화 필요 여부 체크 (1~4번에 주력/타격 스코어가 최적 순서인지)
    const top4Score = firstBatters.slice(0, 4).reduce((s, p) => s + batterScore(p), 0);
    const best4Score = [...firstBatters]
      .sort((a, b) => batterScore(b) - batterScore(a))
      .slice(0, 4)
      .reduce((s, p) => s + batterScore(p), 0);
    const needsOrderOptimization = hasLineupUpgrade || best4Score > top4Score + 4;

    return {
      my,
      league,
      userMatches,
      gamesPlayed,
      matchWins,
      matchLosses,
      avgScored,
      avgAllowed,
      avgHits,
      oneRunLosses,
      h2hMap,
      weakestFirstBatter,
      strongestSecondBatter,
      weakestFirstPitcher,
      strongestSecondPitcher,
      hasLineupUpgrade,
      hasPitcherUpgrade,
      needsOrderOptimization,
      batterScore,
      pitcherScore,
    };
  }, [allPlayers, allTeams, matchHistory, userRoster, userTeam]);

  // 2. [보완하기] 실행 핸들러들
  const markFixed = (id: string) => {
    setAppliedFixIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // 처방 1: AI 최적 타순 & 1·2군 승격 자동 재편성 (무료)
  const handleFixOptimizeLineup = () => {
    const allBatters = userRoster.filter(p => p.role === 'BATTER');
    const nonBatters = userRoster.filter(p => p.role !== 'BATTER');

    const sortedBatters = [...allBatters].sort((a, b) => analytics.batterScore(b) - analytics.batterScore(a));
    const nextFirst = sortedBatters.slice(0, 11).map(p => ({ ...p, tier: 'FIRST_TEAM' as const }));
    const nextSecond = sortedBatters.slice(11).map(p => ({ ...p, tier: 'SECOND_TEAM' as const }));

    // 1·2번은 출루/주력 우수자, 3·4·5번은 파워/클러치 중심타선으로 정렬
    const starters = nextFirst.slice(0, 9);
    const bench = nextFirst.slice(9);
    if (starters.length >= 5) {
      const tableSetters = [...starters]
        .sort((a, b) => ((b.batterStats?.eye || 0) + (b.batterStats?.speed || 0)) - ((a.batterStats?.eye || 0) + (a.batterStats?.speed || 0)))
        .slice(0, 2);
      const remaining = starters.filter(p => !tableSetters.some(t => t.id === p.id));
      const cleanup = [...remaining]
        .sort((a, b) => ((b.batterStats?.power || 0) + (b.batterStats?.clutch || 0)) - ((a.batterStats?.power || 0) + (a.batterStats?.clutch || 0)))
        .slice(0, 3);
      const lowerOrder = remaining
        .filter(p => !cleanup.some(c => c.id === p.id))
        .sort((a, b) => analytics.batterScore(b) - analytics.batterScore(a));
      const optimizedFirst = [...tableSetters, ...cleanup, ...lowerOrder, ...bench];
      onUpdateTeamRoster(userTeam.id, [...optimizedFirst, ...nextSecond, ...nonBatters]);
    } else {
      onUpdateTeamRoster(userTeam.id, [...nextFirst, ...nextSecond, ...nonBatters]);
    }

    soundEffects.playCrowdCheer(false);
    markFixed('fix_lineup');
    showToast('SUCCESS', '최적 타순 재편성 및 2군 상위 타자 1군 콜업 보완이 완료되었습니다!');
  };

  // 처방 2: 타격 화력 집중 교정 캠프
  const handleFixBattingPower = () => {
    const cost = 5000;
    if (userTeam.budget < cost) {
      showToast('ERROR', '구단 자금이 부족합니다! (필요 예산: 5천만원)');
      return;
    }

    const updatedRoster = userRoster.map(p => {
      if (p.role !== 'BATTER' || p.tier !== 'FIRST_TEAM' || !p.batterStats) return p;
      return {
        ...p,
        exp: p.exp + 80,
        batterStats: {
          ...p.batterStats,
          contact: Math.min(99, p.batterStats.contact + 2),
          power: Math.min(99, p.batterStats.power + 2),
          eye: Math.min(99, p.batterStats.eye + 1),
        },
      };
    });

    onUpdateTeam({ ...userTeam, budget: userTeam.budget - cost });
    onUpdateTeamRoster(userTeam.id, updatedRoster);
    soundEffects.playBatHit(false, 90);
    markFixed('fix_batting');
    showToast('SUCCESS', '1군 타자 전원 컨택+2 · 파워+2 · 선구안+1 긴급 타격 보완이 완료되었습니다!');
  };

  // 처방 3: 마운드 제구·구위 안정화 특훈
  const handleFixPitchingStaff = () => {
    const cost = 5000;
    if (userTeam.budget < cost) {
      showToast('ERROR', '구단 자금이 부족합니다! (필요 예산: 5천만원)');
      return;
    }

    const updatedRoster = userRoster.map(p => {
      if (p.role !== 'PITCHER' || p.tier !== 'FIRST_TEAM' || !p.pitcherStats) return p;
      return {
        ...p,
        exp: p.exp + 80,
        pitcherStats: {
          ...p.pitcherStats,
          control: Math.min(99, p.pitcherStats.control + 2),
          stuff: Math.min(99, p.pitcherStats.stuff + 2),
          clutch: Math.min(99, p.pitcherStats.clutch + 2),
        },
      };
    });

    onUpdateTeam({ ...userTeam, budget: userTeam.budget - cost });
    onUpdateTeamRoster(userTeam.id, updatedRoster);
    soundEffects.playCrowdCheer(false);
    markFixed('fix_pitching');
    showToast('SUCCESS', '1군 투수진 전원 제구+2 · 구위+2 · 위기관리+2 마운드 보완이 완료되었습니다!');
  };

  // 처방 4: 2군 핵심 투수 콜업 & 투수진 엔트리 정비 (무료)
  const handleFixPitcherRotation = () => {
    const allPitchers = userRoster.filter(p => p.role === 'PITCHER');
    const nonPitchers = userRoster.filter(p => p.role !== 'PITCHER');
    const sortedPitchers = [...allPitchers].sort((a, b) => analytics.pitcherScore(b) - analytics.pitcherScore(a));
    const nextFirst = sortedPitchers.slice(0, 9).map(p => ({ ...p, tier: 'FIRST_TEAM' as const }));
    const nextSecond = sortedPitchers.slice(9).map(p => ({ ...p, tier: 'SECOND_TEAM' as const }));

    onUpdateTeamRoster(userTeam.id, [...nonPitchers, ...nextFirst, ...nextSecond]);
    soundEffects.playCrowdCheer(false);
    markFixed('fix_pitcher_tier');
    showToast('SUCCESS', '투수진 전력 순으로 1군/2군 엔트리 최적 보완이 완료되었습니다!');
  };

  // 처방 5: 취약 포지션 외부 트레이드 보완 제안 알림 띄우기 (무료)
  const handleFixWeakPositionTrade = () => {
    const targetSwap = analytics.weakestFirstBatter || analytics.weakestFirstPitcher;
    if (!targetSwap) return;

    const myVal = calculatePlayerTradeValue(targetSwap);
    const otherTeams = allTeams.filter(t => t.id !== userTeam.id);
    let bestUpgrade: { team: Team; player: Player; val: number } | null = null;

    otherTeams.forEach(t => {
      const oppRoster = allPlayers[t.id] || [];
      oppRoster.forEach(op => {
        if (op.role !== targetSwap.role) return;
        const val = calculatePlayerTradeValue(op);
        if (val >= myVal - 2 && val <= myVal + 14) {
          if (!bestUpgrade || val > bestUpgrade.val) {
            bestUpgrade = { team: t, player: op, val };
          }
        }
      });
    });

    if (!bestUpgrade) {
      showToast('ERROR', '현재 타 구단에서 조건이 맞는 즉시 전력감 트레이드 매물을 찾지 못했습니다.');
      return;
    }

    const found = bestUpgrade as { team: Team; player: Player; val: number };
    onQueueTradeApproval({
      id: `appr_analysis_fix_${Date.now()}`,
      category: 'TRADE_INCOMING',
      title: `[전력 분석 처방] ${found.team.name} 맞춤형 보강 트레이드`,
      subtitle: `취약 포지션(${targetSwap.primaryPosition}) 보강을 위한 스카우트 긴급 추천안`,
      createdAtDay: currentDay,
      seasonNumber,
      fromTeamId: found.team.id,
      toTeamId: userTeam.id,
      offeredPlayer: found.player,
      requestedPlayer: targetSwap,
      evaluationSummary: `경기 분석 결과 취약 포지션인 ${targetSwap.name}(가치 ${myVal}점) 대신 ${found.team.name}의 ${found.player.name}(${found.player.primaryPosition}, 가치 ${found.val}점) 영입을 추천합니다. 승인 시 즉시 보강됩니다.`,
    });
    markFixed('fix_trade_scout');
    showToast('SUCCESS', '취약 포지션 보강 트레이드 제안 알림창을 띄웠습니다!');
  };

  // 처방 6: 취약 훈련 시설 긴급 증축
  const handleFixLowestFacility = () => {
    const entries: Array<{ key: keyof Team['facilityLevels']; label: string; lv: number }> = [
      { key: 'battingCage', label: '타격 훈련장', lv: userTeam.facilityLevels.battingCage },
      { key: 'pitchingLab', label: '투구 분석 랩', lv: userTeam.facilityLevels.pitchingLab },
      { key: 'weightRoom', label: '웨이트장', lv: userTeam.facilityLevels.weightRoom },
      { key: 'medicalCenter', label: '메디컬 센터', lv: userTeam.facilityLevels.medicalCenter },
    ];
    entries.sort((a, b) => a.lv - b.lv);
    const lowest = entries[0];
    const cost = (lowest.lv + 1) * 30000;
    if (userTeam.budget < cost) {
      showToast('ERROR', `${lowest.label} 증축 예산이 부족합니다! (필요: ${(cost / 10000).toLocaleString()}억원)`);
      return;
    }

    onUpdateTeam({
      ...userTeam,
      budget: userTeam.budget - cost,
      facilityLevels: {
        ...userTeam.facilityLevels,
        [lowest.key]: lowest.lv + 1,
      },
    });
    soundEffects.playCrowdCheer(false);
    markFixed('fix_facility');
    showToast('SUCCESS', `최약체 인프라인 [${lowest.label}]이 Lv.${lowest.lv + 1}로 증축되었습니다!`);
  };

  // 3. 자동 진단된 우리 팀 보완할 점 리스트 생성
  const recommendations: WeaknessRecommendation[] = [];

  if (analytics.needsOrderOptimization) {
    recommendations.push({
      id: 'fix_lineup',
      severity: 'HIGH',
      category: '타순 & 엔트리',
      title: analytics.hasLineupUpgrade
        ? `2군 유망주(${analytics.strongestSecondBatter?.name})가 1군 하위 타자(${analytics.weakestFirstBatter?.name})보다 뛰어납니다`
        : '중심 타선(1~5번) 배치 비효율 감지',
      diagnosis:
        '출루율·주력이 뛰어난 타자를 1·2번에, 장타력과 클러치가 높은 타자를 3·4·5번에 배치하고 2군 고능력 타자를 1군으로 승격하면 경기당 득점이 상승합니다.',
      actionLabel: '보완하기 (최적 타순·1군 자동 편성)',
      cost: 0,
      isApplied: appliedFixIds.includes('fix_lineup'),
      onFix: handleFixOptimizeLineup,
    });
  }

  if (
    analytics.my.avgContact < analytics.league.avgContact + 1 ||
    analytics.my.avgPower < analytics.league.avgPower + 1 ||
    (analytics.gamesPlayed > 0 && analytics.avgScored < 4.5)
  ) {
    recommendations.push({
      id: 'fix_batting',
      severity: analytics.my.avgContact < analytics.league.avgContact - 1 ? 'HIGH' : 'MEDIUM',
      category: '타선 득점력',
      title: `타선 화력 보강 필요 (평균 컨택 ${analytics.my.avgContact.toFixed(1)} vs 리그 ${analytics.league.avgContact.toFixed(1)})`,
      diagnosis:
        analytics.gamesPlayed > 0
          ? `최근 경기 평균 득점이 ${analytics.avgScored.toFixed(1)}점에 머물러 있습니다. 1군 주전 타자들의 컨택·파워 집중 교정이 필요합니다.`
          : '타선 컨택·파워 지표를 리그 상위권으로 끌어올려 다득점 기반을 다질 수 있습니다.',
      actionLabel: '보완하기 (타선 화력 집중 교정)',
      cost: 5000,
      isApplied: appliedFixIds.includes('fix_batting'),
      onFix: handleFixBattingPower,
    });
  }

  if (
    analytics.my.avgControl < analytics.league.avgControl + 1 ||
    analytics.my.avgStuff < analytics.league.avgStuff + 1 ||
    (analytics.gamesPlayed > 0 && analytics.avgAllowed > 4.5)
  ) {
    recommendations.push({
      id: 'fix_pitching',
      severity: analytics.my.avgControl < analytics.league.avgControl - 1 ? 'HIGH' : 'MEDIUM',
      category: '마운드 실점 억제',
      title: `투수진 제구·구위 보강 필요 (제구 ${analytics.my.avgControl.toFixed(1)} · 구위 ${analytics.my.avgStuff.toFixed(1)})`,
      diagnosis:
        analytics.gamesPlayed > 0
          ? `경기당 평균 실점이 ${analytics.avgAllowed.toFixed(1)}점으로 높습니다(1점 차 패배 ${analytics.oneRunLosses}회). 볼넷과 피장타를 줄이는 투구 교정이 효과적입니다.`
          : '투수진의 제구력과 구위를 함께 끌어올려 실점 위기 관리 능력을 보완하세요.',
      actionLabel: '보완하기 (마운드 제구·구위 보완)',
      cost: 5000,
      isApplied: appliedFixIds.includes('fix_pitching'),
      onFix: handleFixPitchingStaff,
    });
  }

  if (analytics.hasPitcherUpgrade) {
    recommendations.push({
      id: 'fix_pitcher_tier',
      severity: 'HIGH',
      category: '투수 로테이션',
      title: `2군 투수(${analytics.strongestSecondPitcher?.name}) 1군 즉시 전력감 대기 중`,
      diagnosis: `2군에 있는 ${analytics.strongestSecondPitcher?.name} 선수가 현재 1군 하위 투수(${analytics.weakestFirstPitcher?.name})보다 높은 투구 점수를 기록하고 있습니다.`,
      actionLabel: '보완하기 (1·2군 투수진 재편성)',
      cost: 0,
      isApplied: appliedFixIds.includes('fix_pitcher_tier'),
      onFix: handleFixPitcherRotation,
    });
  }

  recommendations.push({
    id: 'fix_trade_scout',
    severity: 'MEDIUM',
    category: '외부 전력 영입',
    title: `취약 슬롯(${(analytics.weakestFirstBatter || analytics.weakestFirstPitcher)?.name || '로스터'}) 트레이드 업그레이드 탐색`,
    diagnosis:
      '스카우트 분석을 통해 우리 구단에서 가장 가치가 낮은 포지션 자원을 타 구단 즉시 전력감과 교환하는 맞춤 트레이드 알림을 생성합니다.',
    actionLabel: '보완하기 (맞춤 트레이드 제안 받기)',
    cost: 0,
    isApplied: appliedFixIds.includes('fix_trade_scout'),
    onFix: handleFixWeakPositionTrade,
  });

  const minFacLv = Math.min(
    userTeam.facilityLevels.battingCage,
    userTeam.facilityLevels.pitchingLab,
    userTeam.facilityLevels.weightRoom,
    userTeam.facilityLevels.medicalCenter
  );
  if (minFacLv < 5) {
    recommendations.push({
      id: 'fix_facility',
      severity: minFacLv <= 2 ? 'MEDIUM' : 'GOOD',
      category: '구단 인프라',
      title: `최저 레벨 훈련 시설(Lv.${minFacLv}) 자동 육성 효율 강화`,
      diagnosis:
        '구단 시설 레벨이 낮으면 매일 진행되는 전 구단 자동 육성에서 타 구단 유망주에게 성장 속도가 밀릴 수 있습니다.',
      actionLabel: '보완하기 (최약체 시설 증축)',
      cost: (minFacLv + 1) * 30000,
      isApplied: appliedFixIds.includes('fix_facility'),
      onFix: handleFixLowestFacility,
    });
  }

  const statMeters = [
    { label: '타격 컨택', my: analytics.my.avgContact, lg: analytics.league.avgContact },
    { label: '타격 파워', my: analytics.my.avgPower, lg: analytics.league.avgPower },
    { label: '선구안', my: analytics.my.avgEye, lg: analytics.league.avgEye },
    { label: '주루·수비', my: (analytics.my.avgSpeed + analytics.my.avgDefense) / 2, lg: (analytics.league.avgSpeed + analytics.league.avgDefense) / 2 },
    { label: '투수 제구', my: analytics.my.avgControl, lg: analytics.league.avgControl },
    { label: '투수 구위', my: analytics.my.avgStuff, lg: analytics.league.avgStuff },
  ];

  const h2hEntries = Object.entries(analytics.h2hMap);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border shadow-sm ${
            toast.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {toast.type === 'SUCCESS' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="text-xs uppercase tracking-wider text-sky-600 font-bold">
            Match Analytics & Team Improvement Lab
          </span>
          <h2 className="text-xl font-display font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" /> {userTeam.name} 경기 분석 & 전력 보완 센터
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            최근 경기 득실점 흐름과 리그 10개 구단 평균 데이터를 비교하여 우리 팀의 약점을 진단하고, <strong>[보완하기]</strong> 버튼으로 즉시 전력을 개선하세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="bg-sky-50 px-3.5 py-2 rounded-xl border border-sky-200 text-left sm:text-right">
            <span className="text-[11px] text-slate-500 block">구단 보유 자금</span>
            <span className="text-sm font-mono-numbers font-bold text-sky-700">
              {(userTeam.budget / 10000).toLocaleString()} 억원
            </span>
          </div>
          <button
            onClick={onStartMatch}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" /> 오늘 경기 진행
          </button>
        </div>
      </div>

      {/* 1. KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">경기당 평균 득점 / 안타</span>
          <div className="mt-1 flex items-baseline gap-2 font-mono-numbers">
            <span className="text-2xl font-extrabold text-sky-700">
              {analytics.gamesPlayed > 0 ? analytics.avgScored.toFixed(1) : '-'}점
            </span>
            <span className="text-xs text-slate-500">
              ({analytics.gamesPlayed > 0 ? `${analytics.avgHits.toFixed(1)}안타` : '경기 전'})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            시즌 팀 타율 {analytics.my.totalAB > 0 ? analytics.my.batAvg.toFixed(3) : '.000'} · {analytics.my.totalHR}홈런
          </span>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">경기당 평균 실점 / ERA</span>
          <div className="mt-1 flex items-baseline gap-2 font-mono-numbers">
            <span className="text-2xl font-extrabold text-rose-600">
              {analytics.gamesPlayed > 0 ? analytics.avgAllowed.toFixed(1) : '-'}점
            </span>
            <span className="text-xs text-slate-500">
              (ERA {analytics.my.totalOuts > 0 ? analytics.my.era.toFixed(2) : '0.00'})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            1점 차 석패 {analytics.oneRunLosses}경기 · WHIP {analytics.my.totalOuts > 0 ? analytics.my.whip.toFixed(2) : '0.00'}
          </span>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">누적 분석 경기 수</span>
          <div className="mt-1 flex items-baseline gap-2 font-mono-numbers">
            <span className="text-2xl font-extrabold text-slate-900">{analytics.gamesPlayed}경기</span>
            <span className="text-xs font-bold text-emerald-600">
              {analytics.matchWins}승 {analytics.matchLosses}패
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            제 {seasonNumber}회차 {currentDay}일차 기준
          </span>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">발견된 보완 포인트</span>
          <div className="mt-1 flex items-baseline gap-2 font-mono-numbers">
            <span className="text-2xl font-extrabold text-amber-600">
              {recommendations.filter(r => !r.isApplied && r.severity !== 'GOOD').length}건
            </span>
            <span className="text-xs text-emerald-600 font-bold">
              (보완 완료 {appliedFixIds.length}건)
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">아래 [보완하기] 버튼으로 즉시 개선</span>
        </div>
      </div>

      {/* 2. Team Power vs League Average Comparison + Key Weakest/Strongest */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: League Average Comparison Bars (Col 5) */}
        <div className="lg:col-span-5 bg-white border border-sky-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600" /> 우리 팀 vs 리그 10개 구단 평균 전력 비교
          </h3>

          <div className="space-y-3">
            {statMeters.map(m => {
              const diff = m.my - m.lg;
              const isAbove = diff >= 0;
              return (
                <div key={m.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono-numbers">
                    <span className="font-sans font-bold text-slate-700">{m.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{m.my.toFixed(1)}</span>
                      <span className="text-slate-400 text-[11px]">(리그 {m.lg.toFixed(1)})</span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.2 rounded ${
                          isAbove ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {isAbove ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isAbove ? 'bg-sky-500' : 'bg-rose-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(10, m.my))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weakest link spotlight */}
          <div className="pt-3 border-t border-sky-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 block">집중 점검 대상 선수 (클릭 시 상세 확인)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {analytics.weakestFirstBatter && (
                <button
                  onClick={() => onOpenPlayerDetail(analytics.weakestFirstBatter)}
                  className="p-2.5 rounded-xl bg-rose-50/60 hover:bg-rose-100/70 border border-rose-200 text-left transition-colors"
                >
                  <span className="text-[10px] font-bold text-rose-700 block">1군 최저 타격 지표</span>
                  <span className="text-xs font-bold text-slate-900">
                    {analytics.weakestFirstBatter.name} ({analytics.weakestFirstBatter.primaryPosition})
                  </span>
                </button>
              )}
              {analytics.weakestFirstPitcher && (
                <button
                  onClick={() => onOpenPlayerDetail(analytics.weakestFirstPitcher)}
                  className="p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 text-left transition-colors"
                >
                  <span className="text-[10px] font-bold text-amber-800 block">1군 최저 투구 지표</span>
                  <span className="text-xs font-bold text-slate-900">
                    {analytics.weakestFirstPitcher.name} ({analytics.weakestFirstPitcher.primaryPosition})
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actionable Weakness & [보완하기] Cards (Col 7) */}
        <div className="lg:col-span-7 bg-white border border-sky-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-600" /> 우리 팀 보완할 점 진단 & 즉시 보완 처방
            </h3>
            <span className="text-[11px] text-slate-500">버튼 클릭 시 즉시 구단에 적용됩니다</span>
          </div>

          <div className="space-y-3">
            {recommendations.map(rec => {
              const badgeCls =
                rec.severity === 'HIGH'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : rec.severity === 'MEDIUM'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-sky-100 text-sky-800 border-sky-200';
              const badgeText = rec.severity === 'HIGH' ? '시급 보완' : rec.severity === 'MEDIUM' ? '개선 권장' : '강화 가능';

              return (
                <div
                  key={rec.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    rec.isApplied
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-sky-50/50 border-sky-100 hover:border-sky-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeCls}`}>
                          {badgeText}
                        </span>
                        <span className="text-[11px] font-bold text-sky-700">{rec.category}</span>
                      </div>
                      <h4 className="font-display font-bold text-sm text-slate-900">{rec.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{rec.diagnosis}</p>
                    </div>

                    <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-1">
                      <button
                        onClick={rec.onFix}
                        disabled={rec.isApplied}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold shadow-sm transition-all whitespace-nowrap ${
                          rec.isApplied
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                            : 'bg-sky-500 hover:bg-sky-600 text-white active:scale-95'
                        }`}
                      >
                        {rec.isApplied ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> 보완 완료
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" /> {rec.actionLabel}
                          </>
                        )}
                      </button>
                      <span className="text-[10px] font-mono-numbers text-slate-500 text-right">
                        {rec.cost === 0 ? '비용: 무료 (즉시 반영)' : `소요 자금: ${(rec.cost / 10000).toLocaleString()}억원`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Recent Match Breakdown & Opponent Head-to-Head Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Matches */}
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-sky-600" /> {userTeam.name} 최근 경기 결과 분석
            </span>
            <span className="text-[11px] text-slate-500">최근 15경기</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-sky-100/70">
            {analytics.userMatches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <ShieldAlert className="w-6 h-6 text-sky-300 mx-auto" />
                <p>아직 진행된 경기가 없습니다. 경기를 1경기 이상 진행하면 득실점·안타·상대 전적 분석이 누적됩니다.</p>
              </div>
            ) : (
              analytics.userMatches.slice(0, 15).map(m => {
                const isHome = m.homeTeamName === userTeam.name;
                const myScore = isHome ? m.homeScore : m.awayScore;
                const oppScore = isHome ? m.awayScore : m.homeScore;
                const oppName = isHome ? m.awayTeamName : m.homeTeamName;
                const myHits = isHome ? m.homeHits : m.awayHits;
                const oppHits = isHome ? m.awayHits : m.homeHits;
                const outcome = myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무';
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-sky-50/40">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center ${
                          outcome === '승'
                            ? 'bg-emerald-100 text-emerald-700'
                            : outcome === '패'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {outcome}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 block">
                          vs {oppName} ({isHome ? '홈' : '원정'})
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono-numbers">
                          {m.seasonNumber}회 {m.day}일차
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono-numbers">
                      <span className="font-extrabold text-sm text-sky-700">
                        {myScore} : {oppScore}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        안타 {myHits} : {oppHits}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Opponent Head-to-Head */}
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4 text-sky-600" /> 구단별 상대 전적 분석
            </span>
            <span className="text-[11px] text-slate-500">맞대결 성적</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-sky-100/70">
            {h2hEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                경기를 진행하면 각 상대 구단별 승패 및 평균 득실 마진이 자동으로 분석됩니다.
              </div>
            ) : (
              h2hEntries.map(([oppName, stat]) => {
                const games = stat.wins + stat.losses + stat.draws;
                const diff = stat.rs - stat.ra;
                return (
                  <div key={oppName} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-sky-50/40">
                    <div>
                      <span className="font-bold text-slate-900">{oppName}</span>
                      <span className="text-[11px] text-slate-400 ml-2 font-mono-numbers">({games}경기)</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono-numbers">
                      <span className="font-bold text-slate-800">
                        <span className="text-emerald-600">{stat.wins}승</span> {stat.draws}무{' '}
                        <span className="text-rose-500">{stat.losses}패</span>
                      </span>
                      <span className={`font-bold ${diff >= 0 ? 'text-sky-600' : 'text-rose-500'}`}>
                        득실 {diff >= 0 ? `+${diff}` : diff}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
