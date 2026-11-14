/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Briefcase, DollarSign, RefreshCw, Sparkles, CheckCircle2, AlertCircle, UserPlus, Award } from 'lucide-react';
import { FreeAgent, Player, Team } from '../types/baseball';
import { calculatePlayerTradeValue, estimatePlayerSalary } from '../utils/simulationEngine';

interface FreeAgentViewProps {
  userTeam: Team;
  userRoster: Player[];
  freeAgents: FreeAgent[];
  seasonNumber: number;
  onSignFreeAgent: (fa: FreeAgent, offerPrice: number) => void;
  onRefreshFreeAgents: () => void;
  onGrantBonusToPlayer: (player: Player, bonusCost: number) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

function formatWon(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rest = manwon % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${manwon.toLocaleString()}만원`;
}

export const FreeAgentView: React.FC<FreeAgentViewProps> = ({
  userTeam,
  userRoster,
  freeAgents,
  seasonNumber,
  onSignFreeAgent,
  onRefreshFreeAgents,
  onGrantBonusToPlayer,
  onOpenPlayerDetail,
}) => {
  const [subTab, setSubTab] = useState<'MARKET' | 'CONTRACTS'>('MARKET');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'BATTER' | 'PITCHER'>('ALL');
  const [offerMultiplierMap, setOfferMultiplierMap] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const filteredFAs = freeAgents.filter(fa => {
    if (roleFilter === 'ALL') return true;
    return fa.player.role === roleFilter;
  });

  const totalPayroll = userRoster.reduce((acc, p) => acc + estimatePlayerSalary(p), 0);

  const handleAttemptSign = (fa: FreeAgent) => {
    const mult = offerMultiplierMap[fa.id] ?? 1.0;
    const offerPrice = Math.round(fa.askingPrice * mult);

    if (userTeam.budget < offerPrice) {
      setFeedback({
        ok: false,
        msg: `구단 가용 예산(${formatWon(userTeam.budget)})이 부족하여 ${fa.player.name} 선수에게 ${formatWon(offerPrice)} 계약을 제시할 수 없습니다.`,
      });
      setTimeout(() => setFeedback(null), 3500);
      return;
    }

    const acceptProb = mult >= 1.1 ? 0.98 : mult >= 1.0 ? 0.85 : 0.45;
    if (Math.random() <= acceptProb) {
      onSignFreeAgent(fa, offerPrice);
      setFeedback({
        ok: true,
        msg: `🎉 ${fa.player.name}(${fa.player.primaryPosition}) 선수와 ${fa.contractYears}년 총액 ${formatWon(offerPrice)}에 FA 계약을 체결했습니다! (1군 합류)`,
      });
    } else {
      setFeedback({
        ok: false,
        msg: `💬 ${fa.player.name} 측 에이전트가 삭감 오퍼(${formatWon(offerPrice)})를 정중히 거절했습니다. 정가 또는 +15% 프리미엄 오퍼를 시도해보세요.`,
      });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleBonus = (player: Player) => {
    const bonusCost = Math.round(estimatePlayerSalary(player) * 0.15);
    if (userTeam.budget < bonusCost) {
      setFeedback({
        ok: false,
        msg: `예산이 부족합니다. 격려금 및 재계약 보너스(${formatWon(bonusCost)})를 지급할 수 없습니다.`,
      });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    onGrantBonusToPlayer(player, bonusCost);
    setFeedback({
      ok: true,
      msg: `💎 ${player.name} 선수에게 재계약 보너스(${formatWon(bonusCost)})를 지급했습니다! 컨디션 100% & 경험치 +120 획득!`,
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-sky-600" /> {userTeam.name} FA 영입 시장 & 연봉 협상실
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            제 {seasonNumber}회차 스토브리그 FA 선수를 스카우트하거나, 구단 핵심 선수들에게 재계약 보너스를 지급해 사기와 컨디션을 끌어올리세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200 text-xs font-mono-numbers">
            <span className="text-slate-500 block text-[10px]">구단 가용 예산</span>
            <span className="font-extrabold text-sky-700 text-sm">{formatWon(userTeam.budget)}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono-numbers">
            <span className="text-slate-500 block text-[10px]">추정 연봉 총액</span>
            <span className="font-bold text-slate-800 text-sm">{formatWon(totalPayroll)}</span>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-sm ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-sky-100 shadow-sm">
          <button
            onClick={() => setSubTab('MARKET')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              subTab === 'MARKET' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            FA 영입 시장 ({freeAgents.length}명)
          </button>
          <button
            onClick={() => setSubTab('CONTRACTS')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              subTab === 'CONTRACTS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            구단 연봉 · 재계약 보너스 ({userRoster.length}명)
          </button>
        </div>

        {subTab === 'MARKET' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-sky-100 text-xs">
              {[
                { id: 'ALL', label: '전체' },
                { id: 'BATTER', label: '타자' },
                { id: 'PITCHER', label: '투수' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setRoleFilter(f.id as 'ALL' | 'BATTER' | 'PITCHER')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    roleFilter === f.id ? 'bg-sky-100 text-sky-800 font-bold' : 'text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={onRefreshFreeAgents}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> FA 시장 갱신
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: FA Market Cards */}
      {subTab === 'MARKET' && (
        filteredFAs.length === 0 ? (
          <div className="bg-white border border-sky-100 rounded-2xl p-12 text-center space-y-3 shadow-sm">
            <p className="text-sm font-bold text-slate-700">현재 조건에 맞는 FA 선수가 모두 계약 완료되었습니다.</p>
            <button
              onClick={onRefreshFreeAgents}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold"
            >
              새 FA 선수 명단 스카우트하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFAs.map(fa => {
              const p = fa.player;
              const val = calculatePlayerTradeValue(p);
              const mult = offerMultiplierMap[fa.id] ?? 1.0;
              const finalOffer = Math.round(fa.askingPrice * mult);
              return (
                <div
                  key={fa.id}
                  className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 hover:border-sky-300 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-sky-500 text-white font-display font-bold text-sm flex items-center justify-center shadow-xs">
                          {p.primaryPosition}
                        </div>
                        <div>
                          <button
                            onClick={() => onOpenPlayerDetail(p)}
                            className="font-display font-bold text-base text-slate-900 hover:text-sky-600 text-left"
                          >
                            {p.name}
                          </button>
                          <span className="text-[11px] text-slate-500 block">
                            전 {fa.previousTeamName} · 만 {p.age}세 · 잠재력 {p.potential}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-mono-numbers font-bold">
                        종합 {val}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 text-xs font-mono-numbers text-slate-700">
                      {p.role === 'BATTER' && p.batterStats ? (
                        <div className="flex justify-between">
                          <span>컨택 {p.batterStats.contact}</span>
                          <span>파워 {p.batterStats.power}</span>
                          <span>선구 {p.batterStats.eye}</span>
                          <span>수비 {p.batterStats.defense}</span>
                        </div>
                      ) : p.pitcherStats ? (
                        <div className="flex justify-between">
                          <span>구속 {p.pitcherStats.velocity}</span>
                          <span>제구 {p.pitcherStats.control}</span>
                          <span>구위 {p.pitcherStats.stuff}</span>
                          <span>체력 {p.pitcherStats.stamina}</span>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {fa.marketNote} ({fa.contractYears}년 계약 희망)
                    </p>
                  </div>

                  <div className="pt-3 border-t border-sky-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">제시 조건 선택</span>
                      <span className="font-mono-numbers font-bold text-sky-700">{formatWon(finalOffer)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      {[
                        { label: '-10% 협상', val: 0.9 },
                        { label: '정가 오퍼', val: 1.0 },
                        { label: '+15% 확실', val: 1.15 },
                      ].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setOfferMultiplierMap(prev => ({ ...prev, [fa.id]: opt.val }))}
                          className={`py-1 rounded-lg font-bold border transition-colors ${
                            mult === opt.val
                              ? 'bg-sky-500 text-white border-sky-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-sky-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAttemptSign(fa)}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> FA 계약 오퍼 보내기
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tab 2: Team Contracts & Re-signing Bonuses */}
      {subTab === 'CONTRACTS' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-sky-600" /> {userTeam.name} 선수단 연봉 및 재계약 보너스 협상
            </span>
            <span className="text-[11px] text-slate-500">
              보너스 지급 시 컨디션 100% 회복 + 경험치(+120 EXP)가 즉시 부여됩니다.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead>
                <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40 font-bold">
                  <th className="py-3 px-4">선수명</th>
                  <th className="py-3 px-2 text-center">포지션</th>
                  <th className="py-3 px-2 text-center">군/Lv</th>
                  <th className="py-3 px-2 text-center">가치 점수</th>
                  <th className="py-3 px-2 text-center">컨디션</th>
                  <th className="py-3 px-3 text-right">추정 연봉</th>
                  <th className="py-3 px-4 text-center">재계약 · 격려금 (15%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70">
                {[...userRoster]
                  .sort((a, b) => estimatePlayerSalary(b) - estimatePlayerSalary(a))
                  .map(p => {
                    const salary = estimatePlayerSalary(p);
                    const bonusCost = Math.round(salary * 0.15);
                    return (
                      <tr key={p.id} className="hover:bg-sky-50/50">
                        <td className="py-2.5 px-4 font-sans">
                          <button
                            onClick={() => onOpenPlayerDetail(p)}
                            className="font-bold text-slate-900 hover:text-sky-600"
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
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                            {p.primaryPosition}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500">
                          {p.tier === 'FIRST_TEAM' ? '1군' : '2군'}·Lv.{p.level}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-sky-700">
                          {calculatePlayerTradeValue(p)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-emerald-600">
                          {p.condition ?? 85}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {formatWon(salary)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleBonus(p)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-bold transition-colors"
                          >
                            <Award className="w-3 h-3" /> {formatWon(bonusCost)} 보너스
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
