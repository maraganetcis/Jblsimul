/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trophy, Award, Clock, Settings, CheckCircle, Calendar, Sparkles, Users, ArrowUpDown } from 'lucide-react';
import { Team, Player, HistorySeason, MatchRecord } from '../types/baseball';

interface StandingsRecordViewProps {
  allTeams: Team[];
  allPlayers: Record<string, Player[]>;
  userTeam: Team;
  seasonNumber: number;
  currentDay: number;
  historicalChampions: HistorySeason[];
  matchHistory: MatchRecord[];
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
  onUpdateSeasonAndDay,
  onAdvanceNextSeason,
  onOpenPlayerDetail,
}) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'STANDINGS' | 'TEAM_STATS' | 'LEADERS' | 'HISTORY' | 'LEAGUE_MGMT'>('STANDINGS');
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
            리그 순위표
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedSubTab === 'LEADERS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            개인 타이틀
          </button>
          <button
            onClick={() => setSelectedSubTab('HISTORY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
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

      {/* View 1: 10-Team Standings Table */}
      {selectedSubTab === 'STANDINGS' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono-numbers">
              <thead>
                <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/60 font-bold">
                  <th className="py-3 px-3 w-14">순위</th>
                  <th className="py-3 px-4 text-left font-display font-semibold text-slate-700">구단명</th>
                  <th className="py-3 px-2 w-16">경기수</th>
                  <th className="py-3 px-2 text-emerald-600 font-bold w-14">승</th>
                  <th className="py-3 px-2 text-slate-500 w-12">무</th>
                  <th className="py-3 px-2 text-rose-500 font-bold w-14">패</th>
                  <th className="py-3 px-3 font-bold text-sky-700 w-20">승률</th>
                  <th className="py-3 px-2 text-slate-500 w-16">게임차</th>
                  <th className="py-3 px-2 w-16">득점</th>
                  <th className="py-3 px-2 w-16">실점</th>
                  <th className="py-3 px-3 w-20">득실마진</th>
                  <th className="py-3 px-3 text-slate-500 text-left">연고지 홈구장</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70">
                {sortedTeams.map((team, idx) => {
                  const games = team.wins + team.losses + team.draws;
                  const winRate = team.wins + team.losses > 0 ? (team.wins / (team.wins + team.losses)).toFixed(3) : '.000';
                  const gb = idx === 0 ? '-' : (((topWins - team.wins) + (team.losses - topLosses)) / 2).toFixed(1);
                  const margin = team.runsScored - team.runsAllowed;
                  const isUser = team.id === userTeam.id;

                  return (
                    <tr
                      key={team.id}
                      className={`transition-colors ${
                        isUser ? 'bg-sky-50/80 hover:bg-sky-100/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3 font-display font-bold text-sm">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${
                          idx === 0 ? 'bg-amber-400 text-slate-950 font-bold' : idx < 4 ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-400'
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
                      <td className={`py-3 px-3 font-semibold ${margin > 0 ? 'text-emerald-600' : margin < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                        {margin > 0 ? `+${margin}` : margin}
                      </td>
                      <td className="py-3 px-3 text-left text-slate-600 font-sans text-xs">
                        {team.homeStadium}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
