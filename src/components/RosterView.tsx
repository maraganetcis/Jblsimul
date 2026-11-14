/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, ChevronUp, ChevronDown, UserPlus, Edit3, X, Check } from 'lucide-react';
import { Player, Position, PotentialGrade, Team } from '../types/baseball';
import { generatePlayer } from '../data/initialLeagueData';

interface RosterViewProps {
  userTeam: Team;
  allTeams: Team[];
  allPlayers: Record<string, Player[]>;
  onUpdateTeamRoster: (teamId: string, newRoster: Player[]) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

const BATTER_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const PITCHER_POSITIONS: Position[] = ['SP', 'RP', 'CP'];

export const RosterView: React.FC<RosterViewProps> = ({
  userTeam,
  allTeams,
  allPlayers,
  onUpdateTeamRoster,
  onOpenPlayerDetail,
}) => {
  const [selectedTab, setSelectedTab] = useState<'LINEUP' | 'PITCHERS' | 'RESERVES'>('LINEUP');
  const [viewingTeamId, setViewingTeamId] = useState<string>(userTeam.id);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync default viewing team if user switches their own team
  useEffect(() => {
    setViewingTeamId(userTeam.id);
  }, [userTeam.id]);

  const viewingTeam = allTeams.find(t => t.id === viewingTeamId) || userTeam;
  const roster = allPlayers[viewingTeam.id] || [];
  const isOwnTeam = viewingTeam.id === userTeam.id;

  // Add Player Modal Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'BATTER' | 'PITCHER'>('BATTER');
  const [newPos, setNewPos] = useState<Position>('SS');
  const [newTier, setNewTier] = useState<'FIRST_TEAM' | 'SECOND_TEAM'>('FIRST_TEAM');
  const [newAge, setNewAge] = useState(24);
  const [newPot, setNewPot] = useState<PotentialGrade>('A');
  const [newContact, setNewContact] = useState(75);
  const [newPower, setNewPower] = useState(75);
  const [newEye, setNewEye] = useState(72);
  const [newSpeed, setNewSpeed] = useState(75);
  const [newDefense, setNewDefense] = useState(74);
  const [newVelocity, setNewVelocity] = useState(148);
  const [newControl, setNewControl] = useState(75);
  const [newStuff, setNewStuff] = useState(76);
  const [newStamina, setNewStamina] = useState(78);

  // 1군 타자 라인업
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

    const others = roster.filter(p => !(p.role === 'BATTER' && p.tier === 'FIRST_TEAM'));
    onUpdateTeamRoster(viewingTeam.id, [...newBatters, ...others]);
  };

  // 1군 <-> 2군 승격 및 강등
  const togglePlayerTier = (player: Player) => {
    const nextTier: 'FIRST_TEAM' | 'SECOND_TEAM' = player.tier === 'FIRST_TEAM' ? 'SECOND_TEAM' : 'FIRST_TEAM';
    const updated = roster.map(p => p.id === player.id ? { ...p, tier: nextTier } : p);
    onUpdateTeamRoster(viewingTeam.id, updated);
  };

  // 새 선수 추가 실행
  const handleCreatePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created = generatePlayer(viewingTeam.id, newRole, newPos, newTier, newPot);
    created.name = newName.trim();
    created.age = newAge;

    if (newRole === 'BATTER' && created.batterStats) {
      created.batterStats = {
        ...created.batterStats,
        contact: newContact,
        power: newPower,
        eye: newEye,
        speed: newSpeed,
        defense: newDefense,
      };
    } else if (newRole === 'PITCHER' && created.pitcherStats) {
      created.pitcherStats = {
        ...created.pitcherStats,
        velocity: newVelocity,
        control: newControl,
        stuff: newStuff,
        stamina: newStamina,
      };
    }

    onUpdateTeamRoster(viewingTeam.id, [...roster, created]);
    setNewName('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" /> {viewingTeam.name} 선수단 로스터 & 리그 관리
            </h2>
            {!isOwnTeam && (
              <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                타 구단 커미셔너 관리 모드
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            모든 10개 구단의 선수 명단을 조회·편집하고, 새 선수를 추가하거나 선수를 클릭해 이름·포지션·스탯을 수정할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Team Switcher for All 10 Teams */}
          <select
            value={viewingTeam.id}
            onChange={(e) => setViewingTeamId(e.target.value)}
            className="bg-sky-50 border border-sky-200 text-slate-800 text-xs rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-sky-500"
          >
            {allTeams.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.id === userTeam.id ? '(내 구단)' : `(${t.wins}승 ${t.losses}패)`}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> 선수 추가
          </button>
        </div>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-sky-100 shadow-sm">
          <button
            onClick={() => setSelectedTab('LINEUP')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedTab === 'LINEUP' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1군 선발 타순 ({firstTeamBatters.length}명)
          </button>
          <button
            onClick={() => setSelectedTab('PITCHERS')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedTab === 'PITCHERS' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1군 투수 로테이션 ({firstTeamPitchers.length}명)
          </button>
          <button
            onClick={() => setSelectedTab('RESERVES')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              selectedTab === 'RESERVES' ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2군 육성군 ({secondTeamPlayers.length}명)
          </button>
        </div>
        <span className="text-xs text-slate-500">
          선수 이름을 클릭하면 <strong className="text-sky-700">이름·포지션·능력치·누적기록</strong>을 직접 수정할 수 있습니다.
        </span>
      </div>

      {/* View 1: 1군 타순 편성 (Batting Order) */}
      {selectedTab === 'LINEUP' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900">
              선발 라인업 (1번 ~ 9번 타자 및 벤치)
            </span>
            <span className="text-xs text-slate-500">
              ▲▼ 버튼으로 타순 변경 · 선수 클릭 시 편집
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
                  <th className="py-3 px-3 text-center w-36 font-bold">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/70">
                {firstTeamBatters.map((player, idx) => {
                  const s = player.batterStats;
                  const avg = s?.atBats ? (s.hits / s.atBats).toFixed(3) : '.000';
                  return (
                    <tr key={player.id} className="hover:bg-sky-50/60 transition-colors">
                      <td className="py-3 px-3 text-center font-display font-bold text-sky-600 text-sm">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => onOpenPlayerDetail(player)}
                          className="font-bold text-sm text-slate-900 hover:text-sky-600 text-left transition-colors flex items-center gap-1"
                        >
                          {player.name}
                          <Edit3 className="w-3 h-3 text-slate-300" />
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

      {/* View 2: 1군 투수진 로테이션 */}
      {selectedTab === 'PITCHERS' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900">
              1군 투수 로테이션 (선발, 불펜, 마무리)
            </span>
            <span className="text-xs text-slate-500">
              선발/불펜/마무리 보직과 투구 기록을 점검하고 수정하세요.
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
                          className="font-bold text-sm text-slate-900 hover:text-sky-600 text-left transition-colors flex items-center gap-1"
                        >
                          {player.name}
                          <Edit3 className="w-3 h-3 text-slate-300" />
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

      {/* View 3: 2군 육성군 */}
      {selectedTab === 'RESERVES' && (
        <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
            <span className="text-xs font-display font-bold text-sky-900">
              2군 육성군 유망주 (Reserves & Prospects)
            </span>
            <span className="text-xs text-sky-700 font-semibold">
              [1군 콜업] 버튼을 누르면 언제든지 1군 엔트리로 즉시 승격할 수 있습니다.
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
                        className="font-bold text-sm text-slate-900 hover:text-sky-600 text-left transition-colors flex items-center gap-1"
                      >
                        {player.name}
                        <Edit3 className="w-3 h-3 text-slate-300" />
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

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePlayer}
            className="bg-white border border-sky-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-sky-100">
              <h3 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-600" /> {viewingTeam.name} 새 선수 추가
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="block col-span-2">
                <span className="font-bold text-slate-700 block mb-1">선수 이름 *</span>
                <input
                  type="text"
                  required
                  placeholder="예: 김도영, 문동주..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 focus:outline-none focus:border-sky-500 text-sm font-bold text-slate-900"
                />
              </label>

              <label className="block">
                <span className="font-bold text-slate-700 block mb-1">투/타 역할</span>
                <select
                  value={newRole}
                  onChange={(e) => {
                    const role = e.target.value as 'BATTER' | 'PITCHER';
                    setNewRole(role);
                    setNewPos(role === 'PITCHER' ? 'SP' : 'SS');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/60 font-semibold text-slate-800"
                >
                  <option value="BATTER">타자 (야수)</option>
                  <option value="PITCHER">투수</option>
                </select>
              </label>

              <label className="block">
                <span className="font-bold text-slate-700 block mb-1">포지션</span>
                <select
                  value={newPos}
                  onChange={(e) => setNewPos(e.target.value as Position)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/60 font-semibold text-slate-800"
                >
                  {(newRole === 'BATTER' ? BATTER_POSITIONS : PITCHER_POSITIONS).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-bold text-slate-700 block mb-1">등록 구분</span>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as 'FIRST_TEAM' | 'SECOND_TEAM')}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/60 font-semibold text-slate-800"
                >
                  <option value="FIRST_TEAM">1군</option>
                  <option value="SECOND_TEAM">2군</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="font-bold text-slate-700 block mb-1">나이</span>
                  <input
                    type="number"
                    min={18}
                    max={45}
                    value={newAge}
                    onChange={(e) => setNewAge(parseInt(e.target.value, 10) || 23)}
                    className="w-full px-2.5 py-2 rounded-xl border border-sky-200 font-mono-numbers"
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-slate-700 block mb-1">잠재력</span>
                  <select
                    value={newPot}
                    onChange={(e) => setNewPot(e.target.value as PotentialGrade)}
                    className="w-full px-2.5 py-2 rounded-xl border border-sky-200 bg-sky-50/60 font-bold"
                  >
                    {(['S', 'A', 'B', 'C', 'D'] as PotentialGrade[]).map(g => (
                      <option key={g} value={g}>{g}급</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Stats Preview Inputs */}
            <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3.5 text-xs">
              <span className="font-bold text-sky-900 block mb-2">
                {newRole === 'BATTER' ? '초기 타자 능력치 (1~99)' : '초기 투수 능력치'}
              </span>
              {newRole === 'BATTER' ? (
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '컨택', val: newContact, set: setNewContact },
                    { label: '파워', val: newPower, set: setNewPower },
                    { label: '선구', val: newEye, set: setNewEye },
                    { label: '주력', val: newSpeed, set: setNewSpeed },
                    { label: '수비', val: newDefense, set: setNewDefense },
                  ].map(s => (
                    <label key={s.label} className="block">
                      <span className="text-[10px] text-slate-500 block">{s.label}</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={s.val}
                        onChange={(e) => s.set(Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 60)))}
                        className="w-full px-2 py-1 rounded border border-sky-200 bg-white font-mono-numbers font-bold"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <label className="block">
                    <span className="text-[10px] text-slate-500 block">구속(km/h)</span>
                    <input
                      type="number"
                      min={125}
                      max={165}
                      value={newVelocity}
                      onChange={(e) => setNewVelocity(Math.min(165, Math.max(125, parseInt(e.target.value, 10) || 145)))}
                      className="w-full px-2 py-1 rounded border border-sky-200 bg-white font-mono-numbers font-bold"
                    />
                  </label>
                  {[
                    { label: '제구', val: newControl, set: setNewControl },
                    { label: '구위', val: newStuff, set: setNewStuff },
                    { label: '체력', val: newStamina, set: setNewStamina },
                  ].map(s => (
                    <label key={s.label} className="block">
                      <span className="text-[10px] text-slate-500 block">{s.label}</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={s.val}
                        onChange={(e) => s.set(Math.min(99, Math.max(1, parseInt(e.target.value, 10) || 60)))}
                        className="w-full px-2 py-1 rounded border border-sky-200 bg-white font-mono-numbers font-bold"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-bold text-white shadow-sm"
              >
                <Check className="w-4 h-4" /> 선수 등록 완료
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
