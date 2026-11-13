/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Award, UserPlus, CheckCircle, Shield, School, ArrowRight } from 'lucide-react';
import { DraftProspect, Player, Team } from '../types/baseball';
import { soundEffects } from '../utils/audio';
import confetti from 'canvas-confetti';

interface DraftViewProps {
  userTeam: Team;
  allTeams: Team[];
  prospects: DraftProspect[];
  onDraftPlayer: (prospect: DraftProspect, draftingTeam: Team, round: number, pickNumber: number) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

export const DraftView: React.FC<DraftViewProps> = ({
  userTeam,
  allTeams,
  prospects,
  onDraftPlayer,
  onOpenPlayerDetail,
}) => {
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [currentPickIndex, setCurrentPickIndex] = useState<number>(0);
  const [draftToast, setDraftToast] = useState<string | null>(null);

  // 드래프트 지명 순서: 역순 룰 (10위 팀이 1순위, 1위 팀이 10순위)
  const sortedByReverseRank = [...allTeams].sort((a, b) => {
    const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
    const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
    return rateA - rateB;
  });

  const currentPickingTeam = sortedByReverseRank[currentPickIndex % sortedByReverseRank.length];
  const isUserTurn = currentPickingTeam?.id === userTeam.id;

  const availableProspects = prospects.filter(p => !p.isDrafted);

  const handlePickProspect = (prospect: DraftProspect) => {
    soundEffects.playCrowdCheer(true);
    if (isUserTurn) {
      confetti({ particleCount: 50, spread: 60 });
    }

    onDraftPlayer(prospect, currentPickingTeam, currentRound, currentPickIndex + 1);
    setDraftToast(`${currentPickingTeam.name} 구단이 [${prospect.name}] 선수를 공식 지명하였습니다!`);
    setTimeout(() => setDraftToast(null), 3000);

    const nextPickIndex = currentPickIndex + 1;
    if (nextPickIndex % sortedByReverseRank.length === 0) {
      setCurrentRound(prev => prev + 1);
    }
    setCurrentPickIndex(nextPickIndex);
  };

  // AI 턴 자동 지명
  const handleSimulateAiPick = () => {
    if (availableProspects.length === 0) return;
    const topProspect = availableProspects[0];
    handlePickProspect(topProspect);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {draftToast && (
        <div className="p-3 bg-sky-50 border border-sky-300 rounded-xl text-sky-900 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-4 h-4 text-sky-600" />
          {draftToast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-sky-600 font-bold">JBL Rookie Draft Center</span>
          </div>
          <h2 className="text-xl font-display font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-sky-600" /> 신인 1차/2차 드래프트 센터
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            역순 지명 룰에 따라 고교 및 대학 최고의 루키 유망주를 지명하여 구단의 미래 10년을 이끌 기둥으로 육성하세요.
          </p>
        </div>

        {/* Current Turn Status */}
        <div className="bg-sky-50/80 border border-sky-200 p-4 rounded-xl flex items-center gap-4 text-xs font-mono-numbers">
          <div>
            <span className="text-slate-500 block text-[10px]">현재 순번</span>
            <span className="font-bold text-sm text-sky-700">
              {currentRound}라운드 {currentPickIndex + 1}순위
            </span>
          </div>
          <div className="border-l border-sky-200 pl-4">
            <span className="text-slate-500 block text-[10px]">지명 권리 구단</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentPickingTeam?.color }}
              />
              <span className={`font-bold text-sm ${isUserTurn ? 'text-sky-700 animate-pulse' : 'text-slate-800'}`}>
                {currentPickingTeam?.name} {isUserTurn && '(내 차례!)'}
              </span>
            </div>
          </div>

          {!isUserTurn && (
            <button
              onClick={handleSimulateAiPick}
              className="ml-2 px-3 py-1.5 rounded-lg bg-white hover:bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200 shadow-sm transition-colors"
            >
              AI 지명 진행 &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Draft Order Sequence Bar */}
      <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 block mb-2">지명 순번 (역순 룰):</span>
        <div className="flex items-center gap-2 min-w-max">
          {sortedByReverseRank.map((t, idx) => {
            const isCurrent = idx === currentPickIndex % sortedByReverseRank.length;
            const isUser = t.id === userTeam.id;
            return (
              <div
                key={t.id}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all ${
                  isCurrent
                    ? 'bg-sky-500 text-white font-bold border-sky-600 shadow-sm scale-105'
                    : isUser
                    ? 'bg-sky-50 border-sky-300 text-sky-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <span className="font-mono-numbers text-[10px] opacity-75">{idx + 1}픽</span>
                <span>{t.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rookie Prospect Pool Table */}
      <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
          <span className="text-xs font-display font-bold text-sky-900">
            드래프트 지명 대상 신인 유망주 풀 ({availableProspects.length}명 남음)
          </span>
          <span className="text-xs text-slate-500">
            {isUserTurn ? '원하는 선수의 [지명하기] 버튼을 누르면 즉시 구단에 입단합니다.' : '상대 구단의 지명을 기다리는 중입니다.'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-numbers">
            <thead>
              <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40">
                <th className="py-3 px-4 font-bold">선수명</th>
                <th className="py-3 px-2 text-center w-20 font-bold">구분</th>
                <th className="py-3 px-2 text-center w-20 font-bold">포지션</th>
                <th className="py-3 px-3 font-bold">출신교</th>
                <th className="py-3 px-2 text-center w-16 font-bold">잠재력</th>
                <th className="py-3 px-3 font-bold">스카우팅 리포트 & 능력치 요약</th>
                <th className="py-3 px-4 text-center w-32 font-bold">지명 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70">
              {prospects.map((p) => {
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      p.isDrafted ? 'opacity-40 bg-slate-50/60' : 'hover:bg-sky-50/60'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className="font-bold text-sm text-slate-900">{p.name}</span>
                      <span className="text-[11px] text-slate-400 block font-sans">만 {p.age}세</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {p.role === 'BATTER' ? '야수' : '투수'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-slate-900 font-bold">
                      {p.position}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="flex items-center gap-1 font-sans">
                        <School className="w-3.5 h-3.5 text-slate-400" /> {p.school}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`font-bold text-sm ${p.potential === 'S' ? 'text-amber-500' : p.potential === 'A' ? 'text-purple-600' : 'text-sky-600'}`}>
                        {p.potential}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 font-sans font-medium text-xs">{p.scoutReport}</div>
                      <div className="text-[11px] text-sky-700 font-mono-numbers mt-0.5 font-semibold">{p.keyStatsPreview}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.isDrafted ? (
                        <span className="text-xs text-slate-400 font-semibold">지명 완료</span>
                      ) : (
                        <button
                          onClick={() => handlePickProspect(p)}
                          disabled={!isUserTurn}
                          className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-30 text-white font-bold text-xs shadow-sm transition-all"
                        >
                          지명하기
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
