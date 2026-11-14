/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LiveGameView } from './components/LiveGameView';
import { RosterView } from './components/RosterView';
import { TrainingView } from './components/TrainingView';
import { TradeView } from './components/TradeView';
import { DraftView } from './components/DraftView';
import { StandingsRecordView } from './components/StandingsRecordView';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { TeamSelectorModal } from './components/TeamSelectorModal';
import { PlayerDetailModal } from './components/PlayerDetailModal';
import { ApprovalModal } from './components/ApprovalModal';

import {
  AutoGrowthLog,
  DraftProspect,
  HistorySeason,
  LiveGameState,
  MatchRecord,
  PendingApproval,
  Player,
  Team,
} from './types/baseball';
import { INITIAL_JBL_TEAMS, JBL_HISTORICAL_CHAMPIONS, generateAllLeaguePlayers, generateDraftProspects } from './data/initialLeagueData';
import {
  autoDevelopAllLeaguePlayers,
  createNewGame,
  generateDailyApprovals,
  mergeGameStatsIntoPlayersMap,
  simulateCpuMatch,
} from './utils/simulationEngine';
import { sendPayloadToGoogleAppsScript, GameExportPayload, PulledSheetSyncData } from './utils/appsScriptGenerator';

const SAVE_KEY = 'jbl_baseball_manager_save_v1';
const WEBHOOK_KEY = 'jbl_sheets_webhook_url';
const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzTrjYzCYE7pFz29osMUdXTjtoFeYkAeE2XweBSje0zxaeJP6vK1i5lyVhWd5raukY7sw/exec';

export default function App() {
  const [teams, setTeams] = useState<Team[]>(INITIAL_JBL_TEAMS);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('team_jido');
  const [playersMap, setPlayersMap] = useState<Record<string, Player[]>>(() => generateAllLeaguePlayers(INITIAL_JBL_TEAMS));
  const [prospects, setProspects] = useState<DraftProspect[]>(() => generateDraftProspects());
  const [seasonNumber, setSeasonNumber] = useState<number>(26);
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<ActiveTab>('DASHBOARD');

  const [tradeLogs, setTradeLogs] = useState<Array<{ date: string; description: string }>>([]);
  const [draftLogs, setDraftLogs] = useState<Array<{ round: number; pickNumber: number; teamName: string; playerName: string; position: string; school: string }>>([]);
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [historicalChampions, setHistoricalChampions] = useState<HistorySeason[]>(JBL_HISTORICAL_CHAMPIONS);

  const [webhookUrl, setWebhookUrl] = useState<string>(DEFAULT_WEBHOOK_URL);
  const [showTeamSelectModal, setShowTeamSelectModal] = useState<boolean>(false);
  const [inspectingPlayer, setInspectingPlayer] = useState<Player | null>(null);

  // League-wide Auto-Development & Manager Approval Notifications
  const [autoTrainingEnabled, setAutoTrainingEnabled] = useState<boolean>(true);
  const [growthLogs, setGrowthLogs] = useState<AutoGrowthLog[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);

  // Active Live Game State
  const [liveGame, setLiveGame] = useState<LiveGameState | null>(null);
  const [quickSyncToast, setQuickSyncToast] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // 1. Load from localStorage on mount
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem(WEBHOOK_KEY);
      if (savedUrl && savedUrl.trim()) {
        setWebhookUrl(savedUrl);
      } else {
        localStorage.setItem(WEBHOOK_KEY, DEFAULT_WEBHOOK_URL);
        setWebhookUrl(DEFAULT_WEBHOOK_URL);
      }

      const savedData = localStorage.getItem(SAVE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.teams && parsed.selectedTeamId && parsed.playersMap) {
          setTeams(parsed.teams);
          setSelectedTeamId(parsed.selectedTeamId);
          setPlayersMap(parsed.playersMap);
          if (parsed.prospects) setProspects(parsed.prospects);
          if (parsed.seasonNumber) setSeasonNumber(parsed.seasonNumber);
          if (parsed.currentDay) setCurrentDay(parsed.currentDay);
          if (parsed.tradeLogs) setTradeLogs(parsed.tradeLogs);
          if (parsed.draftLogs) setDraftLogs(parsed.draftLogs);
          if (parsed.matchHistory) setMatchHistory(parsed.matchHistory);
          if (parsed.historicalChampions) setHistoricalChampions(parsed.historicalChampions);
          if (typeof parsed.autoTrainingEnabled === 'boolean') setAutoTrainingEnabled(parsed.autoTrainingEnabled);
          if (Array.isArray(parsed.growthLogs)) setGrowthLogs(parsed.growthLogs);
          if (Array.isArray(parsed.pendingApprovals)) setPendingApprovals(parsed.pendingApprovals);
        }
      } else {
        setShowTeamSelectModal(true);
      }
    } catch (e) {
      console.warn('Failed to load local storage save:', e);
    } finally {
      hasLoadedRef.current = true;
    }
  }, []);

  // 2. Reliable Auto-Save whenever league state changes
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    try {
      const stateToSave = {
        teams,
        selectedTeamId,
        playersMap,
        prospects,
        seasonNumber,
        currentDay,
        tradeLogs,
        draftLogs,
        matchHistory,
        historicalChampions,
        autoTrainingEnabled,
        growthLogs,
        pendingApprovals,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to auto-save to local storage:', e);
    }
  }, [
    teams,
    selectedTeamId,
    playersMap,
    prospects,
    seasonNumber,
    currentDay,
    tradeLogs,
    draftLogs,
    matchHistory,
    historicalChampions,
    autoTrainingEnabled,
    growthLogs,
    pendingApprovals,
  ]);

  const userTeam = teams.find(t => t.id === selectedTeamId) || teams[0];
  const userRoster = playersMap[userTeam.id] || [];

  // Next Opponent selection based on schedule
  const otherTeams = teams.filter(t => t.id !== userTeam.id);
  const currentOpponent = otherTeams[(currentDay - 1) % otherTeams.length];

  // Manual Save Trigger
  const handleSaveGame = () => {
    try {
      const stateToSave = {
        teams,
        selectedTeamId,
        playersMap,
        prospects,
        seasonNumber,
        currentDay,
        tradeLogs,
        draftLogs,
        matchHistory,
        historicalChampions,
        autoTrainingEnabled,
        growthLogs,
        pendingApprovals,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save to local storage:', e);
    }
  };

  // 3. Quick Sync to Google Sheets
  const handleQuickSyncSheets = async () => {
    if (!webhookUrl) {
      setActiveTab('SHEETS');
      return;
    }
    setQuickSyncToast('Google Apps Script로 전체 리그 동기화 전송 중...');
    const payload: GameExportPayload = {
      exportDate: new Date().toLocaleString('ko-KR'),
      seasonNumber,
      currentDay,
      userTeam,
      allTeams: teams,
      userRoster,
      allPlayers: playersMap,
      historicalChampions,
      tradeLogs,
      draftLogs,
      matchHistory,
    };
    const res = await sendPayloadToGoogleAppsScript(webhookUrl, payload);
    setQuickSyncToast(res.message);
    setTimeout(() => setQuickSyncToast(null), 3500);
  };

  // 4. Start Match
  const handleStartMatch = () => {
    const opponentRoster = playersMap[currentOpponent.id] || [];
    const newGame = createNewGame(currentOpponent, userTeam, opponentRoster, userRoster, {
      isUserGame: true,
      rotationDay: currentDay,
    });
    setLiveGame(newGame);
    setActiveTab('LIVE_GAME');
  };

  // 5. Finish Match: Apply user match + simulate remaining 8 teams' daily games
  const handleFinishMatch = (finalState: LiveGameState) => {
    let nextPlayersMap = mergeGameStatsIntoPlayersMap(playersMap, finalState);
    const teamStatDeltas: Record<string, { w: number; l: number; d: number; rs: number; ra: number; budget: number }> = {};

    const recordGameToDeltas = (game: LiveGameState) => {
      const awayWon = game.score.away > game.score.home;
      const homeWon = game.score.home > game.score.away;
      const isDraw = game.score.away === game.score.home;

      const awayDelta = teamStatDeltas[game.awayTeam.id] || { w: 0, l: 0, d: 0, rs: 0, ra: 0, budget: 0 };
      awayDelta.w += awayWon ? 1 : 0;
      awayDelta.l += homeWon ? 1 : 0;
      awayDelta.d += isDraw ? 1 : 0;
      awayDelta.rs += game.score.away;
      awayDelta.ra += game.score.home;
      awayDelta.budget += awayWon ? 2000 : 800;
      teamStatDeltas[game.awayTeam.id] = awayDelta;

      const homeDelta = teamStatDeltas[game.homeTeam.id] || { w: 0, l: 0, d: 0, rs: 0, ra: 0, budget: 0 };
      homeDelta.w += homeWon ? 1 : 0;
      homeDelta.l += awayWon ? 1 : 0;
      homeDelta.d += isDraw ? 1 : 0;
      homeDelta.rs += game.score.home;
      homeDelta.ra += game.score.away;
      homeDelta.budget += homeWon ? 2000 : 800;
      teamStatDeltas[game.homeTeam.id] = homeDelta;
    };

    const buildMatchRecord = (game: LiveGameState, isUserMatch: boolean): MatchRecord => {
      const isUserHome = userTeam.id === game.homeTeam.id;
      const refScoreA = isUserMatch ? (isUserHome ? game.score.home : game.score.away) : game.score.home;
      const refScoreB = isUserMatch ? (isUserHome ? game.score.away : game.score.home) : game.score.away;
      const matchResult = refScoreA > refScoreB ? 'WIN' : refScoreA < refScoreB ? 'LOSS' : 'DRAW';
      const winTeamName =
        game.winningTeamId === game.homeTeam.id
          ? game.homeTeam.name
          : game.winningTeamId === game.awayTeam.id
          ? game.awayTeam.name
          : '무승부';

      return {
        id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        day: currentDay,
        seasonNumber,
        dateStr: new Date().toLocaleDateString('ko-KR'),
        awayTeamName: game.awayTeam.name,
        homeTeamName: game.homeTeam.name,
        awayScore: game.score.away,
        homeScore: game.score.home,
        result: matchResult,
        winningTeamName: winTeamName,
        awayHits: game.hits.away,
        homeHits: game.hits.home,
        awayErrors: game.errors.away,
        homeErrors: game.errors.home,
        summary: `${game.awayTeam.name} ${game.score.away} : ${game.score.home} ${game.homeTeam.name} (${game.inning}이닝 경기)`,
        isUserMatch,
      };
    };

    recordGameToDeltas(finalState);
    const todayRecords: MatchRecord[] = [buildMatchRecord(finalState, true)];

    // Simulate remaining 8 teams (4 matchups) silently for full-league standings & stats
    const remainingTeams = teams.filter(t => t.id !== finalState.homeTeam.id && t.id !== finalState.awayTeam.id);
    const rotated = [...remainingTeams];
    const shift = currentDay % Math.max(1, rotated.length);
    const orderedRemaining = [...rotated.slice(shift), ...rotated.slice(0, shift)];

    for (let i = 0; i + 1 < orderedRemaining.length; i += 2) {
      const awayT = orderedRemaining[i];
      const homeT = orderedRemaining[i + 1];
      const cpuGame = simulateCpuMatch(
        awayT,
        homeT,
        nextPlayersMap[awayT.id] || [],
        nextPlayersMap[homeT.id] || [],
        currentDay
      );
      nextPlayersMap = mergeGameStatsIntoPlayersMap(nextPlayersMap, cpuGame);
      recordGameToDeltas(cpuGame);
      todayRecords.push(buildMatchRecord(cpuGame, false));
    }

    const updatedTeams = teams.map(t => {
      const d = teamStatDeltas[t.id];
      if (!d) return t;
      return {
        ...t,
        wins: t.wins + d.w,
        losses: t.losses + d.l,
        draws: t.draws + d.d,
        runsScored: t.runsScored + d.rs,
        runsAllowed: t.runsAllowed + d.ra,
        budget: t.budget + d.budget,
      };
    });

    // 5.5 전 구단 선수 자동 육성 & 트레이드/콜업 결재 알림 생성
    let newGrowthLogs: AutoGrowthLog[] = [];
    if (autoTrainingEnabled) {
      const devResult = autoDevelopAllLeaguePlayers(nextPlayersMap, updatedTeams, seasonNumber, currentDay);
      nextPlayersMap = devResult.nextPlayersMap;
      newGrowthLogs = devResult.growthLogs;
      if (newGrowthLogs.length > 0) {
        setGrowthLogs(prev => [...newGrowthLogs, ...prev].slice(0, 100));
      }
    }

    const dailyApprovals = generateDailyApprovals(
      updatedTeams,
      nextPlayersMap,
      userTeam.id,
      seasonNumber,
      currentDay,
      newGrowthLogs
    );

    setPlayersMap(nextPlayersMap);
    setMatchHistory(prev => [...todayRecords, ...prev]);
    setTeams(updatedTeams);
    setCurrentDay(prev => prev + 1);
    setLiveGame(null);
    setActiveTab('DASHBOARD');

    if (dailyApprovals.length > 0) {
      setPendingApprovals(prev => [...dailyApprovals, ...prev]);
      setShowApprovalModal(true);
    }
  };

  // Manual trigger for 1-day League Auto Training Camp
  const handleRunLeagueAutoTraining = () => {
    const devResult = autoDevelopAllLeaguePlayers(playersMap, teams, seasonNumber, currentDay);
    setPlayersMap(devResult.nextPlayersMap);
    if (devResult.growthLogs.length > 0) {
      setGrowthLogs(prev => [...devResult.growthLogs, ...prev].slice(0, 100));
    }
  };

  // 6. Handle Trade Execution
  const handleExecuteTrade = (myPlayer: Player, theirPlayer: Player, theirTeamId: string, logDesc: string) => {
    const updatedUserRoster = userRoster.map(p => p.id === myPlayer.id ? { ...theirPlayer, teamId: userTeam.id } : p);
    const theirRoster = (playersMap[theirTeamId] || []).map(p => p.id === theirPlayer.id ? { ...myPlayer, teamId: theirTeamId } : p);

    setPlayersMap(prev => ({
      ...prev,
      [userTeam.id]: updatedUserRoster,
      [theirTeamId]: theirRoster,
    }));
    setTradeLogs(prev => [
      { date: `${seasonNumber}회차 ${currentDay}일`, description: logDesc },
      ...prev,
    ]);
  };

  // 6.5 Handle Approval Notification Modal Approve / Reject
  const handleApprovePending = (approval: PendingApproval) => {
    if (
      (approval.category === 'TRADE_INCOMING' || approval.category === 'TRADE_LEAGUE') &&
      approval.offeredPlayer &&
      approval.requestedPlayer
    ) {
      const fromTeam = teams.find(t => t.id === approval.fromTeamId);
      const toTeam = teams.find(t => t.id === approval.toTeamId);
      const offered = approval.offeredPlayer;
      const requested = approval.requestedPlayer;

      setPlayersMap(prev => {
        const fromRoster = (prev[approval.fromTeamId] || []).map(p =>
          p.id === offered.id ? { ...requested, teamId: approval.fromTeamId } : p
        );
        const toRoster = (prev[approval.toTeamId] || []).map(p =>
          p.id === requested.id ? { ...offered, teamId: approval.toTeamId } : p
        );
        return {
          ...prev,
          [approval.fromTeamId]: fromRoster,
          [approval.toTeamId]: toRoster,
        };
      });

      const desc = `${fromTeam?.name || '구단'} ${offered.name}(${offered.primaryPosition}) ↔ ${toTeam?.name || '구단'} ${requested.name}(${requested.primaryPosition}) 트레이드 승인 완료!`;
      setTradeLogs(prev => [
        { date: `${seasonNumber}회차 ${currentDay}일`, description: desc },
        ...prev,
      ]);
      setQuickSyncToast(`✅ ${desc}`);
      setTimeout(() => setQuickSyncToast(null), 3500);
    } else if (approval.category === 'PROMOTION_RECOMMEND' && approval.targetPlayer) {
      const target = approval.targetPlayer;
      setPlayersMap(prev => ({
        ...prev,
        [approval.fromTeamId]: (prev[approval.fromTeamId] || []).map(p =>
          p.id === target.id ? { ...p, tier: 'FIRST_TEAM' } : p
        ),
      }));
      setQuickSyncToast(`📣 ${target.name} 선수가 1군 엔트리로 승격 콜업되었습니다!`);
      setTimeout(() => setQuickSyncToast(null), 3500);
    }

    setPendingApprovals(prev => {
      const next = prev.filter(a => a.id !== approval.id);
      if (next.length === 0) setShowApprovalModal(false);
      return next;
    });
  };

  const handleRejectPending = (approvalId: string) => {
    setPendingApprovals(prev => {
      const next = prev.filter(a => a.id !== approvalId);
      if (next.length === 0) setShowApprovalModal(false);
      return next;
    });
  };

  // 7. Handle Draft Pick
  const handleDraftPlayer = (prospect: DraftProspect, draftingTeam: Team, round: number, pickNumber: number) => {
    const draftedPlayer: Player = {
      ...prospect.playerData,
      id: `p_${draftingTeam.id}_${Date.now()}`,
      teamId: draftingTeam.id,
      tier: 'SECOND_TEAM',
    };

    setPlayersMap(prev => ({
      ...prev,
      [draftingTeam.id]: [...(prev[draftingTeam.id] || []), draftedPlayer],
    }));

    setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, isDrafted: true, draftedByTeamId: draftingTeam.id } : p));

    setDraftLogs(prev => [
      {
        round,
        pickNumber,
        teamName: draftingTeam.name,
        playerName: prospect.name,
        position: prospect.position,
        school: prospect.school,
      },
      ...prev,
    ]);
  };

  // 8. Save / Delete single player from PlayerDetailModal
  const handleSaveEditedPlayer = (updatedPlayer: Player) => {
    setPlayersMap(prev => {
      const roster = prev[updatedPlayer.teamId] || [];
      return {
        ...prev,
        [updatedPlayer.teamId]: roster.map(p => p.id === updatedPlayer.id ? updatedPlayer : p),
      };
    });
    setInspectingPlayer(updatedPlayer);
  };

  const handleDeletePlayer = (playerId: string, teamId: string) => {
    setPlayersMap(prev => ({
      ...prev,
      [teamId]: (prev[teamId] || []).filter(p => p.id !== playerId),
    }));
  };

  // 9. Advance to Next Season & Crown Champion
  const handleAdvanceNextSeason = (championTeamId: string) => {
    const championTeam = teams.find(t => t.id === championTeamId);
    if (championTeam) {
      setHistoricalChampions(prev => [
        ...prev.filter(h => h.seasonNumber !== seasonNumber),
        { seasonNumber, champion: championTeam.name },
      ].sort((a, b) => a.seasonNumber - b.seasonNumber));
    }

    setTeams(prev => prev.map(t => ({
      ...t,
      championships: t.id === championTeamId ? t.championships + 1 : t.championships,
      wins: 0,
      losses: 0,
      draws: 0,
      runsScored: 0,
      runsAllowed: 0,
    })));

    // Reset seasonal counting stats while keeping player attributes, names, positions, levels
    setPlayersMap(prev => {
      const next: Record<string, Player[]> = {};
      Object.keys(prev).forEach(tid => {
        next[tid] = prev[tid].map(p => ({
          ...p,
          age: p.age + 1,
          batterStats: p.batterStats ? {
            ...p.batterStats,
            games: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
            rbi: 0, runs: 0, walks: 0, strikeouts: 0, stolenBases: 0, caughtStealing: 0,
          } : undefined,
          pitcherStats: p.pitcherStats ? {
            ...p.pitcherStats,
            games: 0, gamesStarted: 0, inningsOuts: 0, wins: 0, losses: 0,
            saves: 0, holds: 0, earnedRuns: 0, hitsAllowed: 0, walksAllowed: 0,
            strikeouts: 0, homeRunsAllowed: 0, pitchesCount: 0,
          } : undefined,
        }));
      });
      return next;
    });

    setProspects(generateDraftProspects());
    setSeasonNumber(prev => prev + 1);
    setCurrentDay(1);
  };

  // 10. Restore from JSON Backup
  const handleRestoreBackup = (payload: GameExportPayload) => {
    if (payload.allTeams) setTeams(payload.allTeams);
    if (payload.userTeam) setSelectedTeamId(payload.userTeam.id);
    if (payload.allPlayers) setPlayersMap(payload.allPlayers);
    if (payload.seasonNumber) setSeasonNumber(payload.seasonNumber);
    if (payload.currentDay) setCurrentDay(payload.currentDay);
    if (payload.tradeLogs) setTradeLogs(payload.tradeLogs);
    if (payload.draftLogs) setDraftLogs(payload.draftLogs);
    if (payload.matchHistory) setMatchHistory(payload.matchHistory);
    if (payload.historicalChampions) setHistoricalChampions(payload.historicalChampions);
  };

  // 11. Apply Pulled Google Sheets Data
  const handleApplyPulledSheetData = (data: PulledSheetSyncData) => {
    if (data.teams) setTeams(data.teams);
    if (data.playersMap) setPlayersMap(data.playersMap);
    if (data.seasonNumber) setSeasonNumber(data.seasonNumber);
    if (data.currentDay) setCurrentDay(data.currentDay);
    if (data.selectedTeamId && (data.teams || teams).some(t => t.id === data.selectedTeamId)) {
      setSelectedTeamId(data.selectedTeamId);
    }
    if (data.historicalChampions && data.historicalChampions.length > 0) {
      setHistoricalChampions(data.historicalChampions);
    }
    if (data.matchHistory) setMatchHistory(data.matchHistory);
    if (data.tradeLogs) setTradeLogs(data.tradeLogs);
  };

  // 12. Apply CSV/TSV Spreadsheet Importer Updates
  const handleImportPlayersAndLeague = (updates: {
    nextPlayersMap?: Record<string, Player[]>;
    nextSeasonNumber?: number;
    nextChampions?: HistorySeason[];
    teamUpdates?: Array<{ name: string; owner?: string; homeStadium?: string; foundedYear?: number; championships?: number }>;
  }) => {
    if (updates.nextPlayersMap) setPlayersMap(updates.nextPlayersMap);
    if (updates.nextSeasonNumber) setSeasonNumber(updates.nextSeasonNumber);
    if (updates.nextChampions) setHistoricalChampions(updates.nextChampions);
    if (updates.teamUpdates && updates.teamUpdates.length > 0) {
      setTeams(prev => prev.map(t => {
        const match = updates.teamUpdates!.find(u => u.name === t.name);
        if (!match) return t;
        return {
          ...t,
          owner: match.owner || t.owner,
          homeStadium: match.homeStadium || t.homeStadium,
          foundedYear: match.foundedYear ?? t.foundedYear,
          championships: match.championships ?? t.championships,
        };
      }));
    }
  };

  const inspectingPlayerTeam = inspectingPlayer
    ? teams.find(t => t.id === inspectingPlayer.teamId) || userTeam
    : userTeam;

  return (
    <div className="min-h-screen bg-sky-50/40 text-slate-800 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Header */}
      <Header
        userTeam={userTeam}
        seasonNumber={seasonNumber}
        currentDay={currentDay}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onSaveGame={handleSaveGame}
        onQuickSyncSheets={handleQuickSyncSheets}
        hasWebhookUrl={Boolean(webhookUrl)}
        onOpenTeamSelect={() => setShowTeamSelectModal(true)}
        pendingApprovalsCount={pendingApprovals.length}
        onOpenApprovals={() => {
          if (pendingApprovals.length > 0) {
            setShowApprovalModal(true);
          } else {
            setQuickSyncToast('현재 대기 중인 트레이드 · 콜업 결재 안건이 없습니다.');
            setTimeout(() => setQuickSyncToast(null), 2500);
          }
        }}
      />

      {/* Quick Sync Notification Toast */}
      {quickSyncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-sky-900 border border-sky-400 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl">
          {quickSyncToast}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {activeTab === 'DASHBOARD' && (
          <DashboardView
            userTeam={userTeam}
            allTeams={teams}
            roster={userRoster}
            opponentTeam={currentOpponent}
            onStartMatch={handleStartMatch}
            onNavigateTo={setActiveTab}
            onOpenTeamSelect={() => setShowTeamSelectModal(true)}
          />
        )}

        {activeTab === 'LIVE_GAME' && (
          liveGame ? (
            <LiveGameView
              gameState={liveGame}
              onUpdateGameState={setLiveGame}
              onFinishGame={handleFinishMatch}
              userTeam={userTeam}
              allRoster={userRoster}
            />
          ) : (
            <div className="text-center py-20 bg-white border border-sky-100 rounded-2xl p-8 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">진행 중인 경기가 없습니다.</h3>
              <p className="text-xs text-slate-500">
                구단 사옥 대시보드에서 [오늘 경기 지휘하기] 버튼을 눌러 다음 경기({currentOpponent?.name}전)를 시작하세요!
              </p>
              <button
                onClick={handleStartMatch}
                className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20"
              >
                {currentOpponent?.name}전 경기 시작
              </button>
            </div>
          )
        )}

        {activeTab === 'ROSTER' && (
          <RosterView
            userTeam={userTeam}
            allTeams={teams}
            allPlayers={playersMap}
            onUpdateTeamRoster={(teamId, newRoster) => {
              setPlayersMap(prev => ({ ...prev, [teamId]: newRoster }));
            }}
            onOpenPlayerDetail={setInspectingPlayer}
          />
        )}

        {activeTab === 'TRAINING' && (
          <TrainingView
            userTeam={userTeam}
            roster={userRoster}
            autoTrainingEnabled={autoTrainingEnabled}
            onToggleAutoTraining={() => setAutoTrainingEnabled(prev => !prev)}
            onRunLeagueAutoTraining={handleRunLeagueAutoTraining}
            growthLogs={growthLogs}
            onUpdateTeam={(newTeam) => {
              setTeams(prev => prev.map(t => t.id === newTeam.id ? newTeam : t));
            }}
            onUpdateRoster={(newRoster) => {
              setPlayersMap(prev => ({ ...prev, [userTeam.id]: newRoster }));
            }}
            onOpenPlayerDetail={setInspectingPlayer}
          />
        )}

        {activeTab === 'TRADE' && (
          <TradeView
            userTeam={userTeam}
            allTeams={teams}
            userRoster={userRoster}
            allPlayers={playersMap}
            pendingApprovalsCount={pendingApprovals.length}
            onOpenApprovals={() => {
              if (pendingApprovals.length > 0) {
                setShowApprovalModal(true);
              } else {
                setQuickSyncToast('현재 결재 대기 중인 트레이드 알림이 없습니다.');
                setTimeout(() => setQuickSyncToast(null), 2500);
              }
            }}
            onQueueTradeApproval={(approval) => {
              setPendingApprovals(prev => [
                { ...approval, createdAtDay: currentDay, seasonNumber },
                ...prev,
              ]);
              setShowApprovalModal(true);
            }}
            onExecuteTrade={handleExecuteTrade}
            onOpenPlayerDetail={setInspectingPlayer}
          />
        )}

        {activeTab === 'DRAFT' && (
          <DraftView
            userTeam={userTeam}
            allTeams={teams}
            prospects={prospects}
            onDraftPlayer={handleDraftPlayer}
            onOpenPlayerDetail={setInspectingPlayer}
          />
        )}

        {activeTab === 'STANDINGS' && (
          <StandingsRecordView
            allTeams={teams}
            allPlayers={playersMap}
            userTeam={userTeam}
            seasonNumber={seasonNumber}
            currentDay={currentDay}
            historicalChampions={historicalChampions}
            matchHistory={matchHistory}
            onUpdateSeasonAndDay={(nextSeason, nextDay) => {
              setSeasonNumber(nextSeason);
              setCurrentDay(nextDay);
            }}
            onAdvanceNextSeason={handleAdvanceNextSeason}
            onOpenPlayerDetail={setInspectingPlayer}
          />
        )}

        {activeTab === 'SHEETS' && (
          <GoogleSheetsView
            userTeam={userTeam}
            allTeams={teams}
            userRoster={userRoster}
            allPlayers={playersMap}
            seasonNumber={seasonNumber}
            currentDay={currentDay}
            historicalChampions={historicalChampions}
            tradeLogs={tradeLogs}
            draftLogs={draftLogs}
            matchHistory={matchHistory}
            webhookUrl={webhookUrl}
            onSaveWebhookUrl={(url) => {
              setWebhookUrl(url);
              localStorage.setItem(WEBHOOK_KEY, url);
            }}
            onRestoreBackup={handleRestoreBackup}
            onApplyPulledSheetData={handleApplyPulledSheetData}
            onImportPlayersAndLeague={handleImportPlayersAndLeague}
          />
        )}
      </main>

      {/* Team Selection Modal */}
      <TeamSelectorModal
        isOpen={showTeamSelectModal}
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={(teamId) => {
          setSelectedTeamId(teamId);
        }}
        onClose={() => setShowTeamSelectModal(false)}
      />

      {/* Manager Approval Modal (Trades & Call-ups) */}
      <ApprovalModal
        isOpen={showApprovalModal}
        approvals={pendingApprovals}
        allTeams={teams}
        onApprove={handleApprovePending}
        onReject={handleRejectPending}
        onClose={() => setShowApprovalModal(false)}
        onInspectPlayer={setInspectingPlayer}
      />

      {/* Player Detail & Edit Modal */}
      <PlayerDetailModal
        player={inspectingPlayer}
        team={inspectingPlayerTeam}
        seasonNumber={seasonNumber}
        onSavePlayer={handleSaveEditedPlayer}
        onDeletePlayer={handleDeletePlayer}
        onClose={() => setInspectingPlayer(null)}
      />
    </div>
  );
}
