/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { LiveGameView } from './components/LiveGameView';
import { MatchAnalysisView } from './components/MatchAnalysisView';
import { RosterView } from './components/RosterView';
import { TrainingView } from './components/TrainingView';
import { TradeView } from './components/TradeView';
import { FreeAgentView } from './components/FreeAgentView';
import { DraftView } from './components/DraftView';
import { StandingsRecordView } from './components/StandingsRecordView';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { TeamSelectorModal } from './components/TeamSelectorModal';
import { PlayerDetailModal } from './components/PlayerDetailModal';
import { ApprovalModal } from './components/ApprovalModal';

import {
  AutoGrowthLog,
  DraftProspect,
  FreeAgent,
  HistorySeason,
  LeagueNewsItem,
  LiveGameState,
  MatchRecord,
  PendingApproval,
  Player,
  PostseasonState,
  SeasonAwardRecord,
  Team,
} from './types/baseball';
import { INITIAL_JBL_TEAMS, JBL_HISTORICAL_CHAMPIONS, generateAllLeaguePlayers, generateDraftProspects } from './data/initialLeagueData';
import {
  autoDevelopAllLeaguePlayers,
  autoOptimizeTeamRoster,
  computeSeasonAwards,
  createNewGame,
  createPostseasonBracket,
  detectMatchHighlightNews,
  generateDailyApprovals,
  generateFreeAgentPool,
  mergeGameStatsIntoPlayersMap,
  simulateCpuMatch,
  simulatePostseasonNextGame,
} from './utils/simulationEngine';
import {
  sendPayloadToGoogleAppsScript,
  fetchPayloadFromGoogleAppsScript,
  GameExportPayload,
  PulledSheetSyncData,
} from './utils/appsScriptGenerator';
import { useOnlineStatus } from './hooks/usePWAInstall';

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
  const [autoSheetsSync, setAutoSheetsSync] = useState<boolean>(true);
  const [autoClubAssist, setAutoClubAssist] = useState<boolean>(true);
  const [growthLogs, setGrowthLogs] = useState<AutoGrowthLog[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [postseasonState, setPostseasonState] = useState<PostseasonState | null>(null);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>(() => generateFreeAgentPool(26, INITIAL_JBL_TEAMS));
  const [leagueNews, setLeagueNews] = useState<LeagueNewsItem[]>([]);
  const [seasonAwards, setSeasonAwards] = useState<SeasonAwardRecord[]>([]);
  const [cloudNewerNotice, setCloudNewerNotice] = useState<{
    seasonNumber: number;
    currentDay: number;
    data: PulledSheetSyncData;
  } | null>(null);

  // Active Live Game State
  const [liveGame, setLiveGame] = useState<LiveGameState | null>(null);
  const [quickSyncToast, setQuickSyncToast] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const isOnline = useOnlineStatus();

  // 1. Load from localStorage on mount & check for newer cloud save automatically
  useEffect(() => {
    let activeUrl = DEFAULT_WEBHOOK_URL;
    let localTeams = INITIAL_JBL_TEAMS;
    let localPlayers = playersMap;
    let localSeason = 26;
    let localDay = 1;
    let localMatchCount = 0;
    let hadSavedData = false;

    try {
      const savedUrl = localStorage.getItem(WEBHOOK_KEY);
      if (savedUrl && savedUrl.trim()) {
        activeUrl = savedUrl;
        setWebhookUrl(savedUrl);
      } else {
        localStorage.setItem(WEBHOOK_KEY, DEFAULT_WEBHOOK_URL);
        setWebhookUrl(DEFAULT_WEBHOOK_URL);
      }

      const savedData = localStorage.getItem(SAVE_KEY);
      if (savedData) {
        hadSavedData = true;
        const parsed = JSON.parse(savedData);
        if (parsed.teams && parsed.selectedTeamId && parsed.playersMap) {
          localTeams = parsed.teams;
          localPlayers = parsed.playersMap;
          setTeams(parsed.teams);
          setSelectedTeamId(parsed.selectedTeamId);
          setPlayersMap(parsed.playersMap);
          if (parsed.prospects) setProspects(parsed.prospects);
          if (parsed.seasonNumber) {
            localSeason = parsed.seasonNumber;
            setSeasonNumber(parsed.seasonNumber);
          }
          if (parsed.currentDay) {
            localDay = parsed.currentDay;
            setCurrentDay(parsed.currentDay);
          }
          if (parsed.tradeLogs) setTradeLogs(parsed.tradeLogs);
          if (parsed.draftLogs) setDraftLogs(parsed.draftLogs);
          if (parsed.matchHistory) {
            localMatchCount = parsed.matchHistory.length;
            setMatchHistory(parsed.matchHistory);
          }
          if (parsed.historicalChampions) setHistoricalChampions(parsed.historicalChampions);
          if (typeof parsed.autoTrainingEnabled === 'boolean') setAutoTrainingEnabled(parsed.autoTrainingEnabled);
          if (typeof parsed.autoSheetsSync === 'boolean') setAutoSheetsSync(parsed.autoSheetsSync);
          if (typeof parsed.autoClubAssist === 'boolean') setAutoClubAssist(parsed.autoClubAssist);
          if (Array.isArray(parsed.growthLogs)) setGrowthLogs(parsed.growthLogs);
          if (Array.isArray(parsed.pendingApprovals)) setPendingApprovals(parsed.pendingApprovals);
          if (parsed.postseasonState) setPostseasonState(parsed.postseasonState);
          if (Array.isArray(parsed.freeAgents) && parsed.freeAgents.length > 0) setFreeAgents(parsed.freeAgents);
          if (Array.isArray(parsed.leagueNews)) setLeagueNews(parsed.leagueNews);
          if (Array.isArray(parsed.seasonAwards)) setSeasonAwards(parsed.seasonAwards);
        }
      } else {
        setShowTeamSelectModal(true);
      }
    } catch (e) {
      console.warn('Failed to load local storage save:', e);
    } finally {
      hasLoadedRef.current = true;
    }

    // Background check for newer Google Sheets save across PC / tablet / phone
    if (activeUrl && navigator.onLine) {
      fetchPayloadFromGoogleAppsScript(activeUrl, localTeams, localPlayers)
        .then(res => {
          if (!res.success || !res.data) return;
          const cloudSeason = res.data.seasonNumber || localSeason;
          const cloudDay = res.data.currentDay || localDay;
          const cloudMatches = res.data.matchHistory?.length || 0;

          const isCloudNewer =
            (!hadSavedData && (cloudSeason > 26 || cloudDay > 1 || cloudMatches > 0)) ||
            cloudSeason > localSeason ||
            (cloudSeason === localSeason && cloudDay > localDay) ||
            (cloudSeason === localSeason && cloudDay === localDay && cloudMatches > localMatchCount);

          if (isCloudNewer) {
            setCloudNewerNotice({
              seasonNumber: cloudSeason,
              currentDay: cloudDay,
              data: res.data,
            });
          }
        })
        .catch(() => {
          // Ignore background cloud check failures silently
        });
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
        autoSheetsSync,
        autoClubAssist,
        growthLogs,
        pendingApprovals,
        postseasonState,
        freeAgents,
        leagueNews,
        seasonAwards,
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
    autoSheetsSync,
    autoClubAssist,
    growthLogs,
    pendingApprovals,
    postseasonState,
    freeAgents,
    leagueNews,
    seasonAwards,
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
        autoSheetsSync,
        autoClubAssist,
        growthLogs,
        pendingApprovals,
        postseasonState,
        freeAgents,
        leagueNews,
        seasonAwards,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save to local storage:', e);
    }
  };

  // Background Auto-Sync to Google Sheets
  const triggerBackgroundSheetsSync = async (overrides?: {
    teams?: Team[];
    playersMap?: Record<string, Player[]>;
    seasonNumber?: number;
    currentDay?: number;
    matchHistory?: MatchRecord[];
    tradeLogs?: Array<{ date: string; description: string }>;
    historicalChampions?: HistorySeason[];
  }) => {
    if (!autoSheetsSync || !webhookUrl || !isOnline) return;
    const targetTeams = overrides?.teams || teams;
    const targetPlayersMap = overrides?.playersMap || playersMap;
    const targetUserTeam = targetTeams.find(t => t.id === selectedTeamId) || targetTeams[0];
    const payload: GameExportPayload = {
      exportDate: new Date().toLocaleString('ko-KR'),
      seasonNumber: overrides?.seasonNumber ?? seasonNumber,
      currentDay: overrides?.currentDay ?? currentDay,
      userTeam: targetUserTeam,
      allTeams: targetTeams,
      userRoster: targetPlayersMap[targetUserTeam.id] || [],
      allPlayers: targetPlayersMap,
      historicalChampions: overrides?.historicalChampions || historicalChampions,
      tradeLogs: overrides?.tradeLogs || tradeLogs,
      draftLogs,
      matchHistory: overrides?.matchHistory || matchHistory,
    };
    const res = await sendPayloadToGoogleAppsScript(webhookUrl, payload);
    if (res.success) {
      setQuickSyncToast('☁️ 구글 시트에 최신 리그 진행 상황이 자동 백업되었습니다.');
      setTimeout(() => setQuickSyncToast(null), 2600);
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

  // 3.5 Quick Pull from Google Sheets (for switching between PC, tablet, phone)
  const handleQuickPullSheets = async () => {
    if (!webhookUrl) {
      setActiveTab('SHEETS');
      return;
    }
    setQuickSyncToast('다른 기기에서 저장된 구글 시트 기록을 불러오는 중...');
    const res = await fetchPayloadFromGoogleAppsScript(webhookUrl, teams, playersMap);
    if (res.success && res.data) {
      handleApplyPulledSheetData(res.data);
      setCloudNewerNotice(null);
    }
    setQuickSyncToast(res.message);
    setTimeout(() => setQuickSyncToast(null), 4000);
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

  // Shared 1-Day Full League Step (Used by Live Match Finish & Multi-Day Auto Simulation)
  const executeSingleLeagueDay = (
    snapTeams: Team[],
    snapPlayersMap: Record<string, Player[]>,
    dayNum: number,
    seasonNum: number,
    optionalUserFinalGame?: LiveGameState
  ) => {
    const activeUserTeam = snapTeams.find(t => t.id === selectedTeamId) || snapTeams[0];
    const oppList = snapTeams.filter(t => t.id !== activeUserTeam.id);
    const dayOpponent = oppList[(dayNum - 1) % oppList.length];

    const userFinalGame =
      optionalUserFinalGame ||
      simulateCpuMatch(
        dayOpponent,
        activeUserTeam,
        snapPlayersMap[dayOpponent.id] || [],
        snapPlayersMap[activeUserTeam.id] || [],
        dayNum
      );

    let nextPlayersMap = mergeGameStatsIntoPlayersMap(snapPlayersMap, userFinalGame);
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
      const isUserHome = activeUserTeam.id === game.homeTeam.id;
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
        day: dayNum,
        seasonNumber: seasonNum,
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

    recordGameToDeltas(userFinalGame);
    const todayRecords: MatchRecord[] = [buildMatchRecord(userFinalGame, true)];
    const todayNews: LeagueNewsItem[] = [...detectMatchHighlightNews(userFinalGame, seasonNum, dayNum)];

    // Simulate remaining 8 teams (4 matchups)
    const remainingTeams = snapTeams.filter(t => t.id !== userFinalGame.homeTeam.id && t.id !== userFinalGame.awayTeam.id);
    const rotated = [...remainingTeams];
    const shift = dayNum % Math.max(1, rotated.length);
    const orderedRemaining = [...rotated.slice(shift), ...rotated.slice(0, shift)];

    for (let i = 0; i + 1 < orderedRemaining.length; i += 2) {
      const awayT = orderedRemaining[i];
      const homeT = orderedRemaining[i + 1];
      const cpuGame = simulateCpuMatch(
        awayT,
        homeT,
        nextPlayersMap[awayT.id] || [],
        nextPlayersMap[homeT.id] || [],
        dayNum
      );
      nextPlayersMap = mergeGameStatsIntoPlayersMap(nextPlayersMap, cpuGame);
      recordGameToDeltas(cpuGame);
      todayRecords.push(buildMatchRecord(cpuGame, false));
      todayNews.push(...detectMatchHighlightNews(cpuGame, seasonNum, dayNum));
    }

    const updatedTeams = snapTeams.map(t => {
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

    // 전 구단 선수 자동 육성 & 부상 회복/발생 처리
    let newGrowthLogs: AutoGrowthLog[] = [];
    let newlyInjuredUserPlayers: Player[] = [];
    if (autoTrainingEnabled) {
      const devResult = autoDevelopAllLeaguePlayers(nextPlayersMap, updatedTeams, seasonNum, dayNum, activeUserTeam.id);
      nextPlayersMap = devResult.nextPlayersMap;
      newGrowthLogs = devResult.growthLogs;
      newlyInjuredUserPlayers = devResult.newlyInjuredUserPlayers;
    }

    // 구단 자동 관리 (autoClubAssist ON이면 부상자 2군행 & 대체 콜업 · 라인업 자동 재정렬)
    if (autoClubAssist) {
      const currUserRoster = nextPlayersMap[activeUserTeam.id] || [];
      const hasFirstTeamInjured = currUserRoster.some(p => p.tier === 'FIRST_TEAM' && p.isInjured);
      const healthyBatters = currUserRoster.filter(p => p.role === 'BATTER' && p.tier === 'FIRST_TEAM' && !p.isInjured).length;
      const healthyPitchers = currUserRoster.filter(p => p.role === 'PITCHER' && p.tier === 'FIRST_TEAM' && !p.isInjured).length;
      if (hasFirstTeamInjured || healthyBatters < 9 || healthyPitchers < 7) {
        nextPlayersMap = {
          ...nextPlayersMap,
          [activeUserTeam.id]: autoOptimizeTeamRoster(currUserRoster),
        };
      }
    }

    const dailyApprovals = generateDailyApprovals(
      updatedTeams,
      nextPlayersMap,
      activeUserTeam.id,
      seasonNum,
      dayNum,
      newGrowthLogs,
      autoClubAssist ? [] : newlyInjuredUserPlayers
    );

    return {
      updatedTeams,
      nextPlayersMap,
      todayRecords,
      todayNews,
      newGrowthLogs,
      dailyApprovals,
    };
  };

  // 5. Finish Manual Live Match
  const handleFinishMatch = (finalState: LiveGameState) => {
    const res = executeSingleLeagueDay(teams, playersMap, currentDay, seasonNumber, finalState);
    const nextDay = currentDay + 1;
    const nextMatches = [...res.todayRecords, ...matchHistory];

    setPlayersMap(res.nextPlayersMap);
    setMatchHistory(nextMatches);
    setTeams(res.updatedTeams);
    setCurrentDay(nextDay);
    if (res.newGrowthLogs.length > 0) {
      setGrowthLogs(prev => [...res.newGrowthLogs, ...prev].slice(0, 120));
    }
    if (res.todayNews.length > 0) {
      setLeagueNews(prev => [...res.todayNews, ...prev].slice(0, 80));
    }

    setLiveGame(null);
    setActiveTab('DASHBOARD');

    if (res.dailyApprovals.length > 0) {
      setPendingApprovals(prev => [...res.dailyApprovals, ...prev]);
      setShowApprovalModal(true);
    }

    void triggerBackgroundSheetsSync({
      teams: res.updatedTeams,
      playersMap: res.nextPlayersMap,
      currentDay: nextDay,
      matchHistory: nextMatches,
    });
  };

  // 5.2 Multi-Game Automated Fast-Forward (1 / 5 / 10 / Until Postseason)
  const handleSimulateMultipleDays = (numDays: number, untilPostseason = false) => {
    let currTeams = teams;
    let currPlayersMap = playersMap;
    let currDay = currentDay;
    const accRecords: MatchRecord[] = [];
    const accNews: LeagueNewsItem[] = [];
    const accGrowth: AutoGrowthLog[] = [];
    const accApprovals: PendingApproval[] = [];

    const maxDaysToRun = untilPostseason ? Math.max(1, 36 - currentDay) : numDays;
    let daysSimulated = 0;

    for (let i = 0; i < maxDaysToRun; i++) {
      const res = executeSingleLeagueDay(currTeams, currPlayersMap, currDay, seasonNumber);
      currTeams = res.updatedTeams;
      currPlayersMap = res.nextPlayersMap;
      currDay += 1;
      daysSimulated += 1;
      accRecords.push(...res.todayRecords);
      accNews.push(...res.todayNews);
      accGrowth.push(...res.newGrowthLogs);

      if (res.dailyApprovals.length > 0) {
        accApprovals.push(...res.dailyApprovals);
        // 트레이드 제안이 도착하면 일괄 진행을 잠시 멈춰 감독 결재를 받을 수 있게 함
        if (res.dailyApprovals.some(a => a.category === 'TRADE_INCOMING' || a.category === 'TRADE_LEAGUE')) {
          break;
        }
      }
    }

    const nextMatches = [...accRecords.reverse(), ...matchHistory];
    setTeams(currTeams);
    setPlayersMap(currPlayersMap);
    setCurrentDay(currDay);
    setMatchHistory(nextMatches);
    if (accGrowth.length > 0) {
      setGrowthLogs(prev => [...accGrowth.reverse(), ...prev].slice(0, 120));
    }
    if (accNews.length > 0) {
      setLeagueNews(prev => [...accNews.reverse(), ...prev].slice(0, 80));
    }

    let nextPostseason = postseasonState;
    if (untilPostseason && currDay >= 36 && !nextPostseason) {
      const sorted = [...currTeams].sort((a, b) => {
        const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return rateB !== rateA ? rateB - rateA : b.wins - a.wins;
      });
      nextPostseason = createPostseasonBracket(sorted, seasonNumber);
      setPostseasonState(nextPostseason);
    }

    if (accApprovals.length > 0) {
      setPendingApprovals(prev => [...accApprovals, ...prev]);
      setShowApprovalModal(true);
    }

    const msg =
      untilPostseason && currDay >= 36
        ? `🏆 정규시즌 ${daysSimulated}경기 일괄 진행 완료! 포스트시즌 브래킷이 자동 편성되었습니다.`
        : `⚡ ${daysSimulated}경기 자동 진행 완료 (현재 제 ${seasonNumber}회차 ${currDay}일차)`;
    setQuickSyncToast(msg);
    setTimeout(() => setQuickSyncToast(null), 4000);

    void triggerBackgroundSheetsSync({
      teams: currTeams,
      playersMap: currPlayersMap,
      currentDay: currDay,
      matchHistory: nextMatches,
    });
  };

  // Manual trigger for 1-day League Auto Training Camp
  const handleRunLeagueAutoTraining = () => {
    const devResult = autoDevelopAllLeaguePlayers(playersMap, teams, seasonNumber, currentDay, userTeam.id);
    setPlayersMap(devResult.nextPlayersMap);
    if (devResult.growthLogs.length > 0) {
      setGrowthLogs(prev => [...devResult.growthLogs, ...prev].slice(0, 120));
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
    setLeagueNews(prev => [
      {
        id: `news_tr_${Date.now()}`,
        seasonNumber,
        day: currentDay,
        category: 'TRADE' as const,
        title: `🔁 [트레이드] ${userTeam.name} 단장 전격 트레이드 단행`,
        detail: logDesc,
      },
      ...prev,
    ].slice(0, 80));
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
      setLeagueNews(prev => [
        {
          id: `news_aptr_${Date.now()}`,
          seasonNumber,
          day: currentDay,
          category: 'TRADE' as const,
          title: `🔁 [트레이드 성사] ${fromTeam?.name || '구단'} ↔ ${toTeam?.name || '구단'}`,
          detail: desc,
        },
        ...prev,
      ].slice(0, 80));
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
    } else if (approval.category === 'INJURY_REPLACEMENT' && approval.offeredPlayer && approval.targetPlayer) {
      const injured = approval.offeredPlayer;
      const replacement = approval.targetPlayer;
      setPlayersMap(prev => ({
        ...prev,
        [approval.fromTeamId]: (prev[approval.fromTeamId] || []).map(p =>
          p.id === injured.id
            ? { ...p, tier: 'SECOND_TEAM' }
            : p.id === replacement.id
            ? { ...p, tier: 'FIRST_TEAM' }
            : p
        ),
      }));
      setQuickSyncToast(`🚑 ${injured.name} 2군 말소 ↔ ${replacement.name} 1군 대체 콜업 완료!`);
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

  // 6.8 Free Agent & Contract Handlers
  const handleSignFreeAgent = (fa: FreeAgent, offerPrice: number) => {
    const signedPlayer: Player = {
      ...fa.player,
      id: `fa_signed_${userTeam.id}_${Date.now()}`,
      teamId: userTeam.id,
      tier: 'FIRST_TEAM',
    };

    setTeams(prev =>
      prev.map(t => (t.id === userTeam.id ? { ...t, budget: Math.max(0, t.budget - offerPrice) } : t))
    );
    setPlayersMap(prev => ({
      ...prev,
      [userTeam.id]: [signedPlayer, ...(prev[userTeam.id] || [])],
    }));
    setFreeAgents(prev => prev.filter(item => item.id !== fa.id));
    setLeagueNews(prev => [
      {
        id: `news_fa_${Date.now()}`,
        seasonNumber,
        day: currentDay,
        category: 'FA' as const,
        title: `✍️ [FA 영입] ${userTeam.name}, ${fa.player.name}(${fa.player.primaryPosition}) 영입!`,
        detail: `${fa.contractYears}년 총액 ${offerPrice.toLocaleString()}만원 조건으로 계약을 체결하고 즉시 1군에 등록했습니다.`,
      },
      ...prev,
    ].slice(0, 80));
  };

  const handleRefreshFreeAgents = () => {
    setFreeAgents(generateFreeAgentPool(seasonNumber, teams));
    setQuickSyncToast('🔄 새로운 스토브리그 FA 선수 명단을 스카우트했습니다.');
    setTimeout(() => setQuickSyncToast(null), 2600);
  };

  const handleGrantBonusToPlayer = (player: Player, bonusCost: number) => {
    setTeams(prev =>
      prev.map(t => (t.id === userTeam.id ? { ...t, budget: Math.max(0, t.budget - bonusCost) } : t))
    );
    setPlayersMap(prev => ({
      ...prev,
      [userTeam.id]: (prev[userTeam.id] || []).map(p =>
        p.id === player.id ? { ...p, condition: 100, exp: p.exp + 120 } : p
      ),
    }));
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

  // 9. Advance to Next Season, Compute Awards & Crown Champion
  const handleAdvanceNextSeason = (championTeamId: string) => {
    const championTeam = teams.find(t => t.id === championTeamId);
    const nextHistoricalChampions = championTeam
      ? [
          ...historicalChampions.filter(h => h.seasonNumber !== seasonNumber),
          { seasonNumber, champion: championTeam.name },
        ].sort((a, b) => a.seasonNumber - b.seasonNumber)
      : historicalChampions;
    setHistoricalChampions(nextHistoricalChampions);

    // 시즌 어워드 (MVP, 신인왕, 타격·투구 타이틀, 골든글러브) 자동 결산
    const awardRecord = computeSeasonAwards(
      seasonNumber,
      championTeam?.name || userTeam.name,
      teams,
      playersMap
    );
    setSeasonAwards(prev => [
      ...prev.filter(a => a.seasonNumber !== seasonNumber),
      awardRecord,
    ]);
    setLeagueNews(prev => [
      {
        id: `news_award_${seasonNumber}_${Date.now()}`,
        seasonNumber,
        day: currentDay,
        category: 'AWARD' as const,
        title: `🏆 제 ${seasonNumber}회차 결산! 우승 ${championTeam?.name || '-'} · MVP ${awardRecord.mvp.playerName}`,
        detail: `신인왕: ${awardRecord.rookieOfYear.playerName}(${awardRecord.rookieOfYear.teamName}) · 홈런왕: ${awardRecord.homeRunKing.playerName} · 다승왕: ${awardRecord.winsKing.playerName}`,
      },
      ...prev,
    ].slice(0, 80));

    const nextTeams = teams.map(t => ({
      ...t,
      championships: t.id === championTeamId ? t.championships + 1 : t.championships,
      wins: 0,
      losses: 0,
      draws: 0,
      runsScored: 0,
      runsAllowed: 0,
    }));
    setTeams(nextTeams);

    // Reset seasonal counting stats while keeping player attributes, names, positions, levels
    const nextSeasonPlayersMap: Record<string, Player[]> = {};
    Object.keys(playersMap).forEach(tid => {
      nextSeasonPlayersMap[tid] = playersMap[tid].map(p => ({
        ...p,
        age: p.age + 1,
        isInjured: false,
        injuryDays: 0,
        condition: 90,
        currentStamina: 100,
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
    setPlayersMap(nextSeasonPlayersMap);

    const nextSeason = seasonNumber + 1;
    setProspects(generateDraftProspects());
    setFreeAgents(generateFreeAgentPool(nextSeason, nextTeams));
    setSeasonNumber(nextSeason);
    setCurrentDay(1);
    setPostseasonState(null);

    void triggerBackgroundSheetsSync({
      teams: nextTeams,
      playersMap: nextSeasonPlayersMap,
      seasonNumber: nextSeason,
      currentDay: 1,
      historicalChampions: nextHistoricalChampions,
    });
  };

  // 9.5 Postseason Bracket Controls
  const handleStartPostseason = (sortedTeams: Team[]) => {
    setPostseasonState(createPostseasonBracket(sortedTeams, seasonNumber));
  };

  const handleSimulatePostseasonGame = () => {
    setPostseasonState(prev => (prev ? simulatePostseasonNextGame(prev, teams, playersMap) : null));
  };

  const handleSimulatePostseasonSeries = () => {
    setPostseasonState(prev => {
      if (!prev || prev.championTeamId) return prev;
      let curr = prev;
      const startRound = curr.currentRoundIndex;
      let guard = 0;
      while (!curr.championTeamId && curr.currentRoundIndex === startRound && guard < 10) {
        curr = simulatePostseasonNextGame(curr, teams, playersMap);
        guard += 1;
      }
      return curr;
    });
  };

  const handleSimulateFullPostseason = () => {
    setPostseasonState(prev => {
      if (!prev || prev.championTeamId) return prev;
      let curr = prev;
      let guard = 0;
      while (!curr.championTeamId && guard < 30) {
        curr = simulatePostseasonNextGame(curr, teams, playersMap);
        guard += 1;
      }
      return curr;
    });
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
        onQuickPullSheets={handleQuickPullSheets}
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

      {/* Offline Status Toast */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-xs font-semibold py-1.5 px-3">
          오프라인 상태입니다 · 모든 진행 상황은 현재 기기에 자동 저장됩니다.
        </div>
      )}

      {/* Quick Sync Notification Toast */}
      {quickSyncToast && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 bg-sky-900 border border-sky-400 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl max-w-[calc(100vw-2rem)]">
          {quickSyncToast}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-20 lg:pb-8">
        {activeTab === 'DASHBOARD' && (
          <DashboardView
            userTeam={userTeam}
            allTeams={teams}
            roster={userRoster}
            opponentTeam={currentOpponent}
            onStartMatch={handleStartMatch}
            onNavigateTo={setActiveTab}
            onOpenTeamSelect={() => setShowTeamSelectModal(true)}
            hasWebhookUrl={Boolean(webhookUrl)}
            onQuickSyncSheets={handleQuickSyncSheets}
            onQuickPullSheets={handleQuickPullSheets}
            seasonNumber={seasonNumber}
            currentDay={currentDay}
            allPlayers={playersMap}
            matchHistory={matchHistory}
            leagueNews={leagueNews}
            autoSheetsSync={autoSheetsSync}
            onToggleAutoSheetsSync={() => setAutoSheetsSync(prev => !prev)}
            autoClubAssist={autoClubAssist}
            onToggleAutoClubAssist={() => setAutoClubAssist(prev => !prev)}
            autoTrainingEnabled={autoTrainingEnabled}
            onToggleAutoTraining={() => setAutoTrainingEnabled(prev => !prev)}
            onSimulateMultipleDays={handleSimulateMultipleDays}
            cloudNewerNotice={
              cloudNewerNotice
                ? { seasonNumber: cloudNewerNotice.seasonNumber, currentDay: cloudNewerNotice.currentDay }
                : null
            }
            onAcceptCloudSave={() => {
              if (!cloudNewerNotice) return;
              handleApplyPulledSheetData(cloudNewerNotice.data);
              setQuickSyncToast(
                `☁️ 제 ${cloudNewerNotice.seasonNumber}회차 ${cloudNewerNotice.currentDay}일차 구글 시트 최신 기록을 불러왔습니다!`
              );
              setCloudNewerNotice(null);
              setTimeout(() => setQuickSyncToast(null), 3500);
            }}
            onDismissCloudNotice={() => setCloudNewerNotice(null)}
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

        {activeTab === 'ANALYSIS' && (
          <MatchAnalysisView
            userTeam={userTeam}
            allTeams={teams}
            userRoster={userRoster}
            allPlayers={playersMap}
            matchHistory={matchHistory}
            seasonNumber={seasonNumber}
            currentDay={currentDay}
            onUpdateTeam={(updatedTeam) => {
              setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
            }}
            onUpdateTeamRoster={(teamId, updatedRoster) => {
              setPlayersMap(prev => ({ ...prev, [teamId]: updatedRoster }));
            }}
            onQueueTradeApproval={(approval) => {
              setPendingApprovals(prev => [approval, ...prev]);
              setShowApprovalModal(true);
            }}
            onOpenPlayerDetail={setInspectingPlayer}
            onStartMatch={handleStartMatch}
          />
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

        {activeTab === 'FA' && (
          <FreeAgentView
            userTeam={userTeam}
            userRoster={userRoster}
            freeAgents={freeAgents}
            seasonNumber={seasonNumber}
            onSignFreeAgent={handleSignFreeAgent}
            onRefreshFreeAgents={handleRefreshFreeAgents}
            onGrantBonusToPlayer={handleGrantBonusToPlayer}
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
            postseasonState={postseasonState}
            seasonAwards={seasonAwards}
            onStartPostseason={handleStartPostseason}
            onSimulatePostseasonGame={handleSimulatePostseasonGame}
            onSimulatePostseasonSeries={handleSimulatePostseasonSeries}
            onSimulateFullPostseason={handleSimulateFullPostseason}
            onResetPostseason={() => setPostseasonState(null)}
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
