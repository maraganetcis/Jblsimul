/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Dumbbell, Building, CheckCircle, AlertTriangle, Sparkles, PlayCircle, Users } from 'lucide-react';
import { AutoGrowthLog, Player, Team } from '../types/baseball';
import { soundEffects } from '../utils/audio';

interface TrainingViewProps {
  userTeam: Team;
  roster: Player[];
  autoTrainingEnabled: boolean;
  onToggleAutoTraining: () => void;
  onRunLeagueAutoTraining: () => void;
  growthLogs: AutoGrowthLog[];
  onUpdateTeam: (team: Team) => void;
  onUpdateRoster: (roster: Player[]) => void;
  onOpenPlayerDetail: (player: Player) => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  userTeam,
  roster,
  autoTrainingEnabled,
  onToggleAutoTraining,
  onRunLeagueAutoTraining,
  growthLogs,
  onUpdateTeam,
  onUpdateRoster,
  onOpenPlayerDetail,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(roster[0]?.id || '');
  const [trainToast, setTrainToast] = useState<{ type: 'SUCCESS' | 'ERROR'; text: string } | null>(null);
  const [showOnlyMyTeamLogs, setShowOnlyMyTeamLogs] = useState<boolean>(false);

  const selectedPlayer = roster.find(p => p.id === selectedPlayerId) || roster[0];

  const showToast = (type: 'SUCCESS' | 'ERROR', text: string) => {
    setTrainToast({ type, text });
    setTimeout(() => setTrainToast(null), 3000);
  };

  // 구단 훈련 시설 업그레이드
  const handleUpgradeFacility = (key: keyof Team['facilityLevels']) => {
    const currentLvl = userTeam.facilityLevels[key];
    const cost = (currentLvl + 1) * 30000; // 3억원, 6억원...
    if (userTeam.budget < cost) {
      showToast('ERROR', `구단 예산이 부족합니다! (필요 자금: ${(cost / 10000).toLocaleString()}억원)`);
      return;
    }

    const updatedTeam: Team = {
      ...userTeam,
      budget: userTeam.budget - cost,
      facilityLevels: {
        ...userTeam.facilityLevels,
        [key]: currentLvl + 1,
      },
    };
    onUpdateTeam(updatedTeam);
    soundEffects.playCrowdCheer(false);
    showToast('SUCCESS', `시설 업그레이드 완료! (레벨 ${currentLvl + 1})`);
  };

  // 선수 개별 특훈 실행
  const handleTrainPlayer = (statKey: string, boostAmount: number, cost: number) => {
    if (!selectedPlayer) return;
    if (userTeam.budget < cost) {
      showToast('ERROR', `훈련 비용이 부족합니다! (필요 자금: ${(cost / 10000).toLocaleString()}억원)`);
      return;
    }

    const updatedRoster = roster.map(p => {
      if (p.id !== selectedPlayer.id) return p;

      const updatedPlayer = { ...p, exp: p.exp + 100 };
      if (updatedPlayer.exp >= 200) {
        updatedPlayer.level += 1;
        updatedPlayer.exp = 0;
      }

      if (p.role === 'BATTER' && updatedPlayer.batterStats) {
        const bs = { ...updatedPlayer.batterStats };
        if (statKey in bs) {
          (bs as Record<string, number>)[statKey] = Math.min(99, (bs as Record<string, number>)[statKey] + boostAmount);
        }
        updatedPlayer.batterStats = bs;
      } else if (p.role === 'PITCHER' && updatedPlayer.pitcherStats) {
        const ps = { ...updatedPlayer.pitcherStats };
        if (statKey === 'velocity') {
          ps.velocity = Math.min(162, ps.velocity + 1);
        } else if (statKey === 'control') {
          ps.control = Math.min(99, ps.control + boostAmount);
        } else if (statKey === 'stuff') {
          ps.stuff = Math.min(99, ps.stuff + boostAmount);
        } else if (statKey === 'stamina') {
          ps.stamina = Math.min(99, ps.stamina + boostAmount);
        }
        updatedPlayer.pitcherStats = ps;
      }

      return updatedPlayer;
    });

    const updatedTeam = {
      ...userTeam,
      budget: userTeam.budget - cost,
    };

    onUpdateTeam(updatedTeam);
    onUpdateRoster(updatedRoster);
    soundEffects.playBatHit(false, 80);
    showToast('SUCCESS', `${selectedPlayer.name} 선수의 특훈 완료! 능력치가 상승했습니다.`);
  };

  const visibleLogs = showOnlyMyTeamLogs
    ? growthLogs.filter(g => g.teamId === userTeam.id)
    : growthLogs;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {trainToast && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm border ${
            trainToast.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {trainToast.type === 'SUCCESS' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          {trainToast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-sky-600" /> 전 구단 자동 육성 & 클럽 하우스 트레이닝 센터
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            모든 10개 구단(1군·2군)의 선수들이 잠재력·나이·훈련 시설에 따라 매일 자동으로 경험치를 얻고 레벨업하며 성장합니다.
          </p>
        </div>
        <div className="bg-sky-50 px-4 py-2 rounded-xl border border-sky-200 text-right">
          <span className="text-[11px] text-slate-500 block">구단 보유 자금</span>
          <span className="text-base font-mono-numbers font-bold text-sky-700">
            {(userTeam.budget / 10000).toLocaleString()} 억원
          </span>
        </div>
      </div>

      {/* Auto-Development Control & League Growth Feed */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> 전 10개 구단 선수 자동 육성 엔진
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              경기 종료 시마다 모든 구단 선수들이 자동 훈련을 수행하며, 급성장한 2군 유망주는 알림창으로 1군 콜업 결재를 요청합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onToggleAutoTraining}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                autoTrainingEnabled
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
            >
              자동 육성: {autoTrainingEnabled ? 'ON (매일 자동 실행)' : 'OFF (수동)'}
            </button>
            <button
              onClick={() => {
                onRunLeagueAutoTraining();
                soundEffects.playCrowdCheer(false);
                showToast('SUCCESS', '전 10개 구단 선수단 1일 자동 육성 캠프가 완료되었습니다!');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5" /> 전 구단 1일 자동 육성 즉시 실행
            </button>
          </div>
        </div>

        {/* Growth Logs */}
        <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-600" /> 최근 자동 레벨업 · 능력치 성장 리포트 ({visibleLogs.length}건)
            </span>
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-sky-200 text-[11px]">
              <button
                onClick={() => setShowOnlyMyTeamLogs(false)}
                className={`px-2 py-0.5 rounded font-semibold ${!showOnlyMyTeamLogs ? 'bg-sky-500 text-white' : 'text-slate-600'}`}
              >
                전체 구단
              </button>
              <button
                onClick={() => setShowOnlyMyTeamLogs(true)}
                className={`px-2 py-0.5 rounded font-semibold ${showOnlyMyTeamLogs ? 'bg-sky-500 text-white' : 'text-slate-600'}`}
              >
                {userTeam.name}만
              </button>
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1.5">
            {visibleLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                아직 레벨업 기록이 없습니다. 경기를 진행하거나 위 [전 구단 1일 자동 육성 즉시 실행]을 눌러보세요!
              </p>
            ) : (
              visibleLogs.slice(0, 30).map(log => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-sky-100 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-numbers text-slate-400">
                      {log.seasonNumber}회 {log.day}일
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 font-bold text-[10px] border border-sky-200">
                      {log.teamName}
                    </span>
                    <span className="font-bold text-slate-900">{log.playerName}</span>
                    <span className="text-[11px] text-slate-500">({log.position})</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono-numbers">
                    <span className="text-amber-600 font-bold">Lv.{log.newLevel} 달성</span>
                    <span className="text-emerald-600 font-bold">{log.statGainText}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 1. Facility Upgrades */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
          <Building className="w-4 h-4 text-sky-600" /> 구단 훈련 인프라 시설
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Batting Facility */}
          <div className="bg-sky-50/60 border border-sky-100 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">타격 훈련장</span>
                <span className="text-xs font-bold text-sky-700 font-mono-numbers">
                  Lv.{userTeam.facilityLevels.battingCage}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">타자들의 컨택 및 파워 성장 효율 +15%</p>
            </div>
            <button
              onClick={() => handleUpgradeFacility('battingCage')}
              className="mt-4 w-full py-1.5 rounded-lg bg-white hover:bg-sky-50 text-xs text-sky-700 font-bold border border-sky-200 shadow-sm transition-colors"
            >
              업그레이드 ({(userTeam.facilityLevels.battingCage + 1) * 3}천만원)
            </button>
          </div>

          {/* Pitching Lab */}
          <div className="bg-sky-50/60 border border-sky-100 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">투구 분석 랩</span>
                <span className="text-xs font-bold text-sky-700 font-mono-numbers">
                  Lv.{userTeam.facilityLevels.pitchingLab}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">투수 최고 구속 및 제구력 성장 효율 +15%</p>
            </div>
            <button
              onClick={() => handleUpgradeFacility('pitchingLab')}
              className="mt-4 w-full py-1.5 rounded-lg bg-white hover:bg-sky-50 text-xs text-sky-700 font-bold border border-sky-200 shadow-sm transition-colors"
            >
              업그레이드 ({(userTeam.facilityLevels.pitchingLab + 1) * 3}천만원)
            </button>
          </div>

          {/* Weight Room */}
          <div className="bg-sky-50/60 border border-sky-100 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">웨이트 트레이닝장</span>
                <span className="text-xs font-bold text-sky-700 font-mono-numbers">
                  Lv.{userTeam.facilityLevels.weightRoom}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">전 선수단 체력 소모 감소 및 경기력 향상</p>
            </div>
            <button
              onClick={() => handleUpgradeFacility('weightRoom')}
              className="mt-4 w-full py-1.5 rounded-lg bg-white hover:bg-sky-50 text-xs text-sky-700 font-bold border border-sky-200 shadow-sm transition-colors"
            >
              업그레이드 ({(userTeam.facilityLevels.weightRoom + 1) * 3}천만원)
            </button>
          </div>

          {/* Medical Center */}
          <div className="bg-sky-50/60 border border-sky-100 p-4 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">메디컬 센터</span>
                <span className="text-xs font-bold text-sky-700 font-mono-numbers">
                  Lv.{userTeam.facilityLevels.medicalCenter}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">선수 부상 위험 감소 및 빠른 컨디션 회복</p>
            </div>
            <button
              onClick={() => handleUpgradeFacility('medicalCenter')}
              className="mt-4 w-full py-1.5 rounded-lg bg-white hover:bg-sky-50 text-xs text-sky-700 font-bold border border-sky-200 shadow-sm transition-colors"
            >
              업그레이드 ({(userTeam.facilityLevels.medicalCenter + 1) * 3}천만원)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Individual Player Special Training */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Player Selector (Col 4) */}
        <div className="lg:col-span-4 bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
          <h3 className="font-display font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">
            훈련 대상 선수 선택
          </h3>
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {roster.map(p => {
              const isSelected = p.id === selectedPlayer.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={`p-2.5 rounded-xl cursor-pointer border flex items-center justify-between text-xs transition-all ${
                    isSelected
                      ? 'bg-sky-100/70 border-sky-400 text-sky-900 font-bold shadow-sm'
                      : 'bg-white hover:bg-sky-50/50 border-sky-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[10px] text-sky-800 font-semibold border border-sky-200">
                      {p.primaryPosition}
                    </span>
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-400">Lv.{p.level}</span>
                  </div>
                  <span className={`font-mono-numbers font-bold ${p.potential === 'S' ? 'text-amber-500' : p.potential === 'A' ? 'text-purple-600' : 'text-slate-500'}`}>
                    {p.potential}급
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Player Detail & Training Program Options (Col 8) */}
        <div className="lg:col-span-8 bg-white border border-sky-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between pb-4 border-b border-sky-100">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-display font-bold text-slate-900">{selectedPlayer.name}</h3>
                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold">
                  {selectedPlayer.primaryPosition} · 잠재력 {selectedPlayer.potential}등급
                </span>
                <span className="text-xs text-slate-500 font-mono-numbers">
                  레벨 {selectedPlayer.level} ({selectedPlayer.exp} / 200 EXP)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                만 {selectedPlayer.age}세 · {selectedPlayer.tier === 'FIRST_TEAM' ? '1군 등록' : '2군 육성군'}
              </p>
            </div>
            <button
              onClick={() => onOpenPlayerDetail(selectedPlayer)}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
            >
              상세 기록 보기 &rarr;
            </button>
          </div>

          {/* Training Programs */}
          <div className="mt-5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              맞춤형 개별 특훈 프로그램
            </h4>

            {selectedPlayer.role === 'BATTER' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">타격 밸런스 & 컨택 특훈</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 컨택: {selectedPlayer.batterStats?.contact} &rarr; +2
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('contact', 2, 5000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (5천만원)
                  </button>
                </div>

                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">장타력 & 파워 증강</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 파워: {selectedPlayer.batterStats?.power} &rarr; +2
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('power', 2, 5000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (5천만원)
                  </button>
                </div>

                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">선구안 & 볼 카운트 집중</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 선구안: {selectedPlayer.batterStats?.eye} &rarr; +2
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('eye', 2, 4000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (4천만원)
                  </button>
                </div>

                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">주루 스피드 & 도루 스타트</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 주력: {selectedPlayer.batterStats?.speed} &rarr; +2
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('speed', 2, 4000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (4천만원)
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">구속 파이어볼러 증속</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      최고구속: {selectedPlayer.pitcherStats?.velocity}km/h &rarr; +1km/h
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('velocity', 1, 6000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (6천만원)
                  </button>
                </div>

                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">커맨드 & 칼날 제구력 연마</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 제구: {selectedPlayer.pitcherStats?.control} &rarr; +2
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('control', 2, 5000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (5천만원)
                  </button>
                </div>

                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">탈삼진 마구 & 구위 강화</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 구위: {selectedPlayer.pitcherStats?.stuff} &rarr; +2
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('stuff', 2, 5000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (5천만원)
                  </button>
                </div>

                <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">완투형 선발 스태미너 러닝</span>
                    <span className="text-xs text-slate-500 font-mono-numbers">
                      현재 체력: {selectedPlayer.pitcherStats?.stamina} &rarr; +3
                    </span>
                  </div>
                  <button
                    onClick={() => handleTrainPlayer('stamina', 3, 4000)}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    특훈 (4천만원)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
