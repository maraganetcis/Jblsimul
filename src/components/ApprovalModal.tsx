/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Bell,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  UserCheck,
  HeartPulse,
  X,
} from 'lucide-react';
import { PendingApproval, Player, Team } from '../types/baseball';
import { calculatePlayerTradeValue } from '../utils/simulationEngine';

interface ApprovalModalProps {
  isOpen: boolean;
  approvals: PendingApproval[];
  allTeams: Team[];
  onApprove: (approval: PendingApproval) => void;
  onReject: (approvalId: string) => void;
  onClose: () => void;
  onInspectPlayer?: (player: Player) => void;
}

const PlayerMiniCard: React.FC<{
  label: string;
  team?: Team;
  player: Player;
  accent: 'sky' | 'amber' | 'emerald';
  onInspect?: (p: Player) => void;
}> = ({ label, team, player, accent, onInspect }) => {
  const value = calculatePlayerTradeValue(player);
  const bs = player.batterStats;
  const ps = player.pitcherStats;
  const avg = bs && bs.atBats > 0 ? (bs.hits / bs.atBats).toFixed(3) : '.000';
  const era =
    ps && ps.inningsOuts > 0
      ? ((ps.earnedRuns * 9) / (ps.inningsOuts / 3)).toFixed(2)
      : '0.00';

  const borderCls =
    accent === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/50'
      : accent === 'amber'
      ? 'border-amber-200 bg-amber-50/50'
      : 'border-sky-200 bg-sky-50/60';

  return (
    <div className={`rounded-2xl border p-4 space-y-2.5 ${borderCls}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500">{label}</span>
        <span className="text-[11px] font-mono-numbers font-bold px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-700">
          가치 {value}점
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-xs"
            style={{ backgroundColor: team?.color || '#0284C7' }}
          >
            {player.primaryPosition}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onInspect?.(player)}
              className="font-display font-bold text-base text-slate-900 hover:text-sky-600 truncate block text-left"
            >
              {player.name}
            </button>
            <span className="text-[11px] text-slate-500 block">
              {team?.name || '구단'} · 만 {player.age}세 · {player.potential}등급 · Lv.{player.level}
            </span>
          </div>
        </div>
      </div>

      {player.role === 'BATTER' && bs ? (
        <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100 text-[11px] font-mono-numbers space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>컨택 {bs.contact} · 파워 {bs.power}</span>
            <span>선구 {bs.eye} · 주력 {bs.speed}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-sky-100/70">
            <span className="text-emerald-600">타율 {avg}</span>
            <span>{bs.homeRuns}홈런 · {bs.rbi}타점</span>
          </div>
        </div>
      ) : ps ? (
        <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100 text-[11px] font-mono-numbers space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>구속 {ps.velocity}km/h</span>
            <span>제구 {ps.control} · 구위 {ps.stuff}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-sky-100/70">
            <span className="text-sky-600">ERA {era}</span>
            <span>{ps.wins}승 {ps.losses}패 · {ps.strikeouts}K</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  isOpen,
  approvals,
  allTeams,
  onApprove,
  onReject,
  onClose,
  onInspectPlayer,
}) => {
  if (!isOpen || approvals.length === 0) return null;

  const current = approvals[0];
  const fromTeam = allTeams.find(t => t.id === current.fromTeamId);
  const toTeam = allTeams.find(t => t.id === current.toTeamId);

  const badgeInfo =
    current.category === 'TRADE_INCOMING'
      ? { label: '긴급 트레이드 제안', color: 'bg-sky-100 text-sky-800 border-sky-300', icon: ArrowLeftRight }
      : current.category === 'TRADE_LEAGUE'
      ? { label: '커미셔너 트레이드 결재', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: ArrowLeftRight }
      : current.category === 'INJURY_REPLACEMENT'
      ? { label: '부상 대체 콜업 결재', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: HeartPulse }
      : { label: '코치진 콜업 추천', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: UserCheck };

  const BadgeIcon = badgeInfo.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-sky-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-sky-100">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeInfo.color}`}>
                <BadgeIcon className="w-3.5 h-3.5" />
                {badgeInfo.label}
              </span>
              <span className="text-[11px] font-mono-numbers text-slate-500">
                제 {current.seasonNumber}회차 {current.createdAtDay}일차 · 대기 {approvals.length}건
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-600 shrink-0" />
              {current.title}
            </h3>
            <p className="text-xs text-slate-500">{current.subtitle}</p>
          </div>

          <button
            onClick={onClose}
            title="알림함에 보류하고 닫기"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison / Target Card */}
        {(current.category === 'TRADE_INCOMING' || current.category === 'TRADE_LEAGUE') &&
        current.offeredPlayer &&
        current.requestedPlayer ? (
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            <div className="md:col-span-5">
              <PlayerMiniCard
                label={current.category === 'TRADE_INCOMING' ? '영입 대상 (상대 선수)' : `${fromTeam?.name || '구단 A'} 방출`}
                team={fromTeam}
                player={current.offeredPlayer}
                accent="emerald"
                onInspect={onInspectPlayer}
              />
            </div>

            <div className="md:col-span-1 flex justify-center">
              <div className="w-9 h-9 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>

            <div className="md:col-span-5">
              <PlayerMiniCard
                label={current.category === 'TRADE_INCOMING' ? '방출 요청 (우리 선수)' : `${toTeam?.name || '구단 B'} 방출`}
                team={toTeam}
                player={current.requestedPlayer}
                accent="amber"
                onInspect={onInspectPlayer}
              />
            </div>
          </div>
        ) : current.category === 'INJURY_REPLACEMENT' && current.offeredPlayer && current.targetPlayer ? (
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            <div className="md:col-span-5">
              <PlayerMiniCard
                label={`부상 이탈 (${current.offeredPlayer.injuryDays}일)`}
                team={fromTeam}
                player={current.offeredPlayer}
                accent="amber"
                onInspect={onInspectPlayer}
              />
            </div>

            <div className="md:col-span-1 flex justify-center">
              <div className="w-9 h-9 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="md:col-span-5">
              <PlayerMiniCard
                label="대체 콜업 추천 (2군)"
                team={fromTeam}
                player={current.targetPlayer}
                accent="emerald"
                onInspect={onInspectPlayer}
              />
            </div>
          </div>
        ) : current.targetPlayer ? (
          <PlayerMiniCard
            label="1군 콜업 추천 유망주"
            team={fromTeam}
            player={current.targetPlayer}
            accent="sky"
            onInspect={onInspectPlayer}
          />
        ) : null}

        {/* Evaluation Summary */}
        <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs text-slate-700 leading-relaxed flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>{current.evaluationSummary}</span>
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-sky-100">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            나중에 결정 (알림함 보관)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onReject(current.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
            >
              <XCircle className="w-4 h-4" />
              거절하기
            </button>
            <button
              onClick={() => onApprove(current)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              승인 확정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
