/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Award, Shield, Zap, Activity, HeartPulse } from 'lucide-react';
import { Player, Team } from '../types/baseball';

interface PlayerDetailModalProps {
  player: Player | null;
  team?: Team;
  onClose: () => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  team,
  onClose,
}) => {
  if (!player) return null;

  const isBatter = player.role === 'BATTER';
  const bs = player.batterStats;
  const ps = player.pitcherStats;

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-sky-100 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Player Profile Header */}
        <div className="flex items-start gap-4 pb-5 border-b border-sky-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center font-display font-extrabold text-2xl text-white shadow-md">
            {player.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-display font-bold text-slate-900">{player.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                player.potential === 'S'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : player.potential === 'A'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-sky-100 text-sky-800 border border-sky-300'
              }`}>
                잠재력 {player.potential}등급
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span>만 {player.age}세</span>
              <span>·</span>
              <span>포지션: <strong className="text-slate-800">{player.primaryPosition}</strong></span>
              <span>·</span>
              <span className={player.tier === 'FIRST_TEAM' ? 'text-sky-700 font-bold' : 'text-slate-400'}>
                {player.tier === 'FIRST_TEAM' ? '1군 등록 선수' : '2군 육성군'}
              </span>
              <span>·</span>
              <span className="text-sky-700 font-mono-numbers font-semibold">Lv.{player.level}</span>
            </div>
          </div>
        </div>

        {/* Attributes Breakdown */}
        <div className="mt-5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            {isBatter ? '타자 세부 능력치 (1-99)' : '투수 세부 능력치 & 구종'}
          </h4>

          {isBatter && bs ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: '컨택 (Contact)', val: bs.contact, color: 'text-emerald-600' },
                { label: '파워 (Power)', val: bs.power, color: 'text-amber-500' },
                { label: '선구안 (Eye)', val: bs.eye, color: 'text-sky-600' },
                { label: '주력 (Speed)', val: bs.speed, color: 'text-cyan-600' },
                { label: '수비력 (Defense)', val: bs.defense, color: 'text-purple-600' },
                { label: '클러치 (Clutch)', val: bs.clutch, color: 'text-rose-600' },
              ].map(item => (
                <div key={item.label} className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">{item.label}</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-xl font-bold font-mono-numbers ${item.color}`}>{item.val}</span>
                    <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${item.val}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : ps ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                <span className="text-[11px] text-slate-500 block">최고 구속</span>
                <span className="text-xl font-bold font-mono-numbers text-sky-600 block mt-1">
                  {ps.velocity}km/h
                </span>
              </div>
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                <span className="text-[11px] text-slate-500 block">제구력 (Control)</span>
                <span className="text-xl font-bold font-mono-numbers text-slate-800 block mt-1">
                  {ps.control}
                </span>
              </div>
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                <span className="text-[11px] text-slate-500 block">구위 (Stuff)</span>
                <span className="text-xl font-bold font-mono-numbers text-emerald-600 block mt-1">
                  {ps.stuff}
                </span>
              </div>
              <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl">
                <span className="text-[11px] text-slate-500 block">스태미너 (Stamina)</span>
                <span className="text-xl font-bold font-mono-numbers text-rose-600 block mt-1">
                  {ps.stamina}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Season 누적 기록 Table */}
        <div className="mt-5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            26회차 시즌 누적 기록
          </h4>

          {isBatter && bs ? (
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
          ) : ps ? (
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
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-sky-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
