/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Trophy, Shield, MapPin, Building, CheckCircle } from 'lucide-react';
import { Team } from '../types/baseball';

interface TeamSelectorModalProps {
  isOpen: boolean;
  teams: Team[];
  selectedTeamId: string;
  onSelectTeam: (teamId: string) => void;
  onClose?: () => void;
}

export const TeamSelectorModal: React.FC<TeamSelectorModalProps> = ({
  isOpen,
  teams,
  selectedTeamId,
  onSelectTeam,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-sky-100 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-sky-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-sky-700 font-bold">JBL League Franchise Selection</span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-slate-900 mt-1">
              지휘할 JBL 프로야구 구단을 선택하세요
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              25시즌 역사의 명문 구단부터 디펜딩 챔피언까지 10개 구단 중 하나를 맡아 26회차 시즌 왕좌에 도전하세요.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="self-end sm:self-auto text-slate-500 hover:text-slate-800 px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 text-xs font-semibold transition-colors shrink-0"
            >
              닫기
            </button>
          )}
        </div>

        {/* Teams Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 bg-slate-50/40">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            return (
              <div
                key={team.id}
                onClick={() => onSelectTeam(team.id)}
                className={`cursor-pointer rounded-xl p-4 border transition-all relative ${
                  isSelected
                    ? 'bg-sky-50/90 border-sky-500 shadow-md ring-1 ring-sky-500/50'
                    : 'bg-white hover:bg-sky-50/50 border-sky-100 hover:border-sky-300 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-display font-black text-lg shadow"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.logoInitial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-base text-slate-900">{team.name}</h3>
                        {team.id === 'team_jinu' && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-bold">
                            디펜딩 챔피언
                          </span>
                        )}
                        {team.championships >= 5 && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                            최다 우승 ({team.championships}회)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 font-sans">
                          <Building className="w-3.5 h-3.5 text-slate-400" /> {team.owner}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-sans">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {team.homeStadium}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <CheckCircle className="w-5 h-5 text-sky-600 shrink-0" />
                  )}
                </div>

                <div className="mt-3.5 pt-3 border-t border-sky-100 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-sky-50/60 p-2 rounded-lg">
                    <span className="text-slate-500 text-[10px] block">역대 우승</span>
                    <span className="font-mono-numbers font-bold text-amber-600 text-sm flex items-center gap-1 mt-0.5">
                      <Trophy className="w-3.5 h-3.5 inline text-amber-500" /> {team.championships}회
                    </span>
                  </div>
                  <div className="bg-sky-50/60 p-2 rounded-lg">
                    <span className="text-slate-500 text-[10px] block">창단년도</span>
                    <span className="font-mono-numbers font-bold text-slate-800 text-sm block mt-0.5">
                      {team.foundedYear}년차
                    </span>
                  </div>
                  <div className="bg-sky-50/60 p-2 rounded-lg">
                    <span className="text-slate-500 text-[10px] block">초기 구단 자금</span>
                    <span className="font-mono-numbers font-bold text-sky-700 text-sm block mt-0.5">
                      {(team.budget / 10000).toFixed(0)}억원
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-sky-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            선택된 구단으로 시즌을 진행하며 트레이드, 드래프트, 스프레드시트 연동이 활성화됩니다.
          </span>
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-colors shrink-0"
          >
            선택 완료하고 시작하기
          </button>
        </div>
      </div>
    </div>
  );
};
