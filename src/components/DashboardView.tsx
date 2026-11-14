/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Play,
  TrendingUp,
  Trophy,
  Award,
  Activity,
  Zap,
  Users,
  ArrowLeftRight,
  CloudUpload,
  CloudDownload,
  FastForward,
  Newspaper,
  ShieldCheck,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import { Team, Player, ScheduleItem, MatchRecord, LeagueNewsItem } from '../types/baseball';

interface DashboardViewProps {
  userTeam: Team;
  allTeams: Team[];
  roster: Player[];
  currentScheduleItem?: ScheduleItem;
  opponentTeam?: Team;
  onStartMatch: () => void;
  onNavigateTo: (tab: any) => void;
  onOpenTeamSelect: () => void;
  hasWebhookUrl?: boolean;
  onQuickSyncSheets?: () => void;
  onQuickPullSheets?: () => void;
  seasonNumber?: number;
  currentDay?: number;
  allPlayers?: Record<string, Player[]>;
  matchHistory?: MatchRecord[];
  leagueNews?: LeagueNewsItem[];
  autoSheetsSync?: boolean;
  onToggleAutoSheetsSync?: () => void;
  autoClubAssist?: boolean;
  onToggleAutoClubAssist?: () => void;
  autoTrainingEnabled?: boolean;
  onToggleAutoTraining?: () => void;
  onSimulateMultipleDays?: (days: number, untilPostseason?: boolean) => void;
  cloudNewerNotice?: { seasonNumber: number; currentDay: number } | null;
  onAcceptCloudSave?: () => void;
  onDismissCloudNotice?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userTeam,
  allTeams,
  roster,
  currentScheduleItem,
  opponentTeam,
  onStartMatch,
  onNavigateTo,
  onOpenTeamSelect,
  hasWebhookUrl,
  onQuickSyncSheets,
  onQuickPullSheets,
  seasonNumber = 26,
  currentDay = 1,
  allPlayers = {},
  matchHistory = [],
  leagueNews = [],
  autoSheetsSync = true,
  onToggleAutoSheetsSync,
  autoClubAssist = true,
  onToggleAutoClubAssist,
  autoTrainingEnabled = true,
  onToggleAutoTraining,
  onSimulateMultipleDays,
  cloudNewerNotice,
  onAcceptCloudSave,
  onDismissCloudNotice,
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

  // 상대 구단 스카우팅 리포트 계산
  const oppRoster = opponentTeam ? (allPlayers[opponentTeam.id] || []) : [];
  const oppPitchers = oppRoster.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && !p.isInjured);
  const oppStarters = oppPitchers.filter(p => p.primaryPosition === 'SP');
  const oppProbableSP = oppStarters.length > 0
    ? oppStarters[(currentDay - 1) % oppStarters.length]
    : oppPitchers[0];

  const oppBatters = oppRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM' && !p.isInjured);
  const oppHotBatter = [...oppBatters].sort((a, b) => {
    const scoreA = (a.batterStats?.homeRuns || 0) * 15 + (a.batterStats?.hits || 0) * 2 + (a.batterStats?.power || 60);
    const scoreB = (b.batterStats?.homeRuns || 0) * 15 + (b.batterStats?.hits || 0) * 2 + (b.batterStats?.power || 60);
    return scoreB - scoreA;
  })[0];

  let h2hWins = 0;
  let h2hLosses = 0;
  let h2hDraws = 0;
  if (opponentTeam) {
    matchHistory
      .filter(m => m.seasonNumber === seasonNumber)
      .forEach(m => {
        const involvesBoth =
          (m.homeTeamName === userTeam.name && m.awayTeamName === opponentTeam.name) ||
          (m.awayTeamName === userTeam.name && m.homeTeamName === opponentTeam.name);
        if (!involvesBoth) return;
        const userScore = m.homeTeamName === userTeam.name ? m.homeScore : m.awayScore;
        const oppScore = m.homeTeamName === userTeam.name ? m.awayScore : m.homeScore;
        if (userScore > oppScore) h2hWins += 1;
        else if (userScore < oppScore) h2hLosses += 1;
        else h2hDraws += 1;
      });
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Hero Team Banner */}
      <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-sky-800 text-white rounded-2xl p-4 sm:p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-5">
            <div
              className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-display font-black text-xl sm:text-3xl shadow-lg border-2 border-white/40 shrink-0"
              style={{ backgroundColor: userTeam.color }}
            >
              {userTeam.logoInitial}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-3xl font-display font-extrabold text-white tracking-tight">
                  {userTeam.name}
                </h1>
                <span className="bg-white/20 text-white border border-white/30 text-xs px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                  리그 {myRank}위
                </span>
              </div>
              <p className="text-xs sm:text-sm text-sky-100 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span>모기업: {userTeam.owner}</span>
                <span aria-hidden="true">·</span>
                <span>홈구장: {userTeam.homeStadium}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 inline" /> 통산 {userTeam.championships}회 우승
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs font-mono-numbers">
                <span className="text-white">
                  시즌 성적: <strong className="text-amber-300 text-sm font-bold">{userTeam.wins}승</strong> {userTeam.draws}무 <strong className="text-sky-200 text-sm">{userTeam.losses}패</strong>
                </span>
                <span className="text-white/40 hidden sm:inline">|</span>
                <span className="text-white">
                  구단 예산: <strong className="text-amber-300 text-sm font-bold">{(userTeam.budget / 10000).toLocaleString()}억원</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick CTA to Live Game & Switch Team */}
          <div className="grid grid-cols-1 sm:flex sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <button
              onClick={onOpenTeamSelect}
              className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-display font-bold text-xs shadow-sm transition-all"
            >
              <ArrowLeftRight className="w-4 h-4" />
              구단 선택·변경
            </button>
            <button
              onClick={onStartMatch}
              className="flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              오늘 경기 지휘하기
            </button>
          </div>
        </div>

        {/* Decorative subtle circles */}
        <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* Newer Google Sheets Save Banner (Cross-Device Sync) */}
      {cloudNewerNotice && onAcceptCloudSave && (
        <div className="bg-gradient-to-r from-emerald-50 via-sky-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-emerald-900 block text-sm">
                구글 시트에 더 최신 리그 기록(제 {cloudNewerNotice.seasonNumber}회차 {cloudNewerNotice.currentDay}일차)이 감지되었습니다!
              </span>
              <span className="text-emerald-700">
                다른 기기에서 진행한 최신 기록을 지금 바로 불러와 이어서 플레이할 수 있습니다.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onAcceptCloudSave}
              className="px-4 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm whitespace-nowrap"
            >
              바로 불러와 이어하기
            </button>
            {onDismissCloudNotice && (
              <button
                onClick={onDismissCloudNotice}
                className="px-3 py-2 min-h-[40px] rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold whitespace-nowrap"
              >
                무시
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-device Cloud Sync Bar (PC ↔ Tablet ↔ Phone) */}
      {hasWebhookUrl && onQuickSyncSheets && onQuickPullSheets && (
        <div className="bg-white border border-sky-100 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-bold text-slate-800 block">여러 기기(PC · 태블릿 · 스마트폰) 자동 연동</span>
            <span className="text-[11px] text-slate-500">
              구글 시트에 현재 진행을 저장하거나, 다른 기기에서 진행한 리그 기록을 바로 불러올 수 있습니다.
            </span>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
            <button
              onClick={onQuickSyncSheets}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              시트에 저장
            </button>
            <button
              onClick={onQuickPullSheets}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
            >
              <CloudDownload className="w-3.5 h-3.5" />
              시트에서 불러오기
            </button>
          </div>
        </div>
      )}

      {/* Multi-Game Auto Simulation & Automation Toggles */}
      {onSimulateMultipleDays && (
        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-display font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                <FastForward className="w-4 h-4 text-sky-600" /> 원클릭 일괄 진행 & 완전 자동화 제어
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                여러 경기를 한 번에 자동 시뮬레이션하고, 부상 교체·선수 육성·시트 백업까지 자동으로 처리합니다. (트레이드 도착 시 자동 정지 및 결재 팝업)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => onSimulateMultipleDays(1)}
                className="px-3 py-2 min-h-[40px] rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                1경기 빠른 진행
              </button>
              <button
                onClick={() => onSimulateMultipleDays(5)}
                className="px-3 py-2 min-h-[40px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                5경기 자동 진행
              </button>
              <button
                onClick={() => onSimulateMultipleDays(10)}
                className="px-3 py-2 min-h-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                10경기 자동 진행
              </button>
              <button
                onClick={() => onSimulateMultipleDays(30, true)}
                className="px-3 py-2 min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                포스트시즌까지 자동 완주
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sky-100/80">
            {onToggleAutoSheetsSync && (
              <button
                onClick={onToggleAutoSheetsSync}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  autoSheetsSync
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                경기 후 시트 자동 백업: {autoSheetsSync ? 'ON' : 'OFF'}
              </button>
            )}
            {onToggleAutoClubAssist && (
              <button
                onClick={onToggleAutoClubAssist}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  autoClubAssist
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                부상·라인업 자동 관리: {autoClubAssist ? 'ON' : 'OFF'}
              </button>
            )}
            {onToggleAutoTraining && (
              <button
                onClick={onToggleAutoTraining}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  autoTrainingEnabled
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                전 구단 매일 자동 육성: {autoTrainingEnabled ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        </div>
      )}

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

          {/* Matchup Scouting Report Strip */}
          <div className="mt-4 pt-3.5 border-t border-sky-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center gap-2.5">
              <Crosshair className="w-4 h-4 text-sky-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-semibold block">상대 예상 선발 투수</span>
                <span className="font-bold text-slate-900 truncate block font-mono-numbers">
                  {oppProbableSP
                    ? `${oppProbableSP.name} (${oppProbableSP.pitcherStats?.velocity || 144}km/h)`
                    : '선발 정보 대기'}
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-semibold block">상대 핵심 경계 타자</span>
                <span className="font-bold text-slate-900 truncate block font-mono-numbers">
                  {oppHotBatter
                    ? `${oppHotBatter.name} (${oppHotBatter.batterStats?.homeRuns || 0}홈런 · ${oppHotBatter.primaryPosition})`
                    : '타선 정보 대기'}
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 font-semibold block">올 시즌 상대 전적</span>
                <span className="font-bold text-slate-900 truncate block font-mono-numbers">
                  {h2hWins + h2hDraws + h2hLosses > 0
                    ? `${h2hWins}승 ${h2hDraws}무 ${h2hLosses}패`
                    : '시즌 첫 맞대결'}
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

      {/* 5. JBL League News & Milestone Feed */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-sky-100 pb-3">
          <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-sky-600" /> JBL 리그 속보 & 대기록 뉴스 피드
          </h3>
          <span className="text-[11px] text-slate-400">
            노히트·멀티홈런·FA·트레이드·우승 자동 브리핑
          </span>
        </div>

        {leagueNews.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            아직 등록된 리그 속보가 없습니다. 경기를 진행하거나 위 [자동 진행] 버튼을 누르면 리그 전역의 대기록과 이적 뉴스가 자동으로 수집됩니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {leagueNews.slice(0, 12).map(news => {
              const badgeMap: Record<LeagueNewsItem['category'], { label: string; cls: string }> = {
                RECORD: { label: '대기록', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
                MATCH: { label: '경기속보', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
                FA: { label: 'FA영입', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                TRADE: { label: '트레이드', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                AWARD: { label: '시즌결산', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
                STREAK: { label: '연승행진', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
              };
              const badge = badgeMap[news.category] || badgeMap.MATCH;
              return (
                <div
                  key={news.id}
                  className="p-3 rounded-xl bg-sky-50/40 border border-sky-100 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] font-mono-numbers text-slate-400">
                      {news.seasonNumber}회 {news.day}일차
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">{news.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{news.detail}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
