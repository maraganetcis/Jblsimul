/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, FastForward, SkipForward, ChevronRight, Volume2, Shield, Users, Award, RotateCcw, Crosshair, ArrowDownCircle } from 'lucide-react';
import { LiveGameState, Player, Team } from '../types/baseball';
import { simulateNextPitch, simulateFullPlateAppearance, simulateHalfInning, simulateUntilGameFinish, TacticChoice } from '../utils/simulationEngine';
import confetti from 'canvas-confetti';

interface LiveGameViewProps {
  gameState: LiveGameState;
  onUpdateGameState: (nextState: LiveGameState) => void;
  onFinishGame: (finalState: LiveGameState) => void;
  userTeam: Team;
  allRoster: Player[];
}

export const LiveGameView: React.FC<LiveGameViewProps> = ({
  gameState,
  onUpdateGameState,
  onFinishGame,
  userTeam,
  allRoster,
}) => {
  const [autoPlaySpeed, setAutoPlaySpeed] = useState<number | null>(null); // null = paused/manual, 900 = 1x, 400 = 2x, 120 = 5x
  const [pendingTactic, setPendingTactic] = useState<TacticChoice>('NORMAL');
  const [showPitcherSubModal, setShowPitcherSubModal] = useState(false);
  const [showBatterSubModal, setShowBatterSubModal] = useState(false);
  const [autoScrollFeed, setAutoScrollFeed] = useState(true);

  // Internal log container ref (never moves window scroll)
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto play effect loop
  useEffect(() => {
    if (!autoPlaySpeed || gameState.isFinished) return;

    const timer = setInterval(() => {
      onUpdateGameState(simulateNextPitch(gameState, pendingTactic));
      if (pendingTactic !== 'NORMAL') setPendingTactic('NORMAL');
    }, autoPlaySpeed);

    return () => clearInterval(timer);
  }, [autoPlaySpeed, gameState, pendingTactic, onUpdateGameState]);

  // Smooth internal-only scroll for the relay feed (NEVER scrolls whole window)
  useEffect(() => {
    if (autoScrollFeed && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [gameState.playLogs, autoScrollFeed]);

  // Finish celebration
  useEffect(() => {
    if (gameState.isFinished && gameState.winningTeamId === userTeam.id) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [gameState.isFinished, gameState.winningTeamId, userTeam.id]);

  const handleNextPitch = (tactic: TacticChoice = pendingTactic) => {
    if (gameState.isFinished) return;
    const next = simulateNextPitch(gameState, tactic);
    onUpdateGameState(next);
    if (pendingTactic !== 'NORMAL') setPendingTactic('NORMAL');
  };

  const handleNextBatter = () => {
    if (gameState.isFinished) return;
    const next = simulateFullPlateAppearance(gameState, pendingTactic);
    onUpdateGameState(next);
    if (pendingTactic !== 'NORMAL') setPendingTactic('NORMAL');
  };

  const handleSkipInning = () => {
    if (gameState.isFinished) return;
    const next = simulateHalfInning(gameState);
    onUpdateGameState(next);
  };

  const handleSkipToEnd = () => {
    if (gameState.isFinished) return;
    const next = simulateUntilGameFinish(gameState);
    onUpdateGameState(next);
  };

  // Sub pitcher / batter
  const handleSubstitutePitcher = (pitcher: Player) => {
    const updated = { ...gameState };
    if (gameState.isTop) {
      updated.currentPitcherHome = pitcher;
      updated.pitchCountHome = 0;
    } else {
      updated.currentPitcherAway = pitcher;
      updated.pitchCountAway = 0;
    }
    updated.playLogs = [
      {
        id: `sub_p_${Date.now()}`,
        inning: gameState.inning,
        isTop: gameState.isTop,
        batterName: '',
        pitcherName: pitcher.name,
        balls: gameState.balls,
        strikes: gameState.strikes,
        outs: gameState.outs,
        description: `🔄 투수 교체! 마운드에 새로운 투수 ${pitcher.name}(${pitcher.pitcherStats?.velocity}km/h) 선수가 등판합니다.`,
        highlightType: 'TACTIC',
      },
      ...gameState.playLogs,
    ];
    onUpdateGameState(updated);
    setShowPitcherSubModal(false);
  };

  const currentBatter = gameState.isTop
    ? gameState.battingOrderAway[gameState.orderIndexAway % gameState.battingOrderAway.length]
    : gameState.battingOrderHome[gameState.orderIndexHome % gameState.battingOrderHome.length];
  const currentPitcher = gameState.isTop ? gameState.currentPitcherHome : gameState.currentPitcherAway;

  // Inning columns (1 to 9 + any extra)
  const totalInnings = Math.max(9, gameState.inning);
  const inningArray = Array.from({ length: totalInnings }, (_, i) => i + 1);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Main Electronic Scoreboard (R-H-E) */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-2xl overflow-hidden shadow-md border border-sky-900/60">
        <div className="bg-slate-950/70 px-4 py-3 border-b border-sky-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-display font-bold text-sky-200 tracking-wider">
              {gameState.isFinished ? '경기 종료 (FINAL)' : `${gameState.inning}회${gameState.isTop ? '초' : '말'} LIVE`}
            </span>
            <span className="text-xs text-sky-400/50">|</span>
            <span className="text-xs text-sky-200/80">{gameState.homeTeam.homeStadium}</span>
          </div>

          {/* B-S-O Lamp Cluster */}
          <div className="flex items-center gap-4 text-xs font-mono-numbers bg-slate-950/80 px-3 py-1 rounded-lg border border-sky-900/60">
            <div className="flex items-center gap-1.5">
              <span className="text-sky-300 font-bold">B</span>
              <div className="flex gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.balls >= 1 ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-800'}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.balls >= 2 ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-800'}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.balls >= 3 ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-800'}`} />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-amber-300 font-bold">S</span>
              <div className="flex gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.strikes >= 1 ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-slate-800'}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.strikes >= 2 ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-slate-800'}`} />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-rose-300 font-bold">O</span>
              <div className="flex gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.outs >= 1 ? 'bg-rose-500 shadow-sm shadow-rose-500' : 'bg-slate-800'}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${gameState.outs >= 2 ? 'bg-rose-500 shadow-sm shadow-rose-500' : 'bg-slate-800'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Inning Table */}
        <div className="overflow-x-auto p-4">
          <table className="w-full text-center text-xs font-mono-numbers">
            <thead>
              <tr className="text-sky-300/80 border-b border-sky-800/40">
                <th className="text-left font-display font-semibold py-2 px-3 text-sky-100 w-36">구단명</th>
                {inningArray.map((inn) => (
                  <th
                    key={inn}
                    className={`py-2 px-2 w-8 ${gameState.inning === inn && !gameState.isFinished ? 'text-amber-400 font-bold' : ''}`}
                  >
                    {inn}
                  </th>
                ))}
                <th className="py-2 px-3 text-amber-400 font-bold border-l border-sky-800/60 w-10">R</th>
                <th className="py-2 px-2 text-sky-200 w-8">H</th>
                <th className="py-2 px-2 text-sky-300 w-8">E</th>
              </tr>
            </thead>
            <tbody>
              {/* Away Team Row */}
              <tr className={`border-b border-sky-900/40 ${gameState.isTop && !gameState.isFinished ? 'bg-sky-900/20' : ''}`}>
                <td className="text-left py-2 px-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: gameState.awayTeam.color }} />
                  <span className="font-semibold text-white">{gameState.awayTeam.name}</span>
                  {gameState.isTop && !gameState.isFinished && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded">공격</span>
                  )}
                </td>
                {inningArray.map((inn) => {
                  const score = gameState.inningScores.away[inn - 1];
                  return (
                    <td key={inn} className="py-2 px-2 text-sky-100">
                      {score !== undefined ? score : '-'}
                    </td>
                  );
                })}
                <td className="py-2 px-3 font-bold text-amber-400 text-sm border-l border-sky-800/60 bg-black/30">
                  {gameState.score.away}
                </td>
                <td className="py-2 px-2 text-sky-200">{gameState.hits.away}</td>
                <td className="py-2 px-2 text-sky-300/80">{gameState.errors.away}</td>
              </tr>

              {/* Home Team Row */}
              <tr className={`${!gameState.isTop && !gameState.isFinished ? 'bg-sky-900/20' : ''}`}>
                <td className="text-left py-2 px-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: gameState.homeTeam.color }} />
                  <span className="font-semibold text-white">{gameState.homeTeam.name}</span>
                  {!gameState.isTop && !gameState.isFinished && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded">공격</span>
                  )}
                </td>
                {inningArray.map((inn) => {
                  const score = gameState.inningScores.home[inn - 1];
                  return (
                    <td key={inn} className="py-2 px-2 text-sky-100">
                      {score !== undefined ? score : '-'}
                    </td>
                  );
                })}
                <td className="py-2 px-3 font-bold text-amber-400 text-sm border-l border-sky-800/60 bg-black/30">
                  {gameState.score.home}
                </td>
                <td className="py-2 px-2 text-sky-200">{gameState.hits.home}</td>
                <td className="py-2 px-2 text-sky-300/80">{gameState.errors.home}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Middle Center: 3-Column Split (Matchup Card / Diamond Radar / Strike Zone) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Matchup & Current Players Card (Col 4) */}
        <div className="lg:col-span-4 bg-white border border-sky-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-sky-100 mb-3">
              <span className="text-xs font-bold text-slate-500">현재 투타 매치업</span>
              <span className="text-xs text-sky-600 font-mono-numbers font-semibold">
                투구수: {gameState.isTop ? gameState.pitchCountHome : gameState.pitchCountAway}구
              </span>
            </div>

            {/* Pitcher Info */}
            <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-100 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider block">투수 (PITCHER)</span>
                  <span className="text-base font-bold text-slate-900">{currentPitcher.name}</span>
                  <span className="text-xs text-slate-500 ml-2">보직: {currentPitcher.primaryPosition}</span>
                </div>
                <div className="text-right font-mono-numbers">
                  <span className="text-sm font-extrabold text-sky-600">{currentPitcher.pitcherStats?.velocity}km/h</span>
                  <span className="text-xs text-slate-500 block">제구 {currentPitcher.pitcherStats?.control} · 구위 {currentPitcher.pitcherStats?.stuff}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                <span>체력</span>
                <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.max(10, 100 - (gameState.isTop ? gameState.pitchCountHome : gameState.pitchCountAway) * 1.1)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Batter Info */}
            <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">타자 (BATTER)</span>
                  <span className="text-base font-bold text-slate-900">{currentBatter.name}</span>
                  <span className="text-xs text-slate-500 ml-2">포지션: {currentBatter.primaryPosition}</span>
                </div>
                <div className="text-right font-mono-numbers">
                  <span className="text-sm font-extrabold text-emerald-600">
                    컨택 {currentBatter.batterStats?.contact}
                  </span>
                  <span className="text-xs text-slate-500 block">파워 {currentBatter.batterStats?.power} · 선구 {currentBatter.batterStats?.eye}</span>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-600 font-mono-numbers flex justify-between">
                <span>시즌 기록</span>
                <span>{currentBatter.batterStats?.hits || 0}안타 {currentBatter.batterStats?.homeRuns || 0}홈런</span>
              </div>
            </div>
          </div>

          {/* Tactical Substitution Buttons */}
          <div className="mt-3 pt-3 border-t border-sky-100 flex items-center gap-2">
            <button
              onClick={() => setShowPitcherSubModal(true)}
              className="flex-1 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-200 transition-colors"
            >
              투수 교체
            </button>
            <button
              onClick={() => setShowBatterSubModal(true)}
              className="flex-1 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold border border-sky-200 transition-colors"
            >
              대타 기용
            </button>
          </div>
        </div>

        {/* 2D Ballpark Diamond Radar (Col 4) */}
        <div className="lg:col-span-4 bg-white border border-sky-100 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden min-h-[260px] shadow-sm">
          {/* Turf SVG Background */}
          <div className="relative w-56 h-56 flex items-center justify-center">
            {/* Field Arc & Dirt Diamond */}
            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow">
              {/* Outfield Grass Sector */}
              <path
                d="M 10 100 A 90 90 0 0 1 190 100 L 100 190 Z"
                fill="#16A34A"
                stroke="#15803D"
                strokeWidth="2"
              />
              {/* Infield Dirt Circle/Diamond */}
              <circle cx="100" cy="120" r="50" fill="#D97706" opacity="0.85" />
              {/* Base Path Lines */}
              <path
                d="M 100 170 L 150 120 L 100 70 L 50 120 Z"
                fill="#22C55E"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeDasharray="2 2"
              />
              {/* Pitcher Mound */}
              <circle cx="100" cy="120" r="8" fill="#B45309" stroke="#FEF3C7" strokeWidth="1.5" />
              <rect x="96" y="118" width="8" height="3" fill="#FFFFFF" />

              {/* Home Plate */}
              <polygon points="100,172 105,167 105,163 95,163 95,167" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1" />
            </svg>

            {/* 1st Base Runner */}
            <div
              className={`absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 rounded rotate-45 border-2 flex items-center justify-center transition-all ${
                gameState.bases.first ? 'bg-amber-400 border-white shadow-lg shadow-amber-400/80 scale-110' : 'bg-slate-200 border-slate-400'
              }`}
              title={gameState.bases.first ? `1루 주자: ${gameState.bases.first.name}` : '1루 비어있음'}
            >
              {gameState.bases.first && <span className="-rotate-45 text-[9px] font-bold text-slate-950">1</span>}
            </div>

            {/* 2nd Base Runner */}
            <div
              className={`absolute top-6 left-1/2 -translate-x-1/2 w-6 h-6 rounded rotate-45 border-2 flex items-center justify-center transition-all ${
                gameState.bases.second ? 'bg-amber-400 border-white shadow-lg shadow-amber-400/80 scale-110' : 'bg-slate-200 border-slate-400'
              }`}
              title={gameState.bases.second ? `2루 주자: ${gameState.bases.second.name}` : '2루 비어있음'}
            >
              {gameState.bases.second && <span className="-rotate-45 text-[9px] font-bold text-slate-950">2</span>}
            </div>

            {/* 3rd Base Runner */}
            <div
              className={`absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 rounded rotate-45 border-2 flex items-center justify-center transition-all ${
                gameState.bases.third ? 'bg-amber-400 border-white shadow-lg shadow-amber-400/80 scale-110' : 'bg-slate-200 border-slate-400'
              }`}
              title={gameState.bases.third ? `3루 주자: ${gameState.bases.third.name}` : '3루 비어있음'}
            >
              {gameState.bases.third && <span className="-rotate-45 text-[9px] font-bold text-slate-950">3</span>}
            </div>
          </div>

          {/* Runners Status Label */}
          <div className="mt-2 text-xs font-semibold text-slate-700 text-center">
            {gameState.bases.first && gameState.bases.second && gameState.bases.third ? (
              <span className="text-amber-600 font-bold animate-pulse">🔥 만루 찬스! (Bases Loaded)</span>
            ) : gameState.bases.second || gameState.bases.third ? (
              <span className="text-sky-700 font-bold">득점권 주자 위치</span>
            ) : gameState.bases.first ? (
              <span>1루 주자: {gameState.bases.first.name}</span>
            ) : (
              <span className="text-slate-400">주자 없음</span>
            )}
          </div>
        </div>

        {/* 9-Split Strike Zone & Pitch Speed Radar (Col 4) */}
        <div className="lg:col-span-4 bg-white border border-sky-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-sky-100 mb-3">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-sky-600" /> 스트라이크 존 궤적
              </span>
              {gameState.lastPitch && (
                <span className="text-xs font-mono-numbers text-sky-600 font-bold">
                  {gameState.lastPitch.velocity}km/h {gameState.lastPitch.pitchType}
                </span>
              )}
            </div>

            {/* 3x3 Strike Zone Grid */}
            <div className="w-44 h-44 mx-auto grid grid-cols-3 grid-rows-3 gap-1 p-2 bg-slate-100 rounded-xl border-2 border-slate-300 relative shadow-inner">
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => {
                  const isCurrentBallLocation =
                    gameState.lastPitch &&
                    gameState.lastPitch.zoneRow === r &&
                    gameState.lastPitch.zoneCol === c;

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`rounded flex items-center justify-center transition-colors relative ${
                        isCurrentBallLocation
                          ? gameState.lastPitch?.call === 'BALL'
                            ? 'bg-emerald-100 border border-emerald-500'
                            : 'bg-rose-100 border border-rose-500'
                          : 'bg-white hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      {isCurrentBallLocation && (
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md animate-ping ${
                            gameState.lastPitch?.call === 'BALL' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                          }`}
                        >
                          ●
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 text-center text-xs text-slate-500">
            {gameState.lastPitch ? (
              <span className="font-semibold text-slate-800">
                마지막 투구: <strong className="text-sky-600">{gameState.lastPitch.outcomeDetail}</strong>
              </span>
            ) : (
              <span className="text-slate-400">투구 대기 중...</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Tactical Action & Fast Simulation Control Bar */}
      <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Primary Pitch Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNextPitch()}
              disabled={gameState.isFinished}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              1구 진행 (Next Pitch)
            </button>

            <button
              onClick={handleNextBatter}
              disabled={gameState.isFinished}
              className="px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 disabled:opacity-40 text-sky-800 font-semibold text-xs border border-sky-200 transition-colors"
            >
              1타석 완료
            </button>

            <button
              onClick={handleSkipInning}
              disabled={gameState.isFinished}
              className="px-3.5 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 disabled:opacity-40 text-sky-700 text-xs border border-sky-200 transition-colors"
            >
              이닝 넘기기
            </button>

            <button
              onClick={handleSkipToEnd}
              disabled={gameState.isFinished}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 text-xs border border-slate-200 transition-colors"
            >
              경기 종료 스킵
            </button>
          </div>

          {/* Speed Selector (1x, 2x, 5x, 수동) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 px-2 font-medium">자동 배속:</span>
            <button
              onClick={() => setAutoPlaySpeed(null)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                autoPlaySpeed === null ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              수동
            </button>
            <button
              onClick={() => setAutoPlaySpeed(900)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                autoPlaySpeed === 900 ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1x
            </button>
            <button
              onClick={() => setAutoPlaySpeed(400)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                autoPlaySpeed === 400 ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2x
            </button>
            <button
              onClick={() => setAutoPlaySpeed(120)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                autoPlaySpeed === 120 ? 'bg-sky-500 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5x
            </button>
          </div>
        </div>

        {/* Tactical Command Options (Manager Instructions) */}
        {!gameState.isFinished && (
          <div className="mt-3 pt-3 border-t border-sky-100 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 font-semibold mr-1">감독 전술 지시:</span>
            <button
              onClick={() => {
                setPendingTactic('NORMAL');
                handleNextPitch('NORMAL');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                pendingTactic === 'NORMAL'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
              }`}
            >
              정면 승부 (강공)
            </button>
            <button
              onClick={() => {
                setPendingTactic('BUNT');
                handleNextPitch('BUNT');
              }}
              disabled={gameState.outs >= 2}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                pendingTactic === 'BUNT'
                  ? 'bg-amber-500 text-white font-bold border-amber-500'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              번트 지시 (희생번트)
            </button>
            <button
              onClick={() => {
                setPendingTactic('STEAL');
                handleNextPitch('STEAL');
              }}
              disabled={!gameState.bases.first && !gameState.bases.second}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                pendingTactic === 'STEAL'
                  ? 'bg-emerald-600 text-white font-bold border-emerald-600'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              단독 도루 지시
            </button>
            <button
              onClick={() => {
                setPendingTactic('INTENTIONAL_WALK');
                handleNextPitch('INTENTIONAL_WALK');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                pendingTactic === 'INTENTIONAL_WALK'
                  ? 'bg-purple-600 text-white font-bold border-purple-600'
                  : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
              }`}
            >
              고의사구 (거르기)
            </button>
          </div>
        )}
      </div>

      {/* 4. Live Play-by-Play Relay Terminal Feed */}
      <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-sky-50/70 px-4 py-2.5 border-b border-sky-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
            <h3 className="font-display font-bold text-xs text-sky-900">실시간 문자 중계 피드 (Live Relay Broadcast)</h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScrollFeed}
                onChange={(e) => setAutoScrollFeed(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500"
              />
              <span>자동 스크롤 고정</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono-numbers">
              총 {gameState.playLogs.length}건
            </span>
          </div>
        </div>

        {/* Scrollable container with fixed internal max-height */}
        <div
          ref={logContainerRef}
          className="p-4 max-h-72 overflow-y-auto space-y-2 font-mono-numbers text-xs bg-slate-50/50"
        >
          {gameState.playLogs.map((log) => {
            const isHomerun = log.highlightType === 'HOMERUN';
            const isHit = log.highlightType === 'HIT';
            const isOut = log.highlightType === 'OUT' || log.highlightType === 'STRIKEOUT';
            const isTactic = log.highlightType === 'TACTIC';

            return (
              <div
                key={log.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isHomerun
                    ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                    : isHit
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : isOut
                    ? 'bg-white border-slate-200 text-slate-700'
                    : isTactic
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>
                    {log.inning}회{log.isTop ? '초' : '말'} · B:{log.balls} S:{log.strikes} O:{log.outs}
                  </span>
                  {log.batterName && (
                    <span>타자: {log.batterName} vs 투수: {log.pitcherName}</span>
                  )}
                </div>
                <div className="text-sm font-sans leading-relaxed">{log.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Match Complete Boxscore Modal */}
      {gameState.isFinished && (
        <div className="p-6 bg-white border-2 border-sky-400 rounded-2xl shadow-xl text-center space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-sky-100 text-sky-600 mb-1">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-extrabold text-slate-900">
            경기가 공식 종료되었습니다!
          </h2>
          <p className="text-base text-slate-700 font-mono-numbers">
            {gameState.awayTeam.name} <strong className="text-sky-600 text-xl">{gameState.score.away}</strong> : <strong className="text-sky-600 text-xl">{gameState.score.home}</strong> {gameState.homeTeam.name}
          </p>
          <div className="text-xs text-slate-500">
            {gameState.winningTeamId ? (
              <span>승리 구단: <strong>{gameState.winningTeamId === gameState.homeTeam.id ? gameState.homeTeam.name : gameState.awayTeam.name}</strong></span>
            ) : (
              <span>무승부 경기</span>
            )}
          </div>
          <div>
            <button
              onClick={() => onFinishGame(gameState)}
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition-colors"
            >
              경기 결과 구단 기록에 반영하고 사옥으로 복귀
            </button>
          </div>
        </div>
      )}

      {/* Pitcher Substitution Modal */}
      {showPitcherSubModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-sky-100 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">교체 등판할 불펜 투수 선택</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {allRoster
                .filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && p.id !== currentPitcher.id)
                .map(pitcher => (
                  <div
                    key={pitcher.id}
                    onClick={() => handleSubstitutePitcher(pitcher)}
                    className="p-3 bg-sky-50/60 hover:bg-sky-100 border border-sky-100 rounded-xl cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-sm text-slate-900">{pitcher.name}</span>
                      <span className="text-slate-500 ml-2">보직: {pitcher.primaryPosition}</span>
                    </div>
                    <div className="text-right font-mono-numbers">
                      <span className="text-sky-600 font-bold">{pitcher.pitcherStats?.velocity}km/h</span>
                      <span className="text-slate-500 block">구위 {pitcher.pitcherStats?.stuff}</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowPitcherSubModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
