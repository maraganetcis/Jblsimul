/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeftRight, CheckCircle, XCircle, Bell } from 'lucide-react';
import { PendingApproval, Player, Team } from '../types/baseball';
import { soundEffects } from '../utils/audio';
import { calculatePlayerTradeValue } from '../utils/simulationEngine';

interface TradeViewProps {
  userTeam: Team;
  allTeams: Team[];
  userRoster: Player[];
  allPlayers: Record<string, Player[]>;
  pendingApprovalsCount: number;
  onOpenApprovals: () => void;
  onQueueTradeApproval: (approval: PendingApproval) => void;
  onExecuteTrade: (myPlayer: Player, theirPlayer: Player, theirTeamId: string, logDesc: string) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

export const TradeView: React.FC<TradeViewProps> = ({
  userTeam,
  allTeams,
  userRoster,
  allPlayers,
  pendingApprovalsCount,
  onOpenApprovals,
  onQueueTradeApproval,
  onExecuteTrade,
  onOpenPlayerDetail,
}) => {
  const otherTeams = allTeams.filter(t => t.id !== userTeam.id);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(otherTeams[0]?.id || '');
  const [myOfferPlayerId, setMyOfferPlayerId] = useState<string>('');
  const [theirTargetPlayerId, setTheirTargetPlayerId] = useState<string>('');
  const [tradeMessage, setTradeMessage] = useState<{ type: 'SUCCESS' | 'REJECT'; text: string } | null>(null);

  const targetTeam = allTeams.find(t => t.id === selectedTeamId) || otherTeams[0];
  const targetRoster = allPlayers[selectedTeamId] || [];

  const myOfferPlayer = userRoster.find(p => p.id === myOfferPlayerId);
  const theirTargetPlayer = targetRoster.find(p => p.id === theirTargetPlayerId);

  const myValue = myOfferPlayer ? calculatePlayerTradeValue(myOfferPlayer) : 0;
  const theirValue = theirTargetPlayer ? calculatePlayerTradeValue(theirTargetPlayer) : 0;

  const handleProposeTrade = () => {
    if (!myOfferPlayer || !theirTargetPlayer) {
      setTradeMessage({
        type: 'REJECT',
        text: '제안할 우리 팀 선수와 영입할 상대 구단 선수를 각각 선택해주세요.',
      });
      return;
    }

    const delta = myValue - theirValue;
    if (delta >= -5) {
      soundEffects.playCrowdCheer(true);
      onQueueTradeApproval({
        id: `appr_user_trade_${Date.now()}`,
        category: 'TRADE_INCOMING',
        title: `${targetTeam.name} 트레이드 최종 승인 대기`,
        subtitle: `${targetTeam.name} 단장이 제안에 동의했습니다. 최종 승인하시겠습니까?`,
        createdAtDay: 1,
        seasonNumber: 26,
        fromTeamId: targetTeam.id,
        toTeamId: userTeam.id,
        offeredPlayer: theirTargetPlayer,
        requestedPlayer: myOfferPlayer,
        evaluationSummary: `${targetTeam.name} 측이 ${theirTargetPlayer.name}(가치 ${theirValue}점) ↔ ${myOfferPlayer.name}(가치 ${myValue}점) 트레이드를 수락했습니다. 아래 [승인 확정]을 누르면 즉시 선수가 이동합니다.`,
      });
      setMyOfferPlayerId('');
      setTheirTargetPlayerId('');
      setTradeMessage({
        type: 'SUCCESS',
        text: `✅ ${targetTeam.name} 구단이 트레이드 조건에 합의했습니다! 방금 열린 승인 알림창에서 최종 확정해주세요.`,
      });
    } else {
      soundEffects.playUmpireCall(false);
      // 상대 구단이 가치가 맞는 대체 역제안을 알림창으로 보낼 수 있음
      const counterTarget = userRoster.find(
        p => p.id !== myOfferPlayer.id && Math.abs(calculatePlayerTradeValue(p) - theirValue) <= 10
      );
      if (counterTarget) {
        onQueueTradeApproval({
          id: `appr_counter_${Date.now()}`,
          category: 'TRADE_INCOMING',
          title: `${targetTeam.name} 구단의 트레이드 역제안 도착`,
          subtitle: `${myOfferPlayer.name} 대신 ${counterTarget.name} 선수를 포함한 수정안을 제시했습니다.`,
          createdAtDay: 1,
          seasonNumber: 26,
          fromTeamId: targetTeam.id,
          toTeamId: userTeam.id,
          offeredPlayer: theirTargetPlayer,
          requestedPlayer: counterTarget,
          evaluationSummary: `${targetTeam.name} 단장이 ${theirTargetPlayer.name}(가치 ${theirValue}점)을 내주는 조건으로 우리 팀 ${counterTarget.name}(가치 ${calculatePlayerTradeValue(counterTarget)}점)을 요청했습니다. 알림창에서 수락 또는 거절할 수 있습니다.`,
        });
        setTradeMessage({
          type: 'REJECT',
          text: `🔔 ${targetTeam.name} 단장이 원래 제안을 거절하고 [${counterTarget.name} ↔ ${theirTargetPlayer.name}] 역제안을 알림창으로 보냈습니다!`,
        });
      } else {
        setTradeMessage({
          type: 'REJECT',
          text: `❌ ${targetTeam.name} 단장: "우리 핵심 자원인 ${theirTargetPlayer.name} 선수의 가치(${theirValue}점)에 비해 제안하신 선수(${myOfferPlayer.name}, ${myValue}점)의 가치가 부족하여 제안을 거절합니다."`,
        });
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-sky-600" /> JBL 공식 선수 트레이드 시장 (Trade Market)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            타 구단의 전력을 탐색해 제안하거나, 매 경기 후 도착하는 트레이드 결재 알림을 승인·거절하세요.
          </p>
        </div>

        {/* Target Team Select Dropdown & Approval Inbox Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenApprovals}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              pendingApprovalsCount > 0
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            결재 알림함 ({pendingApprovalsCount}건)
          </button>

          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">협상 상대:</span>
          <select
            value={selectedTeamId}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setTheirTargetPlayerId('');
              setTradeMessage(null);
            }}
            className="bg-white border border-sky-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-sky-500 shadow-sm"
          >
            {otherTeams.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.wins}승 {t.losses}패)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result Toast */}
      {tradeMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 border shadow-sm ${
          tradeMessage.type === 'SUCCESS'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}>
          {tradeMessage.type === 'SUCCESS' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span>{tradeMessage.text}</span>
        </div>
      )}

      {/* Trade Proposal Desk */}
      <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
          {/* Left: My Offered Player */}
          <div className="md:col-span-5 bg-sky-50/60 border border-sky-100 rounded-xl p-4">
            <div className="flex items-center justify-between pb-2 border-b border-sky-100 mb-2">
              <span className="text-xs font-bold text-sky-800">{userTeam.name} 방출 제안 선수</span>
              {myOfferPlayer && (
                <span className="text-xs font-mono-numbers text-slate-600">
                  산정 가치: <strong className="text-sky-600 text-sm">{myValue}점</strong>
                </span>
              )}
            </div>

            {myOfferPlayer ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-slate-900">{myOfferPlayer.name}</h4>
                  <span className="text-xs text-slate-500">
                    {myOfferPlayer.primaryPosition} · 만 {myOfferPlayer.age}세 · {myOfferPlayer.potential}등급
                  </span>
                </div>
                <button
                  onClick={() => setMyOfferPlayerId('')}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  취소
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                아래 우리 팀 명단에서 내줄 선수를 선택하세요.
              </p>
            )}
          </div>

          {/* Center: Exchange Icon & Proposal Button */}
          <div className="md:col-span-1 flex flex-col items-center justify-center">
            <ArrowLeftRight className="w-6 h-6 text-sky-600 mb-1" />
          </div>

          {/* Right: Opponent Target Player */}
          <div className="md:col-span-5 bg-sky-50/60 border border-sky-100 rounded-xl p-4">
            <div className="flex items-center justify-between pb-2 border-b border-sky-100 mb-2">
              <span className="text-xs font-bold text-sky-800">{targetTeam.name} 영입 희망 선수</span>
              {theirTargetPlayer && (
                <span className="text-xs font-mono-numbers text-slate-600">
                  산정 가치: <strong className="text-sky-600 text-sm">{theirValue}점</strong>
                </span>
              )}
            </div>

            {theirTargetPlayer ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-slate-900">{theirTargetPlayer.name}</h4>
                  <span className="text-xs text-slate-500">
                    {theirTargetPlayer.primaryPosition} · 만 {theirTargetPlayer.age}세 · {theirTargetPlayer.potential}등급
                  </span>
                </div>
                <button
                  onClick={() => setTheirTargetPlayerId('')}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  취소
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                아래 상대 팀 명단에서 영입할 선수를 선택하세요.
              </p>
            )}
          </div>
        </div>

        {/* Confirm Action Button */}
        <div className="mt-5 text-center">
          <button
            onClick={handleProposeTrade}
            disabled={!myOfferPlayer || !theirTargetPlayer}
            className="px-8 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-30 text-white font-bold text-sm shadow-md shadow-sky-500/20 transition-all active:scale-95"
          >
            트레이드 공식 제안 보내기 (Submit Proposal)
          </button>
        </div>
      </div>

      {/* Two-Column Rosters to Pick From */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* User Roster */}
        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center justify-between">
            <span>{userTeam.name} 선수 명단</span>
            <span className="text-xs text-slate-400 font-mono-numbers">클릭하여 제안 선택</span>
          </h3>

          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {userRoster.map(p => {
              const val = calculatePlayerTradeValue(p);
              const isSelected = p.id === myOfferPlayerId;
              return (
                <div
                  key={p.id}
                  onClick={() => setMyOfferPlayerId(p.id)}
                  className={`p-2.5 rounded-xl cursor-pointer border flex items-center justify-between text-xs transition-all ${
                    isSelected
                      ? 'bg-sky-100 border-sky-400 text-sky-900 font-bold shadow-sm'
                      : 'bg-white hover:bg-sky-50/60 border-sky-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[10px] text-sky-800 font-semibold border border-sky-200">
                      {p.primaryPosition}
                    </span>
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">만 {p.age}세</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono-numbers">
                    <span className={`font-bold ${p.potential === 'S' ? 'text-amber-500' : 'text-slate-400'}`}>
                      {p.potential}급
                    </span>
                    <span className="text-sky-600 font-bold">가치 {val}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Team Roster */}
        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <h3 className="font-display font-bold text-sm text-slate-800 mb-3 flex items-center justify-between">
            <span>{targetTeam.name} 선수 명단</span>
            <span className="text-xs text-slate-400 font-mono-numbers">클릭하여 영입 선택</span>
          </h3>

          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {targetRoster.map(p => {
              const val = calculatePlayerTradeValue(p);
              const isSelected = p.id === theirTargetPlayerId;
              return (
                <div
                  key={p.id}
                  onClick={() => setTheirTargetPlayerId(p.id)}
                  className={`p-2.5 rounded-xl cursor-pointer border flex items-center justify-between text-xs transition-all ${
                    isSelected
                      ? 'bg-sky-100 border-sky-400 text-sky-900 font-bold shadow-sm'
                      : 'bg-white hover:bg-sky-50/60 border-sky-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[10px] text-sky-800 font-semibold border border-sky-200">
                      {p.primaryPosition}
                    </span>
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono-numbers">만 {p.age}세</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono-numbers">
                    <span className={`font-bold ${p.potential === 'S' ? 'text-amber-500' : 'text-slate-400'}`}>
                      {p.potential}급
                    </span>
                    <span className="text-sky-600 font-bold">가치 {val}</span>
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
