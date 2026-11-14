/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trophy, Award, Clock, Settings, CheckCircle, Calendar, Sparkles, Users, ArrowUpDown, Flame, Play, FastForward, Crown } from 'lucide-react';
import { Team, Player, HistorySeason, MatchRecord, PostseasonState, SeasonAwardRecord, AwardWinnerEntry } from '../types/baseball';
import { computeSeasonAwards } from '../utils/simulationEngine';

interface StandingsRecordViewProps {
  allTeams: Team[];
  allPlayers: Record<string, Player[]>;
  userTeam: Team;
  seasonNumber: number;
  currentDay: number;
  historicalChampions: HistorySeason[];
  matchHistory: MatchRecord[];
  postseasonState: PostseasonState | null;
  seasonAwards?: SeasonAwardRecord[];
  onStartPostseason: (sortedTeams: Team[]) => void;
  onSimulatePostseasonGame: () => void;
  onSimulatePostseasonSeries: () => void;
  onSimulateFullPostseason?: () => void;
  onResetPostseason: () => void;
  onUpdateSeasonAndDay: (nextSeason: number, nextDay: number) => void;
  onAdvanceNextSeason: (championTeamId: string) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

export const StandingsRecordView: React.FC<StandingsRecordViewProps> = ({
  allTeams,
  allPlayers,
  userTeam,
  seasonNumber,
  currentDay,
  historicalChampions,
  matchHistory,
  postseasonState,
  seasonAwards = [],
  onStartPostseason,
  onSimulatePostseasonGame,
  onSimulatePostseasonSeries,
  onSimulateFullPostseason,
  onResetPostseason,
  onUpdateSeasonAndDay,
  onAdvanceNextSeason,
  onOpenPlayerDetail,
}) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'STANDINGS' | 'POSTSEASON' | 'TEAM_STATS' | 'LEADERS' | 'AWARDS' | 'HISTORY' | 'LEAGUE_MGMT'>('STANDINGS');
  const [statsTeamId, setStatsTeamId] = useState<string>(userTeam.id);
  const [statsRoleFilter, setStatsRoleFilter] = useState<'BATTER' | 'PITCHER'>('BATTER');
  const [statsTierFilter, setStatsTierFilter] = useState<'ALL' | 'FIRST_TEAM' | 'SECOND_TEAM'>('ALL');
  const [batterSortBy, setBatterSortBy] = useState<'AVG' | 'HR' | 'RBI' | 'HITS' | 'OPS' | 'SB'>('AVG');
  const [pitcherSortBy, setPitcherSortBy] = useState<'ERA' | 'WINS' | 'SO' | 'SAVES' | 'IP' | 'VELO'>('ERA');
  const [seasonInput, setSeasonInput] = useState<number>(seasonNumber);
  const [dayInput, setDayInput] = useState<number>(currentDay);
  const [selectedChampionId, setSelectedChampionId] = useState<string>('');
  const [showAllLeagueMatches, setShowAllLeagueMatches] = useState<boolean>(true);
  const [mgmtToast, setMgmtToast] = useState<string | null>(null);

  // 팀 순위 정렬
  const sortedTeams = [...allTeams].sort((a, b) => {
    const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    if (rateB !== rateA) return rateB - rateA;
    return b.wins - a.wins;
  });

  const topWins = sortedTeams[0]?.wins || 0;
  const topLosses = sortedTeams[0]?.losses || 0;
  const championCandidateId = selectedChampionId || sortedTeams[0]?.id || userTeam.id;

  // 전체 리그 타자/투수 리더보드 추출
  const allBatters: Array<{ player: Player; teamName: string }> = [];
  const allPitchers: Array<{ player: Player; teamName: string }> = [];

  allTeams.forEach(team => {
    (allPlayers[team.id] || []).forEach(p => {
      if (p.role === 'BATTER' && p.tier === 'FIRST_TEAM') allBatters.push({ player: p, teamName: team.name });
      if (p.role === 'PITCHER' && p.tier === 'FIRST_TEAM') allPitchers.push({ player: p, teamName: team.name });
    });
  });

  // 타율 Top 5
  const avgLeaders = [...allBatters].sort((a, b) => {
    const aAvg = a.player.batterStats?.atBats ? (a.player.batterStats.hits / a.player.batterStats.atBats) : (a.player.batterStats?.contact || 0) / 1000;
    const bAvg = b.player.batterStats?.atBats ? (b.player.batterStats.hits / b.player.batterStats.atBats) : (b.player.batterStats?.contact || 0) / 1000;
    return bAvg - aAvg;
  }).slice(0, 5);

  // 홈런 Top 5
  const hrLeaders = [...allBatters].sort((a, b) => (b.player.batterStats?.homeRuns || 0) - (a.player.batterStats?.homeRuns || 0)).slice(0, 5);

  // 다승 Top 5
  const winLeaders = [...allPitchers].sort((a, b) => (b.player.pitcherStats?.wins || 0) - (a.player.pitcherStats?.wins || 0)).slice(0, 5);

  // 탈삼진 Top 5
  const kLeaders = [...allPitchers].sort((a, b) => (b.player.pitcherStats?.strikeouts || 0) - (a.player.pitcherStats?.strikeouts || 0)).slice(0, 5);

  // ERA Top 5
  const eraLeaders = [...allPitchers]
    .filter(x => (x.player.pitcherStats?.inningsOuts || 0) >= 3)
    .sort((a, b) => {
      const eraA = (a.player.pitcherStats?.earnedRuns || 0) * 9 / ((a.player.pitcherStats?.inningsOuts || 1) / 3);
      const eraB = (b.player.pitcherStats?.earnedRuns || 0) * 9 / ((b.player.pitcherStats?.inningsOuts || 1) / 3);
      return eraA - eraB;
    })
    .slice(0, 5);

  // 타점 Top 5
  const rbiLeaders = [...allBatters].sort((a, b) => (b.player.batterStats?.rbi || 0) - (a.player.batterStats?.rbi || 0)).slice(0, 5);

  // 세이브+홀드 Top 5
  const reliefLeaders = [...allPitchers]
    .sort((a, b) => ((b.player.pitcherStats?.saves || 0) + (b.player.pitcherStats?.holds || 0)) - ((a.player.pitcherStats?.saves || 0) + (a.player.pitcherStats?.holds || 0)))
    .slice(0, 5);

  // 선택 팀 선수별 기록 필터 및 정렬
  const selectedStatsTeam = allTeams.find(t => t.id === statsTeamId) || userTeam;
  const selectedTeamRoster = (allPlayers[selectedStatsTeam.id] || []).filter(p => {
    if (statsTierFilter !== 'ALL' && p.tier !== statsTierFilter) return false;
    return p.role === statsRoleFilter;
  });

  const sortedTeamBatters = statsRoleFilter === 'BATTER'
    ? [...selectedTeamRoster].sort((a, b) => {
        const sa = a.batterStats;
        const sb = b.batterStats;
        const avgA = sa?.atBats ? sa.hits / sa.atBats : 0;
        const avgB = sb?.atBats ? sb.hits / sb.atBats : 0;
        const obpA = sa && sa.atBats + sa.walks > 0 ? (sa.hits + sa.walks) / (sa.atBats + sa.walks) : 0;
        const obpB = sb && sb.atBats + sb.walks > 0 ? (sb.hits + sb.walks) / (sb.atBats + sb.walks) : 0;
        const slgA = sa?.atBats ? (sa.hits + sa.doubles + sa.triples * 2 + sa.homeRuns * 3) / sa.atBats : 0;
        const slgB = sb?.atBats ? (sb.hits + sb.doubles + sb.triples * 2 + sb.homeRuns * 3) / sb.atBats : 0;
        if (batterSortBy === 'HR') return (sb?.homeRuns || 0) - (sa?.homeRuns || 0);
        if (batterSortBy === 'RBI') return (sb?.rbi || 0) - (sa?.rbi || 0);
        if (batterSortBy === 'HITS') return (sb?.hits || 0) - (sa?.hits || 0);
        if (batterSortBy === 'SB') return (sb?.stolenBases || 0) - (sa?.stolenBases || 0);
        if (batterSortBy === 'OPS') return (obpB + slgB) - (obpA + slgA);
        return avgB - avgA || (sb?.contact || 0) - (sa?.contact || 0);
      })
    : [];

  const sortedTeamPitchers = statsRoleFilter === 'PITCHER'
    ? [...selectedTeamRoster].sort((a, b) => {
        const sa = a.pitcherStats;
        const sb = b.pitcherStats;
        const ipA = (sa?.inningsOuts || 0) / 3;
        const ipB = (sb?.inningsOuts || 0) / 3;
        const eraA = ipA > 0 ? (sa!.earnedRuns * 9) / ipA : 99;
        const eraB = ipB > 0 ? (sb!.earnedRuns * 9) / ipB : 99;
        if (pitcherSortBy === 'WINS') return (sb?.wins || 0) - (sa?.wins || 0);
        if (pitcherSortBy === 'SO') return (sb?.strikeouts || 0) - (sa?.strikeouts || 0);
        if (pitcherSortBy === 'SAVES') return ((sb?.saves || 0) + (sb?.holds || 0)) - ((sa?.saves || 0) + (sa?.holds || 0));
        if (pitcherSortBy === 'IP') return (sb?.inningsOuts || 0) - (sa?.inningsOuts || 0);
        if (pitcherSortBy === 'VELO') return (sb?.velocity || 0) - (sa?.velocity || 0);
        return eraA - eraB || (sb?.stuff || 0) - (sa?.stuff || 0);
      })
    : [];

  // 통산 우승 횟수 랭킹 (구단 데이터 기반 동적 집계)
  const championshipRanking = [...allTeams].sort((a, b) => b.championships - a.championships);

  const filteredMatches = showAllLeagueMatches
    ? matchHistory
    : matchHistory.filter(m => m.isUserMatch || m.awayTeamName === userTeam.name || m.homeTeamName === userTeam.name);

  const handleApplySeasonDay = () => {
    const safeSeason = Math.max(1, seasonInput || seasonNumber);
    const safeDay = Math.max(1, dayInput || currentDay);
    onUpdateSeasonAndDay(safeSeason, safeDay);
    setMgmtToast(`현재 리그 진행 시점이 제 ${safeSeason}회차 ${safeDay}일차로 동기화되었습니다.`);
    setTimeout(() => setMgmtToast(null), 3000);
  };

  const handleCrownChampionAndNextSeason = () => {
    const champTeam = allTeams.find(t => t.id === championCandidateId);
    onAdvanceNextSeason(championCandidateId);
    setSeasonInput(seasonNumber + 1);
    setDayInput(1);
    setMgmtToast(`🏆 ${seasonNumber}회차 우승팀 [${champTeam?.name}] 확정! 제 ${seasonNumber + 1}회차 새 시즌이 개막되었습니다.`);
    setTimeout(() => setMgmtToast(null), 4000);
  };

  // 현재 회차 경기 기반 L10 / Streak / 상대전적 매트릭스 계산
  const seasonMatches = matchHistory.filter(m => m.seasonNumber === seasonNumber);

  const getTeamRecentAndStreak = (teamName: string) => {
    // matchHistory는 최신 경기가 앞(index 0)에 있음
    const teamMatches = seasonMatches.filter(m => m.awayTeamName === teamName || m.homeTeamName === teamName);
    const outcomes = teamMatches.map(m => {
      const isHome = m.homeTeamName === teamName;
      const myScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;
      return myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D';
    });

    const last10 = outcomes.slice(0, 10);
    const l10W = last10.filter(x => x === 'W').length;
    const l10L = last10.filter(x => x === 'L').length;
    const l10D = last10.filter(x => x === 'D').length;
    const l10Text = last10.length > 0 ? `${l10W}승 ${l10D > 0 ? `${l10D}무 ` : ''}${l10L}패` : '-';

    let streakText = '-';
    let streakType: 'W' | 'L' | 'D' | null = null;
    if (outcomes.length > 0) {
      streakType = outcomes[0];
      let count = 0;
      for (const res of outcomes) {
        if (res === streakType) count += 1;
        else break;
      }
      streakText = `${count}${streakType === 'W' ? '연승' : streakType === 'L' ? '연패' : '연무'}`;
    }

    return { l10Text, streakText, streakType };
  };

  const getHeadToHead = (teamAName: string, teamBName: string) => {
    let w = 0;
    let l = 0;
    let d = 0;
    seasonMatches.forEach(m => {
      if (m.awayTeamName === teamAName && m.homeTeamName === teamBName) {
        if (m.awayScore > m.homeScore) w += 1;
        else if (m.awayScore < m.homeScore) l += 1;
        else d += 1;
      } else if (m.homeTeamName === teamAName && m.awayTeamName === teamBName) {
        if (m.homeScore > m.awayScore) w += 1;
        else if (m.homeScore < m.awayScore) l += 1;
        else d += 1;
      }
    });
    return { w, l, d };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-sky-600" /> JBL 공식 리그 순위 · 팀/선수별 기록 · 리그 관리실
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            제 {seasonNumber}회차 ({currentDay}일차) 10개 구단 순위, 구단별 전체 선수 시즌 성적, 개인 타이틀 및 회차·경기 기록을 한눈에 조회하세요.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setSelectedSubTab('STANDINGS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedSubTab === 'STANDINGS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            리그 순위·상대전적
          </button>
          <button
            onClick={() => setSelectedSubTab('POSTSEASON')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              selectedSubTab === 'POSTSEASON' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> 포스트시즌
          </button>
          <button
            onClick={() => setSelectedSubTab('TEAM_STATS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              selectedSubTab === 'TEAM_STATS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> 팀별 선수 기록
          </button>
          <button
            onClick={() => setSelectedSubTab('LEADERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedSubTab === 'LEADERS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            개인 타이틀
          </button>
          <button
            onClick={() => setSelectedSubTab('AWARDS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
              selectedSubTab === 'AWARDS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crown className="w-3.5 h-3.5" /> 어워드·전당
          </button>
          <button
            onClick={() => setSelectedSubTab('HISTORY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedSubTab === 'HISTORY' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            역대 우승 족보
          </button>
          <button
            onClick={() => {
              setSeasonInput(seasonNumber);
              setDayInput(currentDay);
              setSelectedSubTab('LEAGUE_MGMT');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
              selectedSubTab === 'LEAGUE_MGMT' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> 회차·경기 관리
          </button>
        </div>
      </div>

      {mgmtToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mgmtToast}</span>
        </div>
      )}

      {/* View 1: 10-Team Standings Table + Head-to-Head Matrix */}
      {selectedSubTab === 'STANDINGS' && (
        <div className="space-y-6">
          <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs font-mono-numbers">
                <thead>
                  <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/60 font-bold">
                    <th className="py-3 px-3 w-14">순위</th>
                    <th className="py-3 px-4 text-left font-display font-semibold text-slate-700">구단명</th>
                    <th className="py-3 px-2 w-14">경기</th>
                    <th className="py-3 px-2 text-emerald-600 font-bold w-12">승</th>
                    <th className="py-3 px-2 text-slate-500 w-10">무</th>
                    <th className="py-3 px-2 text-rose-500 font-bold w-12">패</th>
                    <th className="py-3 px-3 font-bold text-sky-700 w-18">승률</th>
                    <th className="py-3 px-2 text-slate-500 w-14">게임차</th>
                    <th className="py-3 px-2 w-14">득점</th>
                    <th className="py-3 px-2 w-14">실점</th>
                    <th className="py-3 px-2 w-16">득실차</th>
                    <th className="py-3 px-2 w-24">최근10(L10)</th>
                    <th className="py-3 px-2 w-16">연속</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/70">
                  {sortedTeams.map((team, idx) => {
                    const games = team.wins + team.losses + team.draws;
                    const winRate = team.wins + team.losses > 0 ? (team.wins / (team.wins + team.losses)).toFixed(3) : '.000';
                    const gb = idx === 0 ? '-' : (((topWins - team.wins) + (team.losses - topLosses)) / 2).toFixed(1);
                    const margin = team.runsScored - team.runsAllowed;
                    const isUser = team.id === userTeam.id;
                    const { l10Text, streakText, streakType } = getTeamRecentAndStreak(team.name);

                    return (
                      <tr
                        key={team.id}
                        className={`transition-colors ${
                          isUser ? 'bg-sky-50/80 hover:bg-sky-100/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3 font-display font-bold text-sm">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${
                            idx === 0 ? 'bg-amber-400 text-slate-950 font-bold' : idx < 5 ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-left font-display font-bold text-sm flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                          <button
                            onClick={() => {
                              setStatsTeamId(team.id);
                              setSelectedSubTab('TEAM_STATS');
                            }}
                            className="text-slate-900 hover:text-sky-600 transition-colors text-left"
                            title="클릭하여 이 구단의 선수별 기록 보기"
                          >
                            {team.name}
                          </button>
                          {idx < 5 && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 rounded font-bold">
                              PS권
                            </span>
                          )}
                          {isUser && (
                            <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-300 px-1.5 py-0.2 rounded font-bold">
                              MY TEAM
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-slate-700">{games}</td>
                        <td className="py-3 px-2 font-bold text-emerald-600">{team.wins}</td>
                        <td className="py-3 px-2 text-slate-500">{team.draws}</td>
                        <td className="py-3 px-2 font-bold text-rose-500">{team.losses}</td>
                        <td className="py-3 px-3 font-extrabold text-sky-700 text-sm">{winRate}</td>
                        <td className="py-3 px-2 text-slate-500">{gb}</td>
                        <td className="py-3 px-2 text-slate-700">{team.runsScored}</td>
                        <td className="py-3 px-2 text-slate-700">{team.runsAllowed}</td>
                        <td className={`py-3 px-2 font-semibold ${margin > 0 ? 'text-emerald-600' : margin < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                          {margin > 0 ? `+${margin}` : margin}
                        </td>
                        <td className="py-3 px-2 text-slate-700 font-semibold">{l10Text}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                            streakType === 'W'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : streakType === 'L'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'text-slate-400'
                          }`}>
                            {streakText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 10x10 Head-to-Head Matrix */}
          <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-display font-bold text-sky-900">
                제 {seasonNumber}회차 구단 간 상대 전적 매트릭스 (가로 팀 기준 승-무-패)
              </span>
              <span className="text-[11px] text-slate-500">
                총 {seasonMatches.length}경기 누적 결과 반영
              </span>
            </div>
            <div className="overflow-x-auto p-3">
              <table className="w-full text-center text-[11px] font-mono-numbers border-collapse">
                <thead>
                  <tr className="bg-sky-50/60 text-slate-700 border-b border-sky-100">
                    <th className="py-2 px-2 text-left font-display font-bold sticky left-0 bg-sky-50 z-10 min-w-[92px]">구단 ＼ 상대</th>
                    {sortedTeams.map(opp => (
                      <th key={opp.id} className="py-2 px-1.5 font-display font-semibold whitespace-nowrap min-w-[66px]">
                        {opp.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/60">
                  {sortedTeams.map(rowTeam => {
                    const isUserRow = rowTeam.id === userTeam.id;
                    return (
                      <tr key={rowTeam.id} className={isUserRow ? 'bg-sky-50/70' : 'hover:bg-slate-50/70'}>
                        <td className="py-2 px-2 text-left font-display font-bold text-slate-800 sticky left-0 bg-white/95 border-r border-sky-100 whitespace-nowrap">
                          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: rowTeam.color }} />
                          {rowTeam.name}
                        </td>
                        {sortedTeams.map(colTeam => {
                          if (rowTeam.id === colTeam.id) {
                            return (
                              <td key={colTeam.id} className="py-2 px-1.5 bg-slate-100/80 text-slate-400">
                                —
                              </td>
                            );
                          }
                          const h2h = getHeadToHead(rowTeam.name, colTeam.name);
                          const total = h2h.w + h2h.l + h2h.d;
                          const cellCls =
                            total === 0
                              ? 'text-slate-300'
                              : h2h.w > h2h.l
                              ? 'text-emerald-700 bg-emerald-50/50 font-bold'
                              : h2h.w < h2h.l
                              ? 'text-rose-600 bg-rose-50/50 font-semibold'
                              : 'text-slate-600';
                          return (
                            <td key={colTeam.id} className={`py-2 px-1.5 border-r border-sky-50 ${cellCls}`}>
                              {total === 0 ? '0-0' : `${h2h.w}-${h2h.d}-${h2h.l}`}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View 1.2: 5-Team Postseason Tournament Bracket */}
      {selectedSubTab === 'POSTSEASON' && (
        <div className="space-y-6">
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" /> 제 {seasonNumber}회차 JBL 포스트시즌 토너먼트
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                정규시즌 1~5위 구단이 와일드카드(4·5위) → 준플레이오프(3위) → 플레이오프(2위) → JBL 한국시리즈(1위) 계단식 토너먼트를 치릅니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!postseasonState ? (
                <button
                  onClick={() => onStartPostseason(sortedTeams)}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> 현재 순위(1~5위)로 포스트시즌 개막
                </button>
              ) : (
                <>
                  {!postseasonState.championTeamId && (
                    <>
                      <button
                        onClick={onSimulatePostseasonGame}
                        className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> 다음 1경기 시뮬
                      </button>
                      <button
                        onClick={onSimulatePostseasonSeries}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <FastForward className="w-3.5 h-3.5" /> 현재 시리즈 완주
                      </button>
                      {onSimulateFullPostseason && (
                        <button
                          onClick={onSimulateFullPostseason}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Trophy className="w-3.5 h-3.5" /> 포스트시즌 전체 자동 완주
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={onResetPostseason}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    브래킷 초기화
                  </button>
                </>
              )}
            </div>
          </div>

          {!postseasonState ? (
            <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-600">현재 정규시즌 포스트시즌 진출 예상 시드 (TOP 5)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {sortedTeams.slice(0, 5).map((t, idx) => (
                  <div key={t.id} className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 text-center space-y-1">
                    <span className="text-[11px] font-bold text-sky-700 block">
                      {idx === 0 ? '1위 · 한국시리즈 직행' : idx === 1 ? '2위 · 플레이오프' : idx === 2 ? '3위 · 준플레이오프' : `${idx + 1}위 · 와일드카드`}
                    </span>
                    <div className="font-display font-bold text-base text-slate-900">{t.name}</div>
                    <span className="text-xs font-mono-numbers text-slate-500">
                      {t.wins}승 {t.draws}무 {t.losses}패
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {postseasonState.championTeamId && (() => {
                const champ = allTeams.find(t => t.id === postseasonState.championTeamId);
                return (
                  <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3 shadow-md">
                    <div className="inline-flex p-3 rounded-2xl bg-amber-400 text-slate-950">
                      <Trophy className="w-7 h-7" />
                    </div>
                    <h4 className="text-2xl font-display font-extrabold text-slate-900">
                      🏆 제 {postseasonState.seasonNumber}회차 JBL 한국시리즈 우승: {champ?.name}!
                    </h4>
                    <p className="text-xs text-slate-600">
                      포스트시즌 모든 경기가 종료되었습니다. 우승 트로피를 역대 족보에 등재하고 다음 회차 새 시즌을 개막할 수 있습니다.
                    </p>
                    <button
                      onClick={() => champ && onAdvanceNextSeason(champ.id)}
                      className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition-colors"
                    >
                      🏆 {champ?.name} 우승 확정하고 제 {seasonNumber + 1}회차 개막하기
                    </button>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {postseasonState.seriesList.map(series => {
                  const higher = allTeams.find(t => t.id === series.higherSeedTeamId);
                  const lower = allTeams.find(t => t.id === series.lowerSeedTeamId);
                  const winner = series.winnerTeamId ? allTeams.find(t => t.id === series.winnerTeamId) : null;
                  return (
                    <div
                      key={series.id}
                      className={`bg-white rounded-2xl p-5 border shadow-sm space-y-3 ${
                        !winner ? 'border-sky-400 ring-2 ring-sky-100' : 'border-sky-100'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-sky-100">
                        <span className="font-display font-bold text-sm text-sky-900">
                          {series.roundName} ({series.winsNeeded}선승제)
                        </span>
                        {winner ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            승자: {winner.name}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold animate-pulse">
                            진행 중
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 items-center text-center bg-sky-50/70 rounded-xl p-3 border border-sky-100">
                        <div>
                          <span className="text-[10px] text-slate-500 block">상위 시드</span>
                          <span className="font-display font-bold text-sm text-slate-900">{higher?.name}</span>
                        </div>
                        <div className="font-mono-numbers font-extrabold text-xl text-sky-700">
                          {series.higherWins} : {series.lowerWins}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">도전 시드</span>
                          <span className="font-display font-bold text-sm text-slate-900">{lower?.name}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs font-mono-numbers">
                        {series.gamesLog.length === 0 ? (
                          <p className="text-slate-400 text-center py-2 font-sans">경기 진행 대기 중 (상단 버튼으로 시뮬레이션)</p>
                        ) : (
                          series.gamesLog.map(g => (
                            <div key={g.gameNumber} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-slate-500">{g.gameNumber}차전</span>
                              <span className="font-semibold text-slate-800">
                                {g.awayTeamName} {g.awayScore} : {g.homeScore} {g.homeTeamName}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View 1.5: Team-by-Team Player Season Stats */}
      {selectedSubTab === 'TEAM_STATS' && (
        <div className="space-y-4">
          {/* 10-Team Selector Grid */}
          <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">조회할 구단 선택 (10개 구단 전체)</span>
              <span className="text-[11px] text-slate-500">선수 이름을 클릭하면 상세 능력치와 시즌 기록을 보거나 편집할 수 있습니다.</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {allTeams.map(t => {
                const isSelected = t.id === selectedStatsTeam.id;
                const isUser = t.id === userTeam.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setStatsTeamId(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-600 shadow-sm'
                        : 'bg-sky-50/40 hover:bg-sky-50 border-sky-100 text-slate-800'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                      style={{ backgroundColor: t.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold block truncate">
                        {t.name} {isUser ? '★' : ''}
                      </span>
                      <span className={`text-[10px] font-mono-numbers block ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}>
                        {t.wins}승 {t.draws}무 {t.losses}패
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter & Sort Controls */}
          <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-sky-50 p-1 rounded-xl border border-sky-200 text-xs">
                <button
                  onClick={() => setStatsRoleFilter('BATTER')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    statsRoleFilter === 'BATTER' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  타자 기록표
                </button>
                <button
                  onClick={() => setStatsRoleFilter('PITCHER')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    statsRoleFilter === 'PITCHER' ? 'bg-sky-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  투수 기록표
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                {[
                  { id: 'ALL', label: '전체' },
                  { id: 'FIRST_TEAM', label: '1군' },
                  { id: 'SECOND_TEAM', label: '2군' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setStatsTierFilter(t.id as 'ALL' | 'FIRST_TEAM' | 'SECOND_TEAM')}
                    className={`px-2.5 py-1 rounded-lg font-semibold ${
                      statsTierFilter === t.id ? 'bg-white text-sky-700 shadow-xs font-bold' : 'text-slate-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-slate-500 font-semibold">정렬:</span>
              {statsRoleFilter === 'BATTER' ? (
                <select
                  value={batterSortBy}
                  onChange={(e) => setBatterSortBy(e.target.value as 'AVG' | 'HR' | 'RBI' | 'HITS' | 'OPS' | 'SB')}
                  className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                >
                  <option value="AVG">타율 (AVG)</option>
                  <option value="OPS">OPS</option>
                  <option value="HR">홈런 (HR)</option>
                  <option value="RBI">타점 (RBI)</option>
                  <option value="HITS">안타 (H)</option>
                  <option value="SB">도루 (SB)</option>
                </select>
              ) : (
                <select
                  value={pitcherSortBy}
                  onChange={(e) => setPitcherSortBy(e.target.value as 'ERA' | 'WINS' | 'SO' | 'SAVES' | 'IP' | 'VELO')}
                  className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                >
                  <option value="ERA">평균자책 (ERA)</option>
                  <option value="WINS">다승 (W)</option>
                  <option value="SO">탈삼진 (SO)</option>
                  <option value="SAVES">세이브+홀드</option>
                  <option value="IP">투구이닝 (IP)</option>
                  <option value="VELO">최고구속</option>
                </select>
              )}
            </div>
          </div>

          {/* Stats Table */}
          <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
              <span className="text-xs font-display font-bold text-sky-900">
                {selectedStatsTeam.name} {statsRoleFilter === 'BATTER' ? '타자' : '투수'} 시즌 상세 기록 ({selectedTeamRoster.length}명)
              </span>
              <span className="text-[11px] text-slate-500">제 {seasonNumber}회차 누적 성적</span>
            </div>

            {statsRoleFilter === 'BATTER' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs font-mono-numbers">
                  <thead>
                    <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40 font-bold">
                      <th className="py-3 px-3 text-left">선수명</th>
                      <th className="py-3 px-2 text-center">포지션</th>
                      <th className="py-3 px-2 text-center">군/Lv</th>
                      <th className="py-3 px-2">경기</th>
                      <th className="py-3 px-2">타수</th>
                      <th className="py-3 px-2">안타</th>
                      <th className="py-3 px-2">2루</th>
                      <th className="py-3 px-2 text-amber-600">홈런</th>
                      <th className="py-3 px-2">타점</th>
                      <th className="py-3 px-2">득점</th>
                      <th className="py-3 px-2">도루</th>
                      <th className="py-3 px-2">볼넷</th>
                      <th className="py-3 px-2">삼진</th>
                      <th className="py-3 px-3 text-emerald-600">타율</th>
                      <th className="py-3 px-3">출루율</th>
                      <th className="py-3 px-3 text-sky-700">OPS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100/70">
                    {sortedTeamBatters.map(p => {
                      const s = p.batterStats;
                      const ab = s?.atBats || 0;
                      const h = s?.hits || 0;
                      const bb = s?.walks || 0;
                      const d = s?.doubles || 0;
                      const tr = s?.triples || 0;
                      const hr = s?.homeRuns || 0;
                      const avg = ab > 0 ? (h / ab).toFixed(3) : '.000';
                      const obp = ab + bb > 0 ? ((h + bb) / (ab + bb)).toFixed(3) : '.000';
                      const tb = (h - d - tr - hr) + d * 2 + tr * 3 + hr * 4;
                      const slg = ab > 0 ? (tb / ab).toFixed(3) : '.000';
                      const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);
                      return (
                        <tr key={p.id} className="hover:bg-sky-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-left font-sans">
                            <button
                              onClick={() => onOpenPlayerDetail(p)}
                              className="font-bold text-slate-900 hover:text-sky-600 text-left"
                            >
                              {p.name}
                            </button>
                            {p.isInjured && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                부상 {p.injuryDays}일
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                              {p.primaryPosition}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-[11px] text-slate-500">
                            {p.tier === 'FIRST_TEAM' ? '1군' : '2군'}·Lv.{p.level}
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.games || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{ab}</td>
                          <td className="py-2.5 px-2 font-semibold text-slate-800">{h}</td>
                          <td className="py-2.5 px-2 text-slate-600">{d}</td>
                          <td className="py-2.5 px-2 font-bold text-amber-600">{hr}</td>
                          <td className="py-2.5 px-2 font-semibold text-slate-800">{s?.rbi || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.runs || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.stolenBases || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{bb}</td>
                          <td className="py-2.5 px-2 text-slate-500">{s?.strikeouts || 0}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">{avg}</td>
                          <td className="py-2.5 px-3 text-slate-700">{obp}</td>
                          <td className="py-2.5 px-3 font-bold text-sky-700">{ops}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs font-mono-numbers">
                  <thead>
                    <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40 font-bold">
                      <th className="py-3 px-3 text-left">선수명</th>
                      <th className="py-3 px-2 text-center">보직</th>
                      <th className="py-3 px-2 text-center">군/Lv</th>
                      <th className="py-3 px-2">구속</th>
                      <th className="py-3 px-2">경기</th>
                      <th className="py-3 px-2">이닝</th>
                      <th className="py-3 px-2 text-emerald-600">승</th>
                      <th className="py-3 px-2 text-rose-500">패</th>
                      <th className="py-3 px-2 text-amber-600">세</th>
                      <th className="py-3 px-2">홀</th>
                      <th className="py-3 px-2 text-purple-600">탈삼진</th>
                      <th className="py-3 px-2">피안타</th>
                      <th className="py-3 px-2">사사구</th>
                      <th className="py-3 px-2">자책</th>
                      <th className="py-3 px-3 text-sky-700">ERA</th>
                      <th className="py-3 px-3">WHIP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100/70">
                    {sortedTeamPitchers.map(p => {
                      const s = p.pitcherStats;
                      const ipOuts = s?.inningsOuts || 0;
                      const ipStr = `${Math.floor(ipOuts / 3)}${ipOuts % 3 > 0 ? '.' + (ipOuts % 3) : ''}`;
                      const floatIp = ipOuts / 3;
                      const era = floatIp > 0 ? (((s?.earnedRuns || 0) * 9) / floatIp).toFixed(2) : '0.00';
                      const whip = floatIp > 0 ? (((s?.hitsAllowed || 0) + (s?.walksAllowed || 0)) / floatIp).toFixed(2) : '0.00';
                      return (
                        <tr key={p.id} className="hover:bg-sky-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-left font-sans">
                            <button
                              onClick={() => onOpenPlayerDetail(p)}
                              className="font-bold text-slate-900 hover:text-sky-600 text-left"
                            >
                              {p.name}
                            </button>
                            {p.isInjured && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                부상 {p.injuryDays}일
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                              {p.primaryPosition}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-[11px] text-slate-500">
                            {p.tier === 'FIRST_TEAM' ? '1군' : '2군'}·Lv.{p.level}
                          </td>
                          <td className="py-2.5 px-2 text-sky-600 font-bold">{s?.velocity || 142}</td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.games || 0}</td>
                          <td className="py-2.5 px-2 text-slate-700 font-semibold">{ipStr}</td>
                          <td className="py-2.5 px-2 font-bold text-emerald-600">{s?.wins || 0}</td>
                          <td className="py-2.5 px-2 font-bold text-rose-500">{s?.losses || 0}</td>
                          <td className="py-2.5 px-2 font-bold text-amber-600">{s?.saves || 0}</td>
                          <td className="py-2.5 px-2 text-slate-700">{s?.holds || 0}</td>
                          <td className="py-2.5 px-2 font-bold text-purple-600">{s?.strikeouts || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.hitsAllowed || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.walksAllowed || 0}</td>
                          <td className="py-2.5 px-2 text-slate-600">{s?.earnedRuns || 0}</td>
                          <td className="py-2.5 px-3 font-bold text-sky-700">{era}</td>
                          <td className="py-2.5 px-3 text-slate-700">{whip}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 2: Leaders Pods */}
      {selectedSubTab === 'LEADERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Batting Average */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" /> 타율 (Batting Average) TOP 5
            </h3>
            <div className="space-y-2">
              {avgLeaders.map(({ player: b, teamName }, idx) => {
                const s = b.batterStats;
                const avg = s?.atBats ? (s.hits / s.atBats).toFixed(3) : '.000';
                return (
                  <button
                    key={b.id}
                    onClick={() => onOpenPlayerDetail(b)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                      <span className="font-bold text-slate-900">{b.name}</span>
                      <span className="text-slate-400 text-[10px]">{teamName} · {b.primaryPosition}</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-emerald-600 text-sm">{avg}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Home Runs */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> 홈런 (Home Runs) TOP 5
            </h3>
            <div className="space-y-2">
              {hrLeaders.map(({ player: b, teamName }, idx) => (
                <button
                  key={b.id}
                  onClick={() => onOpenPlayerDetail(b)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <span className="text-slate-400 text-[10px]">{teamName} · {b.primaryPosition}</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-amber-500 text-sm">
                    {b.batterStats?.homeRuns || 0}개
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* RBI */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-rose-500" /> 타점 (RBI) TOP 5
            </h3>
            <div className="space-y-2">
              {rbiLeaders.map(({ player: b, teamName }, idx) => (
                <button
                  key={b.id}
                  onClick={() => onOpenPlayerDetail(b)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <span className="text-slate-400 text-[10px]">{teamName} · {b.primaryPosition}</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-rose-600 text-sm">
                    {b.batterStats?.rbi || 0}타점
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Wins */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-600" /> 다승 (Pitcher Wins) TOP 5
            </h3>
            <div className="space-y-2">
              {winLeaders.map(({ player: p, teamName }, idx) => (
                <button
                  key={p.id}
                  onClick={() => onOpenPlayerDetail(p)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{p.name}</span>
                    <span className="text-slate-400 text-[10px]">{teamName} · {p.primaryPosition}</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-sky-600 text-sm">
                    {p.pitcherStats?.wins || 0}승
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Strikeouts */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" /> 탈삼진 (Strikeouts) TOP 5
            </h3>
            <div className="space-y-2">
              {kLeaders.map(({ player: p, teamName }, idx) => (
                <button
                  key={p.id}
                  onClick={() => onOpenPlayerDetail(p)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-600 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{p.name}</span>
                    <span className="text-slate-400 text-[10px]">{teamName} · {p.primaryPosition}</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-purple-600 text-sm">
                    {p.pitcherStats?.strikeouts || 0}K
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ERA */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" /> 평균자책 (ERA) TOP 5
            </h3>
            <div className="space-y-2">
              {eraLeaders.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">1이닝 이상 투구한 투수 기록 집계 대기 중</p>
              ) : (
                eraLeaders.map(({ player: p, teamName }, idx) => {
                  const s = p.pitcherStats;
                  const ipOuts = s?.inningsOuts || 0;
                  const era = ipOuts > 0 ? ((s?.earnedRuns || 0) * 9 / (ipOuts / 3)).toFixed(2) : '0.00';
                  return (
                    <button
                      key={p.id}
                      onClick={() => onOpenPlayerDetail(p)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                        <span className="font-bold text-slate-900">{p.name}</span>
                        <span className="text-slate-400 text-[10px]">{teamName} · {p.primaryPosition}</span>
                      </div>
                      <span className="font-mono-numbers font-bold text-emerald-600 text-sm">
                        {era}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Saves / Holds */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" /> 구원 (세이브+홀드) TOP 5
            </h3>
            <div className="space-y-2">
              {reliefLeaders.map(({ player: p, teamName }, idx) => (
                <button
                  key={p.id}
                  onClick={() => onOpenPlayerDetail(p)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 text-xs transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-600 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{p.name}</span>
                    <span className="text-slate-400 text-[10px]">{teamName} · {p.primaryPosition}</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-indigo-600 text-sm">
                    {p.pitcherStats?.saves || 0}세 {p.pitcherStats?.holds || 0}홀
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View 2.5: Season Awards & Golden Glove */}
      {selectedSubTab === 'AWARDS' && (() => {
        const liveProjection = computeSeasonAwards(
          seasonNumber,
          postseasonState?.championTeamId
            ? (allTeams.find(t => t.id === postseasonState.championTeamId)?.name || '진행 중')
            : '진행 중',
          allTeams,
          allPlayers
        );

        const openWinnerDetail = (entry: AwardWinnerEntry) => {
          const allList = Object.values(allPlayers).flat();
          const found = allList.find(p => p.id === entry.playerId);
          if (found) onOpenPlayerDetail(found);
        };

        const renderAwardCard = (record: SeasonAwardRecord, isLivePreview: boolean) => {
          const mainAwards = [
            { label: '정규시즌 MVP', badge: 'bg-amber-100 text-amber-800 border-amber-300', entry: record.mvp },
            { label: '신인왕 (ROTY)', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', entry: record.rookieOfYear },
            { label: '타격왕 (AVG)', badge: 'bg-sky-100 text-sky-800 border-sky-200', entry: record.battingTitle },
            { label: '홈런왕 (HR)', badge: 'bg-orange-100 text-orange-800 border-orange-200', entry: record.homeRunKing },
            { label: '타점왕 (RBI)', badge: 'bg-rose-100 text-rose-800 border-rose-200', entry: record.rbiKing },
            { label: '다승왕 (WINS)', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', entry: record.winsKing },
            { label: '방어율왕 (ERA)', badge: 'bg-teal-100 text-teal-800 border-teal-200', entry: record.eraKing },
            { label: '탈삼진왕 (SO)', badge: 'bg-purple-100 text-purple-800 border-purple-200', entry: record.strikeoutKing },
          ];

          return (
            <div
              key={`${record.seasonNumber}_${isLivePreview ? 'live' : 'arch'}`}
              className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 ${
                isLivePreview ? 'border-sky-300 ring-1 ring-sky-100' : 'border-sky-100'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  <Crown className={`w-5 h-5 ${isLivePreview ? 'text-sky-600' : 'text-amber-500'}`} />
                  <h3 className="font-display font-bold text-base text-slate-900">
                    {isLivePreview
                      ? `제 ${record.seasonNumber}회차 실시간 어워드 레이스 예상`
                      : `제 ${record.seasonNumber}회차 공식 결산 어워드`}
                  </h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isLivePreview
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {isLivePreview ? `현재 ${currentDay}일차 기준` : `🏆 우승: ${record.championTeamName}`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {mainAwards.map(item => (
                  <button
                    key={item.label}
                    onClick={() => openWinnerDetail(item.entry)}
                    className="p-3.5 rounded-xl bg-sky-50/50 hover:bg-sky-100/70 border border-sky-100 text-left transition-colors space-y-1"
                  >
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${item.badge}`}>
                      {item.label}
                    </span>
                    <div className="flex items-baseline justify-between gap-2 pt-0.5">
                      <span className="font-display font-extrabold text-sm text-slate-900 truncate">
                        {item.entry.playerName}
                      </span>
                      <span className="text-[11px] font-semibold text-sky-700 shrink-0">
                        {item.entry.teamName} · {item.entry.position}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono-numbers text-slate-500 truncate">{item.entry.summary}</p>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 포지션별 골든글러브 (10인)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {record.goldenGlove.map((gg, idx) => (
                    <button
                      key={`${gg.position}_${idx}`}
                      onClick={() => openWinnerDetail(gg)}
                      className="p-2.5 rounded-xl bg-amber-50/50 hover:bg-amber-100/70 border border-amber-200/70 text-left transition-colors"
                    >
                      <span className="text-[10px] font-bold text-amber-700 block">{gg.position}</span>
                      <span className="font-bold text-xs text-slate-900 block truncate">{gg.playerName}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{gg.teamName}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {renderAwardCard(liveProjection, true)}
            {seasonAwards.length === 0 ? (
              <div className="bg-white border border-sky-100 rounded-2xl p-8 text-center text-xs text-slate-500 shadow-sm">
                아직 결산된 과거 회차 어워드 기록이 없습니다. 시즌을 완주하고 우승팀을 확정하면 해당 회차 MVP·신인왕·골든글러브가 명예의 전당에 자동 영구 보존됩니다.
              </div>
            ) : (
              <div className="space-y-4">
                {[...seasonAwards].sort((a, b) => b.seasonNumber - a.seasonNumber).map(rec => renderAwardCard(rec, false))}
              </div>
            )}
          </div>
        );
      })()}

      {/* View 3: JBL Champions History */}
      {selectedSubTab === 'HISTORY' && (
        <div className="space-y-6">
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-sky-600" /> 구단별 통산 우승 횟수 랭킹
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {championshipRanking.map(team => (
                <div key={team.id} className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                  <span className="text-xs font-semibold text-slate-700 block">{team.name}</span>
                  <span className="text-lg font-display font-extrabold text-sky-700 font-mono-numbers block mt-0.5">
                    {team.championships}회
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" /> 제 1회 ~ {seasonNumber - 1}회 역대 우승 족보
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {historicalChampions.map((h) => (
                <div
                  key={`${h.seasonNumber}_${h.champion}`}
                  className="p-2.5 bg-sky-50/50 border border-sky-100 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-mono-numbers text-slate-500 font-semibold">{h.seasonNumber}회차</span>
                  <span className="font-bold text-sky-800">{h.champion}</span>
                </div>
              ))}
              <div className="p-2.5 bg-sky-100 border border-sky-300 rounded-xl flex items-center justify-between text-xs">
                <span className="font-mono-numbers text-sky-900 font-bold">{seasonNumber}회차 (현재)</span>
                <span className="font-bold text-sky-600 animate-pulse">도전 진행 중!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 4: League Season Sync & All Match History */}
      {selectedSubTab === 'LEAGUE_MGMT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Season / Day Direct Sync */}
            <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" /> 현재 리그 회차 & 일차 동기화
              </h3>
              <p className="text-xs text-slate-500">
                실제 진행 중인 JBL 리그 회차나 일차와 게임 내 시즌을 동일하게 맞출 수 있습니다.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="block">
                  <span className="font-bold text-slate-700 block mb-1">현재 리그 회차 (시즌)</span>
                  <input
                    type="number"
                    min={1}
                    value={seasonInput}
                    onChange={(e) => setSeasonInput(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/50 font-mono-numbers font-bold text-sm text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-slate-700 block mb-1">진행 일차 (Day)</span>
                  <input
                    type="number"
                    min={1}
                    value={dayInput}
                    onChange={(e) => setDayInput(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/50 font-mono-numbers font-bold text-sm text-slate-900"
                  />
                </label>
              </div>
              <button
                onClick={handleApplySeasonDay}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
              >
                리그 회차·일차 즉시 적용하기
              </button>
            </div>

            {/* Crown Champion & Advance Season */}
            <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> {seasonNumber}회차 시즌 마감 & 다음 회차 개막
              </h3>
              <p className="text-xs text-slate-500">
                현재 시즌 우승 구단을 역대 우승 족보에 등재하고, 선수 이름·능력치는 유지한 채 다음 회차({seasonNumber + 1}회차) 새 시즌과 신인 드래프트를 시작합니다.
              </p>
              <label className="block text-xs">
                <span className="font-bold text-slate-700 block mb-1">{seasonNumber}회차 최종 우승 구단 선택</span>
                <select
                  value={championCandidateId}
                  onChange={(e) => setSelectedChampionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/50 font-bold text-slate-800"
                >
                  {sortedTeams.map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      {idx + 1}위 · {t.name} ({t.wins}승 {t.draws}무 {t.losses}패)
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={handleCrownChampionAndNextSeason}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition-colors"
              >
                🏆 우승 확정하고 제 {seasonNumber + 1}회차 시즌 개막하기
              </button>
            </div>
          </div>

          {/* All-Teams Match Boxscores */}
          <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-display font-bold text-sky-900">
                전체 구단 경기 결과 박스스코어 기록 ({filteredMatches.length}경기)
              </span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-sky-200 text-xs">
                <button
                  onClick={() => setShowAllLeagueMatches(true)}
                  className={`px-2.5 py-1 rounded font-semibold ${showAllLeagueMatches ? 'bg-sky-500 text-white' : 'text-slate-600'}`}
                >
                  전체 리그 경기
                </button>
                <button
                  onClick={() => setShowAllLeagueMatches(false)}
                  className={`px-2.5 py-1 rounded font-semibold ${!showAllLeagueMatches ? 'bg-sky-500 text-white' : 'text-slate-600'}`}
                >
                  내 구단 경기만
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono-numbers">
                <thead className="sticky top-0 bg-sky-50 text-slate-600 border-b border-sky-100">
                  <tr>
                    <th className="py-2.5 px-3">회차/일차</th>
                    <th className="py-2.5 px-3">원정팀</th>
                    <th className="py-2.5 px-3 text-center">스코어</th>
                    <th className="py-2.5 px-3">홈팀</th>
                    <th className="py-2.5 px-3">안타(원정:홈)</th>
                    <th className="py-2.5 px-3">승리팀</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/70">
                  {filteredMatches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        아직 진행된 경기 기록이 없습니다. 경기를 진행하면 모든 10개 구단의 경기 결과가 여기에 누적 기록됩니다.
                      </td>
                    </tr>
                  ) : (
                    filteredMatches.map(m => (
                      <tr key={m.id} className="hover:bg-sky-50/50">
                        <td className="py-2.5 px-3 text-slate-500">
                          {m.seasonNumber}회 {m.day}일
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{m.awayTeamName}</td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-sky-700">
                          {m.awayScore} : {m.homeScore}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{m.homeTeamName}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {m.awayHits}H : {m.homeHits}H
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">
                          {m.winningTeamName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
