/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trophy, Award, TrendingUp, Shield, BarChart3, Star, Clock } from 'lucide-react';
import { Team, Player, HistorySeason } from '../types/baseball';
import { JBL_HISTORICAL_CHAMPIONS } from '../data/initialLeagueData';

interface StandingsRecordViewProps {
  allTeams: Team[];
  allPlayers: Record<string, Player[]>;
  userTeam: Team;
}

export const StandingsRecordView: React.FC<StandingsRecordViewProps> = ({
  allTeams,
  allPlayers,
  userTeam,
}) => {
  const [selectedSubTab, setSelectedSubTab] = useState<'STANDINGS' | 'LEADERS' | 'HISTORY'>('STANDINGS');

  // 팀 순위 정렬
  const sortedTeams = [...allTeams].sort((a, b) => {
    const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    if (rateB !== rateA) return rateB - rateA;
    return b.wins - a.wins;
  });

  const topWins = sortedTeams[0]?.wins || 0;
  const topLosses = sortedTeams[0]?.losses || 0;

  // 전체 리그 타자/투수 리더보드 추출
  const allBatters: Player[] = [];
  const allPitchers: Player[] = [];

  Object.values(allPlayers).forEach(roster => {
    roster.forEach(p => {
      if (p.role === 'BATTER' && p.tier === 'FIRST_TEAM') allBatters.push(p);
      if (p.role === 'PITCHER' && p.tier === 'FIRST_TEAM') allPitchers.push(p);
    });
  });

  // 타율 Top 5
  const avgLeaders = [...allBatters].sort((a, b) => {
    const aAvg = a.batterStats?.atBats ? (a.batterStats.hits / a.batterStats.atBats) : (a.batterStats?.contact || 0) / 100;
    const bAvg = b.batterStats?.atBats ? (b.batterStats.hits / b.batterStats.atBats) : (b.batterStats?.contact || 0) / 100;
    return bAvg - aAvg;
  }).slice(0, 5);

  // 홈런 Top 5
  const hrLeaders = [...allBatters].sort((a, b) => (b.batterStats?.homeRuns || 0) - (a.batterStats?.homeRuns || 0)).slice(0, 5);

  // 다승 Top 5
  const winLeaders = [...allPitchers].sort((a, b) => (b.pitcherStats?.wins || 0) - (a.pitcherStats?.wins || 0)).slice(0, 5);

  // 탈삼진 Top 5
  const kLeaders = [...allPitchers].sort((a, b) => (b.pitcherStats?.strikeouts || 0) - (a.pitcherStats?.strikeouts || 0)).slice(0, 5);

  // ERA Top 5
  const eraLeaders = [...allPitchers].filter(p => (p.pitcherStats?.inningsOuts || 0) >= 3).sort((a, b) => {
    const eraA = (a.pitcherStats?.earnedRuns || 0) * 9 / ((a.pitcherStats?.inningsOuts || 1) / 3);
    const eraB = (b.pitcherStats?.earnedRuns || 0) * 9 / ((b.pitcherStats?.inningsOuts || 1) / 3);
    return eraA - eraB;
  }).slice(0, 5);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-sky-600" /> JBL 공식 리그 순위 & 개인 타이틀 기록실
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            10개 구단의 페넌트레이스 순위표와 타격/투구 부문별 개인 타이틀 순위, 그리고 25년 역대 우승 족보를 확인하세요.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setSelectedSubTab('STANDINGS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedSubTab === 'STANDINGS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            리그 순위표
          </button>
          <button
            onClick={() => setSelectedSubTab('LEADERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedSubTab === 'LEADERS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            개인 타이틀 (타격/투수)
          </button>
          <button
            onClick={() => setSelectedSubTab('HISTORY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedSubTab === 'HISTORY' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            역대 25년 우승 족보
          </button>
        </div>
      </div>

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
                        <span className="text-slate-900">{team.name}</span>
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

      {/* View 2: Leaders Pods */}
      {selectedSubTab === 'LEADERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Batting Average */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" /> 타율 (Batting Average) TOP 5
            </h3>
            <div className="space-y-2">
              {avgLeaders.map((b, idx) => {
                const s = b.batterStats;
                const avg = s?.atBats ? (s.hits / s.atBats).toFixed(3) : '.300';
                return (
                  <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                      <span className="font-bold text-slate-900">{b.name}</span>
                      <span className="text-slate-400 text-[11px]">({b.primaryPosition})</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-emerald-600 text-sm">{avg}</span>
                  </div>
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
              {hrLeaders.map((b, idx) => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <span className="text-slate-400 text-[11px]">({b.primaryPosition})</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-amber-500 text-sm">
                    {b.batterStats?.homeRuns || 0}개
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wins */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-600" /> 다승 (Pitcher Wins) TOP 5
            </h3>
            <div className="space-y-2">
              {winLeaders.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{p.name}</span>
                    <span className="text-slate-400 text-[11px]">({p.primaryPosition})</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-sky-600 text-sm">
                    {p.pitcherStats?.wins || 0}승
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Strikeouts */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" /> 탈삼진 (Strikeouts) TOP 5
            </h3>
            <div className="space-y-2">
              {kLeaders.map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-purple-600 font-mono-numbers w-4">{idx + 1}</span>
                    <span className="font-bold text-slate-900">{p.name}</span>
                    <span className="text-slate-400 text-[11px]">({p.primaryPosition})</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-purple-600 text-sm">
                    {p.pitcherStats?.strikeouts || 0}K
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ERA */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" /> 평균자책 (ERA) TOP 5
            </h3>
            <div className="space-y-2">
              {eraLeaders.map((p, idx) => {
                const s = p.pitcherStats;
                const ipOuts = s?.inningsOuts || 0;
                const era = ipOuts > 0 ? ((s?.earnedRuns || 0) * 9 / (ipOuts / 3)).toFixed(2) : '0.00';
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sky-700 font-mono-numbers w-4">{idx + 1}</span>
                      <span className="font-bold text-slate-900">{p.name}</span>
                      <span className="text-slate-400 text-[11px]">({p.primaryPosition})</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-emerald-600 text-sm">
                      {era}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* View 3: JBL 25-Season Champions History */}
      {selectedSubTab === 'HISTORY' && (
        <div className="space-y-6">
          {/* Summary Badges */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-sky-600" /> 구단별 통산 우승 횟수 랭킹
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {[
                { name: '난하 지도', count: 5, color: '#2563EB' },
                { name: '서강 로간', count: 5, color: '#D97706' },
                { name: '신사 식약', count: 4, color: '#DC2626' },
                { name: '지도 지누', count: 2, color: '#E11D48', note: '2연속' },
                { name: '안소 시스', count: 2, color: '#0D9488' },
                { name: '아세 리미트', count: 2, color: '#4F46E5' },
                { name: '부서 시작', count: 2, color: '#EA580C' },
                { name: '신여 한계', count: 1, color: '#059669' },
                { name: '마성 엑설', count: 1, color: '#7C3AED' },
                { name: '파천 바이글', count: 1, color: '#0284C7' },
              ].map(item => (
                <div key={item.name} className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                  <span className="text-xs font-semibold text-slate-700 block">{item.name}</span>
                  <span className="text-lg font-display font-extrabold text-sky-700 font-mono-numbers block mt-0.5">
                    {item.count}회
                  </span>
                  {item.note && (
                    <span className="text-[10px] text-rose-600 font-bold block">{item.note}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 1st to 25th Season Chronicle Timeline Grid */}
          <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" /> 제 1회 ~ 25회 역대 우승 족보
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {JBL_HISTORICAL_CHAMPIONS.map((h) => (
                <div
                  key={h.seasonNumber}
                  className="p-2.5 bg-sky-50/50 border border-sky-100 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-mono-numbers text-slate-500 font-semibold">{h.seasonNumber}회차</span>
                  <span className="font-bold text-sky-800">{h.champion}</span>
                </div>
              ))}
              <div className="p-2.5 bg-sky-100 border border-sky-300 rounded-xl flex items-center justify-between text-xs">
                <span className="font-mono-numbers text-sky-900 font-bold">26회차 (현재)</span>
                <span className="font-bold text-sky-600 animate-pulse">도전 진행 중!</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
