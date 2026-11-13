/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Users, ArrowUpDown, ChevronUp, ChevronDown, Shield, Award, Info, Search } from 'lucide-react';
import { Player, Position, Team } from '../types/baseball';

interface RosterViewProps {
  userTeam: Team;
  roster: Player[];
  onUpdateRoster: (newRoster: Player[]) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

export const RosterView: React.FC<RosterViewProps> = ({
  userTeam,
  roster,
  onUpdateRoster,
  onOpenPlayerDetail,
}) => {
  const [selectedTab, setSelectedTab] = useState<'LINEUP' | 'PITCHERS' | 'RESERVES'>('LINEUP');

  // 1군 타자 라인업 (1~9번)
  const firstTeamBatters = roster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM');
  // 1군 투수진
  const firstTeamPitchers = roster.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM');
  // 2군 전체
  const secondTeamPlayers = roster.filter(p => p.tier === 'SECOND_TEAM');

  // 타순 올리기/내리기
  const moveBattingOrder = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= firstTeamBatters.length) return;

    const newBatters = [...firstTeamBatters];
    const temp = newBatters[index];
    newBatters[index] = newBatters[targetIndex];
    newBatters[targetIndex] = temp;

    // 전체 로스터에 반영
    const others = roster.filter(p => !(p.role === 'BATTER' && p.tier === 'FIRST_TEAM'));
    onUpdateRoster([...newBatters, ...others]);
  };

  // 1군 <-> 2군 승격 및 강등
  const togglePlayerTier = (player: Player) => {
    const nextTier: 'FIRST_TEAM' | 'SECOND_TEAM' = player.tier === 'FIRST_TEAM' ? 'SECOND_TEAM' : 'FIRST_TEAM';
    const updated = roster.map(p => p.id === player.id ? { ...p, tier: nextTier } : p);
    onUpdateRoster(updated);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" /> {userTeam.name} 선수단 로스터 & 타순 관리
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            1군(엔트리)과 2군(육성군)을 조율하고, 1~9번 타선 및 선발/불펜 투수진을 전략적으로 배치하세요.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setSelectedTab('LINEUP')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedTab === 'LINEUP' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1군 선발 타순 ({firstTeamBatters.length}명)
          </button>
          <button
            onClick={() => setSelectedTab('PITCHERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedTab === 'PITCHERS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1군 투수 로테이션 ({firstTeamPitchers.length}명)
          </button>
          <button
            onClick={() => setSelectedTab('RESERVES')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedTab === 'RESERVES' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2군 육성군 ({secondTeamPlayers.length}명)
          </button>
        </div>
      </div>

      {/* View 1: 1군 타순 편성 (Batting Order) */}
      {selectedTab === 'LINEUP' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900">
              선발 라인업 (1번 ~ 9번 타자)
            </span>
            <span className="text-xs text-slate-500">
              ▲▼ 버튼으로 타순을 변경하거나, 선수를 클릭하여 상세 프로필을 확인하세요.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead>
                <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40">
                  <th className="py-3 px-3 text-center w-12 font-bold">타순</th>
                  <th className="py-3 px-3 font-bold">선수명</th>
                  <th className="py-3 px-2 text-center w-16 font-bold">포지션</th>
                  <th className="py-3 px-2 text-center w-12 font-bold">잠재력</th>
                  <th className="py-3 px-3 text-right font-bold">컨택</th>
                  <th className="py-3 px-3 text-right font-bold">파워</th>
                  <th className="py-3 px-3 text-right font-bold">선구안</th>
                  <th className="py-3 px-3 text-right font-bold">주력</th>
                  <th className="py-3 px-3 text-right font-bold">수비</th>
                  <th className="py-3 px-3 text-right text-emerald-600 font-bold">타율</th>
                  <th className="py-3 px-3 text-right text-amber-600 font-bold">홈런</th>
                  <th className="py-3 px-3 text-right font-bold">타점</th>
                  <th className="py-3 px-3 text-center w-28 font-bold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70">
                {firstTeamBatters.map((player, idx) => {
                  const s = player.batterStats;
                  const avg = s?.atBats ? (s.hits / s.atBats).toFixed(3) : '.000';
                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-sky-50/60 transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-display font-bold text-sky-600 text-sm">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => onOpenPlayerDetail(player)}
                          className="font-bold text-sm text-slate-900 hover:text-sky-600 text-left transition-colors"
                        >
                          {player.name}
                        </button>
                        <span className="text-[11px] text-slate-400 block font-sans">만 {player.age}세 · 레벨 {player.level}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[11px]">
                          {player.primaryPosition}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`font-bold ${player.potential === 'S' ? 'text-amber-500' : player.potential === 'A' ? 'text-purple-600' : 'text-sky-600'}`}>
                          {player.potential}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.contact}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.power}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.eye}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.speed}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.defense}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">{avg}</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-500">{s?.homeRuns || 0}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{s?.rbi || 0}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => moveBattingOrder(idx, 'UP')}
                            disabled={idx === 0}
                            title="타순 올리기"
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-600"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveBattingOrder(idx, 'DOWN')}
                            disabled={idx === firstTeamBatters.length - 1}
                            title="타순 내리기"
                            className="p-1 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-600"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => togglePlayerTier(player)}
                            title="2군으로 말소"
                            className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold hover:bg-rose-100 transition-colors ml-1"
                          >
                            2군 강등
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: 1군 투수진 로테이션 (Pitching Staff) */}
      {selectedTab === 'PITCHERS' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900">
              1군 투수 로테이션 (선발, 불펜, 마무리)
            </span>
            <span className="text-xs text-slate-500">
              선발 5인 로테이션과 셋업, 마무리 투수의 보직과 투구 기록을 점검하세요.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead>
                <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40">
                  <th className="py-3 px-3 font-bold">선수명</th>
                  <th className="py-3 px-2 text-center w-20 font-bold">보직</th>
                  <th className="py-3 px-2 text-center w-12 font-bold">잠재력</th>
                  <th className="py-3 px-3 text-right font-bold">최고구속</th>
                  <th className="py-3 px-3 text-right font-bold">제구력</th>
                  <th className="py-3 px-3 text-right font-bold">구위</th>
                  <th className="py-3 px-3 text-right font-bold">체력</th>
                  <th className="py-3 px-3 text-right font-bold">경기수</th>
                  <th className="py-3 px-3 text-right font-bold">이닝</th>
                  <th className="py-3 px-3 text-right text-emerald-600 font-bold">승</th>
                  <th className="py-3 px-3 text-right text-rose-500 font-bold">패</th>
                  <th className="py-3 px-3 text-right text-amber-500 font-bold">세/홀</th>
                  <th className="py-3 px-3 text-right text-sky-600 font-bold">ERA</th>
                  <th className="py-3 px-3 text-center w-24 font-bold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70">
                {firstTeamPitchers.map((player) => {
                  const s = player.pitcherStats;
                  const ipOuts = s?.inningsOuts || 0;
                  const fullIp = Math.floor(ipOuts / 3);
                  const partIp = ipOuts % 3;
                  const ipStr = fullIp + (partIp > 0 ? '.' + partIp : '');
                  const era = ipOuts > 0 ? ((s?.earnedRuns || 0) * 9 / (ipOuts / 3)).toFixed(2) : '0.00';

                  return (
                    <tr key={player.id} className="hover:bg-sky-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <button
                          onClick={() => onOpenPlayerDetail(player)}
                          className="font-bold text-sm text-slate-900 hover:text-sky-600 text-left transition-colors"
                        >
                          {player.name}
                        </button>
                        <span className="text-[11px] text-slate-400 block font-sans">만 {player.age}세 · 레벨 {player.level}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          player.primaryPosition === 'CP'
                            ? 'bg-rose-100 text-rose-800'
                            : player.primaryPosition === 'SP'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {player.primaryPosition}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`font-bold ${player.potential === 'S' ? 'text-amber-500' : player.potential === 'A' ? 'text-purple-600' : 'text-sky-600'}`}>
                          {player.potential}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-sky-600 font-bold">{s?.velocity}km/h</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.control}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.stuff}</td>
                      <td className="py-3 px-3 text-right text-slate-700">{s?.stamina}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{s?.games || 0}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{ipStr}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">{s?.wins || 0}</td>
                      <td className="py-3 px-3 text-right font-bold text-rose-500">{s?.losses || 0}</td>
                      <td className="py-3 px-3 text-right font-bold text-amber-500">
                        {player.primaryPosition === 'CP' ? s?.saves || 0 : s?.holds || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sky-600">{era}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => togglePlayerTier(player)}
                          title="2군으로 말소"
                          className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold hover:bg-rose-100 transition-colors"
                        >
                          2군 강등
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

      {/* View 3: 2군 육성군 (Second Team Prospects) */}
      {selectedTab === 'RESERVES' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900">
              2군 육성군 유망주 (Reserves & Prospects)
            </span>
            <span className="text-xs text-sky-700 font-semibold">
              [1군 승격] 버튼을 누르면 언제든지 1군 엔트리로 즉시 콜업할 수 있습니다.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead>
                <tr className="text-slate-600 border-b border-sky-100 bg-sky-50/40">
                  <th className="py-3 px-3 font-bold">선수명</th>
                  <th className="py-3 px-2 text-center w-16 font-bold">구분</th>
                  <th className="py-3 px-2 text-center w-16 font-bold">포지션</th>
                  <th className="py-3 px-2 text-center w-12 font-bold">잠재력</th>
                  <th className="py-3 px-3 font-bold">주요 능력치 요약</th>
                  <th className="py-3 px-3 text-center font-bold">성장 레벨</th>
                  <th className="py-3 px-3 text-center w-28 font-bold">콜업 관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70">
                {secondTeamPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-sky-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => onOpenPlayerDetail(player)}
                        className="font-bold text-sm text-slate-900 hover:text-sky-600 text-left transition-colors"
                      >
                        {player.name}
                      </button>
                      <span className="text-[11px] text-slate-400 block font-sans">만 {player.age}세</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {player.role === 'BATTER' ? '야수' : '투수'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-slate-900 font-bold">
                      {player.primaryPosition}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`font-bold ${player.potential === 'S' ? 'text-amber-500' : player.potential === 'A' ? 'text-purple-600' : 'text-sky-600'}`}>
                        {player.potential}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {player.role === 'BATTER' ? (
                        <span>컨택 {player.batterStats?.contact} · 파워 {player.batterStats?.power} · 주력 {player.batterStats?.speed}</span>
                      ) : (
                        <span>최고 {player.pitcherStats?.velocity}km/h · 제구 {player.pitcherStats?.control} · 구위 {player.pitcherStats?.stuff}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-amber-500 font-bold">
                      Lv.{player.level} ({player.exp} EXP)
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => togglePlayerTier(player)}
                        className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs transition-colors shadow-sm"
                      >
                        1군 콜업
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
