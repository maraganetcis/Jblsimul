/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Edit3, Check, Trash2 } from 'lucide-react';
import { Player, Position, PotentialGrade, Team } from '../types/baseball';

interface PlayerDetailModalProps {
  player: Player | null;
  team?: Team;
  seasonNumber?: number;
  onSavePlayer?: (updatedPlayer: Player) => void;
  onDeletePlayer?: (playerId: string, teamId: string) => void;
  onClose: () => void;
}

const BATTER_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const PITCHER_POSITIONS: Position[] = ['SP', 'RP', 'CP'];
const POTENTIALS: PotentialGrade[] = ['S', 'A', 'B', 'C', 'D'];

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  team,
  seasonNumber = 26,
  onSavePlayer,
  onDeletePlayer,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<Player | null>(null);

  useEffect(() => {
    setDraft(player ? JSON.parse(JSON.stringify(player)) : null);
    setIsEditing(false);
    setConfirmDelete(false);
  }, [player]);

  if (!player || !draft) return null;

  const activePlayer = isEditing ? draft : player;
  const isBatter = activePlayer.role === 'BATTER';
  const bs = activePlayer.batterStats;
  const ps = activePlayer.pitcherStats;

  // 타율, OPS 계산
  const ab = bs?.atBats || 0;
  const h = bs?.hits || 0;
  const hr = bs?.homeRuns || 0;
  const bb = bs?.walks || 0;
  const avg = ab > 0 ? (h / ab).toFixed(3) : '.000';
  const obp = ab + bb > 0 ? ((h + bb) / (ab + bb)).toFixed(3) : '.000';
  const slg = ab > 0 ? ((h + hr * 3) / ab).toFixed(3) : '.000';
  const ops = (parseFloat(obp) + parseFloat(slg)).toFixed(3);

  // 투수 ERA, WHIP 계산
  const ipOuts = ps?.inningsOuts || 0;
  const fullIp = Math.floor(ipOuts / 3);
  const partIp = ipOuts % 3;
  const ipStr = fullIp + (partIp > 0 ? '.' + partIp : '');
  const floatIp = ipOuts / 3;
  const era = floatIp > 0 ? ((ps?.earnedRuns || 0) * 9 / floatIp).toFixed(2) : '0.00';
  const whip = floatIp > 0 ? (((ps?.hitsAllowed || 0) + (ps?.walksAllowed || 0)) / floatIp).toFixed(2) : '0.00';

  const handleSave = () => {
    if (!draft.name.trim()) return;
    if (onSavePlayer) {
      onSavePlayer(draft);
    }
    setIsEditing(false);
  };

  const updateBatterStat = (field: string, value: number) => {
    if (!draft.batterStats) return;
    setDraft({
      ...draft,
      batterStats: {
        ...draft.batterStats,
        [field]: Math.max(0, value),
      },
    });
  };

  const updatePitcherStat = (field: string, value: number) => {
    if (!draft.pitcherStats) return;
    setDraft({
      ...draft,
      pitcherStats: {
        ...draft.pitcherStats,
        [field]: Math.max(0, value),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-sky-100 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl relative">
        {/* Top Action Buttons */}
        <div className="absolute right-5 top-5 flex items-center gap-2">
          {onSavePlayer && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> 이름·포지션·스탯 수정
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Profile Header */}
        <div className="flex items-start gap-4 pb-5 border-b border-sky-100 pr-24">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-extrabold text-2xl text-white shadow-md shrink-0"
            style={{ backgroundColor: team?.color || '#0284C7' }}
          >
            {activePlayer.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="선수 이름"
                    className="px-3 py-1.5 rounded-lg border border-sky-300 text-base font-bold text-slate-900 focus:outline-none focus:border-sky-500 w-40"
                  />
                  <select
                    value={draft.primaryPosition}
                    onChange={(e) => setDraft({ ...draft, primaryPosition: e.target.value as Position })}
                    className="px-2.5 py-1.5 rounded-lg border border-sky-200 text-xs font-bold text-slate-800 bg-sky-50"
                  >
                    {(isBatter ? BATTER_POSITIONS : PITCHER_POSITIONS).map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                  <select
                    value={draft.tier}
                    onChange={(e) => setDraft({ ...draft, tier: e.target.value as 'FIRST_TEAM' | 'SECOND_TEAM' })}
                    className="px-2.5 py-1.5 rounded-lg border border-sky-200 text-xs font-bold text-slate-800 bg-sky-50"
                  >
                    <option value="FIRST_TEAM">1군</option>
                    <option value="SECOND_TEAM">2군</option>
                  </select>
                  <select
                    value={draft.potential}
                    onChange={(e) => setDraft({ ...draft, potential: e.target.value as PotentialGrade })}
                    className="px-2.5 py-1.5 rounded-lg border border-sky-200 text-xs font-bold text-slate-800 bg-sky-50"
                  >
                    {POTENTIALS.map(g => (
                      <option key={g} value={g}>잠재력 {g}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <label className="flex items-center gap-1">
                    나이:
                    <input
                      type="number"
                      min={17}
                      max={45}
                      value={draft.age}
                      onChange={(e) => setDraft({ ...draft, age: parseInt(e.target.value, 10) || 20 })}
                      className="w-14 px-2 py-1 rounded border border-sky-200 text-xs font-mono-numbers"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    레벨:
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={draft.level}
                      onChange={(e) => setDraft({ ...draft, level: parseInt(e.target.value, 10) || 1 })}
                      className="w-14 px-2 py-1 rounded border border-sky-200 text-xs font-mono-numbers"
                    />
                  </label>
                  {team && <span className="text-sky-700 font-semibold">소속: {team.name}</span>}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-display font-bold text-slate-900">{activePlayer.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    activePlayer.potential === 'S'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : activePlayer.potential === 'A'
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : 'bg-sky-100 text-sky-800 border border-sky-300'
                  }`}>
                    잠재력 {activePlayer.potential}등급
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 mt-1">
                  {team && <span className="font-bold text-sky-700">{team.name}</span>}
                  {team && <span>·</span>}
                  <span>만 {activePlayer.age}세</span>
                  <span>·</span>
                  <span>포지션: <strong className="text-slate-800">{activePlayer.primaryPosition}</strong></span>
                  <span>·</span>
                  <span className={activePlayer.tier === 'FIRST_TEAM' ? 'text-sky-700 font-bold' : 'text-slate-400'}>
                    {activePlayer.tier === 'FIRST_TEAM' ? '1군 등록 선수' : '2군 육성군'}
                  </span>
                  <span>·</span>
                  <span className="text-sky-700 font-mono-numbers font-semibold">Lv.{activePlayer.level}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Attributes Breakdown */}
        <div className="mt-5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            {isBatter ? '타자 세부 능력치 (1-99)' : '투수 세부 능력치 & 구속'}
          </h4>

          {isBatter && bs ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'contact', label: '컨택 (Contact)', val: bs.contact, color: 'text-emerald-600' },
                { key: 'power', label: '파워 (Power)', val: bs.power, color: 'text-amber-500' },
                { key: 'eye', label: '선구안 (Eye)', val: bs.eye, color: 'text-sky-600' },
                { key: 'speed', label: '주력 (Speed)', val: bs.speed, color: 'text-cyan-600' },
                { key: 'defense', label: '수비력 (Defense)', val: bs.defense, color: 'text-purple-600' },
                { key: 'clutch', label: '클러치 (Clutch)', val: bs.clutch, color: 'text-rose-600' },
              ].map(item => (
                <div key={item.label} className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">{item.label}</span>
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={item.val}
                      onChange={(e) => updateBatterStat(item.key, Math.min(99, parseInt(e.target.value, 10) || 1))}
                      className="mt-1 w-full px-2.5 py-1 rounded-lg border border-sky-300 bg-white font-mono-numbers font-bold text-base text-slate-900"
                    />
                  ) : (
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`text-xl font-bold font-mono-numbers ${item.color}`}>{item.val}</span>
                      <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full rounded-full" style={{ width: `${Math.min(100, item.val)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : ps ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                <span className="text-[11px] text-slate-500 block">최고 구속</span>
                {isEditing ? (
                  <input
                    type="number"
                    min={120}
                    max={165}
                    value={ps.velocity}
                    onChange={(e) => updatePitcherStat('velocity', Math.min(165, parseInt(e.target.value, 10) || 140))}
                    className="mt-1 w-full px-2 py-1 rounded-lg border border-sky-300 bg-white font-mono-numbers font-bold text-sm text-sky-700"
                  />
                ) : (
                  <span className="text-lg font-bold font-mono-numbers text-sky-600 block mt-1">
                    {ps.velocity}km/h
                  </span>
                )}
              </div>
              {[
                { key: 'control', label: '제구력', val: ps.control, color: 'text-slate-800' },
                { key: 'stuff', label: '구위', val: ps.stuff, color: 'text-emerald-600' },
                { key: 'stamina', label: '체력', val: ps.stamina, color: 'text-rose-600' },
                { key: 'clutch', label: '위기관리', val: ps.clutch, color: 'text-purple-600' },
              ].map(item => (
                <div key={item.key} className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">{item.label}</span>
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={item.val}
                      onChange={(e) => updatePitcherStat(item.key, Math.min(99, parseInt(e.target.value, 10) || 1))}
                      className="mt-1 w-full px-2 py-1 rounded-lg border border-sky-300 bg-white font-mono-numbers font-bold text-sm text-slate-900"
                    />
                  ) : (
                    <span className={`text-lg font-bold font-mono-numbers block mt-1 ${item.color}`}>
                      {item.val}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Season 누적 기록 Table */}
        <div className="mt-5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {seasonNumber}회차 시즌 누적 기록 {isEditing && '(직접 수정 가능)'}
          </h4>

          {isBatter && bs ? (
            isEditing ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-sky-50/60 border border-sky-100 rounded-xl p-3 text-xs">
                {[
                  { key: 'games', label: '경기', val: bs.games },
                  { key: 'atBats', label: '타석', val: bs.atBats },
                  { key: 'hits', label: '안타', val: bs.hits },
                  { key: 'homeRuns', label: '홈런', val: bs.homeRuns },
                  { key: 'rbi', label: '타점', val: bs.rbi },
                  { key: 'stolenBases', label: '도루', val: bs.stolenBases },
                ].map(f => (
                  <label key={f.key} className="block">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{f.label}</span>
                    <input
                      type="number"
                      min={0}
                      value={f.val}
                      onChange={(e) => updateBatterStat(f.key, parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2 py-1 rounded border border-sky-200 bg-white font-mono-numbers font-bold text-slate-800"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto bg-sky-50/60 border border-sky-100 rounded-xl p-3">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center text-xs font-mono-numbers">
                  <div><span className="text-slate-500 block text-[10px]">타석</span><strong className="text-slate-800">{bs.atBats}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">안타</span><strong className="text-slate-800">{bs.hits}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">홈런</span><strong className="text-amber-500">{bs.homeRuns}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">타점</span><strong className="text-slate-800">{bs.rbi}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">도루</span><strong className="text-slate-800">{bs.stolenBases}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">타율</span><strong className="text-emerald-600">{avg}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">출루율</span><strong className="text-slate-700">{obp}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">OPS</span><strong className="text-sky-600">{ops}</strong></div>
                </div>
              </div>
            )
          ) : ps ? (
            isEditing ? (
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 bg-sky-50/60 border border-sky-100 rounded-xl p-3 text-xs">
                {[
                  { key: 'games', label: '경기', val: ps.games },
                  { key: 'inningsOuts', label: '아웃수(3=1이닝)', val: ps.inningsOuts },
                  { key: 'wins', label: '승', val: ps.wins },
                  { key: 'losses', label: '패', val: ps.losses },
                  { key: 'saves', label: '세이브', val: ps.saves },
                  { key: 'strikeouts', label: '탈삼진', val: ps.strikeouts },
                  { key: 'earnedRuns', label: '자책점', val: ps.earnedRuns },
                ].map(f => (
                  <label key={f.key} className="block">
                    <span className="text-[10px] text-slate-500 block mb-0.5">{f.label}</span>
                    <input
                      type="number"
                      min={0}
                      value={f.val}
                      onChange={(e) => updatePitcherStat(f.key, parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2 py-1 rounded border border-sky-200 bg-white font-mono-numbers font-bold text-slate-800"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto bg-sky-50/60 border border-sky-100 rounded-xl p-3">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center text-xs font-mono-numbers">
                  <div><span className="text-slate-500 block text-[10px]">경기</span><strong className="text-slate-800">{ps.games}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">이닝</span><strong className="text-slate-800">{ipStr}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">승</span><strong className="text-emerald-600">{ps.wins}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">패</span><strong className="text-rose-500">{ps.losses}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">세이브</span><strong className="text-amber-500">{ps.saves}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">탈삼진</span><strong className="text-purple-600">{ps.strikeouts}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">ERA</span><strong className="text-sky-600">{era}</strong></div>
                  <div><span className="text-slate-500 block text-[10px]">WHIP</span><strong className="text-slate-700">{whip}</strong></div>
                </div>
              </div>
            )
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-sky-100 flex items-center justify-between gap-2">
          <div>
            {isEditing && onDeletePlayer && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600 font-bold">정말 삭제할까요?</span>
                  <button
                    onClick={() => {
                      onDeletePlayer(player.id, player.teamId);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                  >
                    삭제 확정
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 선수 방출/삭제
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setDraft(JSON.parse(JSON.stringify(player)));
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                >
                  수정 취소
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs font-bold text-white shadow-sm transition-colors"
                >
                  <Check className="w-4 h-4" /> 저장 완료
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
