/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, TrendingUp, Trophy, Award, Building, Activity, Zap, Users } from 'lucide-react';
import { Team, Player, ScheduleItem } from '../types/baseball';

interface DashboardViewProps {
  userTeam: Team;
  allTeams: Team[];
  roster: Player[];
  currentScheduleItem?: ScheduleItem;
  opponentTeam?: Team;
  onStartMatch: () => void;
  onNavigateTo: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userTeam,
  allTeams,
  roster,
  currentScheduleItem,
  opponentTeam,
  onStartMatch,
  onNavigateTo,
}) => {
  // 팀 랭킹 계산
  const sortedTeams = [...allTeams].sort((a, b) => {
    const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    if (rateB !== rateA) return rateB - rateA;
    return b.wins - a.wins;
  });
  const myRank = sortedTeams.findIndex(t => t.id === userTeam.id) + 1;

  // 팀 타자/투수 기록 합산
  const batters = roster.filter(p => p.role === 'BATTER');
  const pitchers = roster.filter(p => p.role === 'PITCHER');

  let totalAB = 0;
  let totalH = 0;
  let totalHR = 0;
  let totalRBI = 0;
  batters.forEach(b => {
    const s = b.batterStats;
    if (s) {
      totalAB += s.atBats;
      totalH += s.hits;
      totalHR += s.homeRuns;
      totalRBI += s.rbi;
    }
  });
  const teamAvg = totalAB > 0 ? (totalH / totalAB).toFixed(3) : '.265';

  let totalOuts = 0;
  let totalER = 0;
  pitchers.forEach(p => {
    const s = p.pitcherStats;
    if (s) {
      totalOuts += s.inningsOuts;
      totalER += s.earnedRuns;
    }
  });
  const teamERA = totalOuts > 0 ? ((totalER * 9) / (totalOuts / 3)).toFixed(2) : '3.85';

  // 팀 내 스타 타자/투수 TOP 3
  const topBatters = [...batters].sort((a, b) => {
    const aAvg = a.batterStats?.atBats ? (a.batterStats.hits / a.batterStats.atBats) : (a.batterStats?.contact || 0) / 100;
    const bAvg = b.batterStats?.atBats ? (b.batterStats.hits / b.batterStats.atBats) : (b.batterStats?.contact || 0) / 100;
    return bAvg - aAvg;
  }).slice(0, 3);

  const topPitchers = [...pitchers].sort((a, b) => {
    return (b.pitcherStats?.stuff || 0) - (a.pitcherStats?.stuff || 0);
  }).slice(0, 3);

  const myProbableSP = pitchers.find(p => p.primaryPosition === 'SP' && p.tier === 'FIRST_TEAM') || pitchers[0];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Hero Team Banner */}
      <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-sky-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-display font-black text-2xl sm:text-3xl shadow-lg border-2 border-white/40"
              style={{ backgroundColor: userTeam.color }}
            >
              {userTeam.logoInitial}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
                  {userTeam.name}
                </h1>
                <span className="bg-white/20 text-white border border-white/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  리그 {myRank}위
                </span>
              </div>
              <p className="text-xs sm:text-sm text-sky-100 mt-1 flex items-center gap-3">
                <span>모기업: {userTeam.owner}</span>
                <span>·</span>
                <span>홈구장: {userTeam.homeStadium}</span>
                <span>·</span>
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 inline" /> 통산 {userTeam.championships}회 우승
                </span>
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs font-mono-numbers">
                <span className="text-white">
                  시즌 성적: <strong className="text-amber-300 text-sm font-bold">{userTeam.wins}승</strong> {userTeam.draws}무 <strong className="text-sky-200 text-sm">{userTeam.losses}패</strong>
                </span>
                <span className="text-white/40">|</span>
                <span className="text-white">
                  구단 예산: <strong className="text-amber-300 text-sm font-bold">{(userTeam.budget / 10000).toLocaleString()}억원</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick CTA to Live Game */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={onStartMatch}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              오늘 경기 지휘하기 (Live Match)
            </button>
          </div>
        </div>

        {/* Decorative subtle circles */}
        <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* 2. Today's Matchup Card */}
      {opponentTeam && (
        <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-sky-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-600" />
              <h2 className="font-display font-bold text-sm text-slate-800">다음 경기 매치업 프리뷰</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono-numbers">
              {userTeam.homeStadium}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 text-center">
            {/* Home/User Team */}
            <div className="flex items-center justify-center md:justify-end gap-3">
              <div className="text-right">
                <span className="text-xs text-sky-600 font-semibold block">홈팀</span>
                <span className="font-display font-bold text-base text-slate-900">{userTeam.name}</span>
                <span className="text-xs text-slate-500 block font-mono-numbers">
                  예고선발: {myProbableSP?.name || '1선발'}
                </span>
              </div>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow"
                style={{ backgroundColor: userTeam.color }}
              >
                {userTeam.logoInitial}
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center justify-center">
              <span className="text-2xl font-display font-black text-sky-600">VS</span>
              <button
                onClick={onStartMatch}
                className="mt-1.5 px-4 py-1 rounded-full bg-sky-50 hover:bg-sky-100 text-xs font-semibold text-sky-800 border border-sky-200 transition-colors"
              >
                경기 입장
              </button>
            </div>

            {/* Away / Opponent Team */}
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow"
                style={{ backgroundColor: opponentTeam.color }}
              >
                {opponentTeam.logoInitial}
              </div>
              <div className="text-left">
                <span className="text-xs text-slate-500 font-semibold block">원정팀</span>
                <span className="font-display font-bold text-base text-slate-900">{opponentTeam.name}</span>
                <span className="text-xs text-slate-500 block font-mono-numbers">
                  {opponentTeam.wins}승 {opponentTeam.draws}무 {opponentTeam.losses}패
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Team Statistics KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">팀 타율 (AVG)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-display font-extrabold text-slate-900 font-mono-numbers">{teamAvg}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">리그 상위권 타선 화력</span>
        </div>

        <div className="bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">팀 평균자책 (ERA)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-display font-extrabold text-slate-900 font-mono-numbers">{teamERA}</span>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">안정적인 선발 마운드</span>
        </div>

        <div className="bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">시즌 팀 홈런 (HR)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-display font-extrabold text-amber-500 font-mono-numbers">{totalHR}개</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">장타 생산력</span>
        </div>

        <div className="bg-white border border-sky-100 rounded-xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">1군 등록 선수</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-display font-extrabold text-slate-900 font-mono-numbers">
              {roster.filter(p => p.tier === 'FIRST_TEAM').length}명
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">2군 육성군 {roster.filter(p => p.tier === 'SECOND_TEAM').length}명</span>
        </div>
      </div>

      {/* 4. Two-Column Roster Stars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Batters Spotlight */}
        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> 주요 핵심 타자 (Top Batters)
            </h3>
            <button
              onClick={() => onNavigateTo('ROSTER')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              전체 라인업 보기 &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {topBatters.map((b, idx) => {
              const s = b.batterStats;
              const avg = s?.atBats ? (s.hits / s.atBats).toFixed(3) : '.280';
              return (
                <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50/60 border border-sky-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono-numbers font-bold text-sky-700 w-4">{idx + 1}</span>
                    <div>
                      <span className="font-bold text-sm text-slate-900">{b.name}</span>
                      <span className="text-xs text-slate-500 ml-2">포지션: {b.primaryPosition}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono-numbers text-xs">
                    <span className="text-emerald-600 font-bold">{avg}</span>
                    <span className="text-slate-500 ml-2">{s?.homeRuns || 0}홈런 {s?.rbi || 0}타점</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Key Pitchers Spotlight */}
        <div className="bg-white border border-sky-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-600" /> 주요 투수진 (Top Pitchers)
            </h3>
            <button
              onClick={() => onNavigateTo('ROSTER')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              투수 로테이션 관리 &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {topPitchers.map((p, idx) => {
              const s = p.pitcherStats;
              const ipOuts = s?.inningsOuts || 0;
              const era = ipOuts > 0 ? ((s?.earnedRuns || 0) * 9 / (ipOuts / 3)).toFixed(2) : '3.20';
              return (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50/60 border border-sky-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono-numbers font-bold text-sky-700 w-4">{idx + 1}</span>
                    <div>
                      <span className="font-bold text-sm text-slate-900">{p.name}</span>
                      <span className="text-xs text-slate-500 ml-2">보직: {p.primaryPosition}</span>
                    </div>
                  </div>
                  <div className="text-right font-mono-numbers text-xs">
                    <span className="text-sky-600 font-bold">{s?.velocity}km/h</span>
                    <span className="text-slate-500 ml-2">ERA {era} · {s?.strikeouts || 0}K</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
