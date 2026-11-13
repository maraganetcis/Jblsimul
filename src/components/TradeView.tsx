/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeftRight, Shield, CheckCircle, XCircle, Search, HelpCircle, Users } from 'lucide-react';
import { Player, Team } from '../types/baseball';
import { soundEffects } from '../utils/audio';

interface TradeViewProps {
  userTeam: Team;
  allTeams: Team[];
  userRoster: Player[];
  allPlayers: Record<string, Player[]>;
  onExecuteTrade: (myPlayer: Player, theirPlayer: Player, theirTeamId: string, logDesc: string) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

export const TradeView: React.FC<TradeViewProps> = ({
  userTeam,
  allTeams,
  userRoster,
  allPlayers,
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

  // 선수 트레이드 가치(Trade Value) 계산 공식
  const calculatePlayerValue = (p: Player): number => {
    let base = 50;
    const potBoost = p.potential === 'S' ? 35 : p.potential === 'A' ? 22 : p.potential === 'B' ? 12 : p.potential === 'C' ? 0 : -10;
    const ageFactor = p.age <= 23 ? 15 : p.age <= 28 ? 10 : p.age <= 32 ? 2 : -12;

    if (p.role === 'BATTER' && p.batterStats) {
      const { contact, power, eye, defense } = p.batterStats;
      base = (contact * 0.35 + power * 0.35 + eye * 0.15 + defense * 0.15);
    } else if (p.role === 'PITCHER' && p.pitcherStats) {
      const { velocity, control, stuff } = p.pitcherStats;
      const veloScore = (velocity - 130) * 2;
      base = (veloScore * 0.3 + control * 0.35 + stuff * 0.35);
    }
    return Math.round(base + potBoost + ageFactor);
  };

  const myValue = myOfferPlayer ? calculatePlayerValue(myOfferPlayer) : 0;
  const theirValue = theirTargetPlayer ? calculatePlayerValue(theirTargetPlayer) : 0;

  const handleProposeTrade = () => {
    if (!myOfferPlayer || !theirTargetPlayer) {
      alert('제안할 내 선수와 영입할 상대 선수를 각각 선택해주세요.');
      return;
    }

    const delta = myValue - theirValue;
    if (delta >= -5) {
      soundEffects.playCrowdCheer(true);
      const desc = `${userTeam.name}의 ${myOfferPlayer.name}(${myOfferPlayer.primaryPosition}) <-> ${targetTeam.name}의 ${theirTargetPlayer.name}(${theirTargetPlayer.primaryPosition}) 트레이드 성사!`;
      onExecuteTrade(myOfferPlayer, theirTargetPlayer, targetTeam.id, desc);
      setTradeMessage({
        type: 'SUCCESS',
        text: `🎉 트레이드 성사! ${targetTeam.name} 구단이 제안을 수락하였습니다. (${theirTargetPlayer.name} 선수 입단 완료)`,
      });
      setMyOfferPlayerId('');
      setTheirTargetPlayerId('');
    } else {
      soundEffects.playUmpireCall(false);
      setTradeMessage({
        type: 'REJECT',
        text: `❌ ${targetTeam.name} 단장: "우리 핵심 자원인 ${theirTargetPlayer.name} 선수의 가치(${theirValue}점)에 비해 제안하신 선수(${myOfferPlayer.name}, ${myValue}점)의 가치가 부족하여 제안을 거절합니다."`,
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-sky-600" /> JBL 공식 선수 트레이드 시장 (Trade Market)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            타 9개 구단의 전력을 탐색하고, 구단 간의 균형 있는 전력 보강을 위한 맞교환 트레이드를 협상하세요.
          </p>
        </div>

        {/* Target Team Select Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">협상 상대 구단:</span>
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
              const val = calculatePlayerValue(p);
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
              const val = calculatePlayerValue(p);
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
