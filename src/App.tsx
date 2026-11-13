/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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

import { Team, Player, LiveGameState, ScheduleItem, DraftProspect, HistorySeason, MatchRecord } from './types/baseball';
import { INITIAL_JBL_TEAMS, JBL_HISTORICAL_CHAMPIONS, generateAllLeaguePlayers, generateDraftProspects } from './data/initialLeagueData';
import { createNewGame } from './utils/simulationEngine';
import { sendPayloadToGoogleAppsScript, GameExportPayload } from './utils/appsScriptGenerator';

const SAVE_KEY = 'jbl_baseball_manager_save_v1';
const WEBHOOK_KEY = 'jbl_sheets_webhook_url';

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
  const [historicalChampions] = useState<HistorySeason[]>(JBL_HISTORICAL_CHAMPIONS);

  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [showTeamSelectModal, setShowTeamSelectModal] = useState<boolean>(false);
  const [inspectingPlayer, setInspectingPlayer] = useState<Player | null>(null);

  // Active Live Game State
  const [liveGame, setLiveGame] = useState<LiveGameState | null>(null);
  const [quickSyncToast, setQuickSyncToast] = useState<string | null>(null);

  // 1. Load from localStorage
  useEffect(() => {
    try {
      const savedUrl = localStorage.getItem(WEBHOOK_KEY);
      if (savedUrl) setWebhookUrl(savedUrl);

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
        }
      } else {
        // First time launch: prompt team selector
        setShowTeamSelectModal(true);
      }
    } catch (e) {
      console.warn('Failed to load local storage save:', e);
    }
  }, []);

  const userTeam = teams.find(t => t.id === selectedTeamId) || teams[0];
  const userRoster = playersMap[userTeam.id] || [];

  // Next Opponent selection based on schedule
  const otherTeams = teams.filter(t => t.id !== userTeam.id);
  const currentOpponent = otherTeams[(currentDay - 1) % otherTeams.length];

  // 2. Save Game State
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
    setQuickSyncToast('Google Apps Script로 동기화 전송 중...');
    const payload: GameExportPayload = {
      exportDate: new Date().toLocaleString('ko-KR'),
      seasonNumber,
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
    setTimeout(() => setQuickSyncToast(null), 3000);
  };

  // 4. Start Match
  const handleStartMatch = () => {
    const opponentRoster = playersMap[currentOpponent.id] || [];
    const newGame = createNewGame(currentOpponent, userTeam, opponentRoster, userRoster);
    setLiveGame(newGame);
    setActiveTab('LIVE_GAME');
  };

  // 5. Finish Match & Apply Stats
  const handleFinishMatch = (finalState: LiveGameState) => {
    const awayWon = finalState.score.away > finalState.score.home;
    const homeWon = finalState.score.home > finalState.score.away;
    const isDraw = finalState.score.away === finalState.score.home;

    // Update Team Records
    const updatedTeams = teams.map(t => {
      if (t.id === finalState.awayTeam.id) {
        return {
          ...t,
          wins: t.wins + (awayWon ? 1 : 0),
          losses: t.losses + (homeWon ? 1 : 0),
          draws: t.draws + (isDraw ? 1 : 0),
          runsScored: t.runsScored + finalState.score.away,
          runsAllowed: t.runsAllowed + finalState.score.home,
          budget: t.budget + (awayWon ? 2000 : 800), // 승리 수당
        };
      }
      if (t.id === finalState.homeTeam.id) {
        return {
          ...t,
          wins: t.wins + (homeWon ? 1 : 0),
          losses: t.losses + (awayWon ? 1 : 0),
          draws: t.draws + (isDraw ? 1 : 0),
          runsScored: t.runsScored + finalState.score.home,
          runsAllowed: t.runsAllowed + finalState.score.away,
          budget: t.budget + (homeWon ? 2000 : 800),
        };
      }
      return t;
    });

    const isUserHome = userTeam.id === finalState.homeTeam.id;
    const userScore = isUserHome ? finalState.score.home : finalState.score.away;
    const oppScore = isUserHome ? finalState.score.away : finalState.score.home;
    const matchResult = userScore > oppScore ? 'WIN' : userScore < oppScore ? 'LOSS' : 'DRAW';
    const winTeamName = finalState.winningTeamId === finalState.homeTeam.id
      ? finalState.homeTeam.name
      : finalState.winningTeamId === finalState.awayTeam.id
      ? finalState.awayTeam.name
      : '무승부';

    const newRecord: MatchRecord = {
      id: `match_${Date.now()}`,
      day: currentDay,
      seasonNumber,
      dateStr: new Date().toLocaleDateString('ko-KR'),
      awayTeamName: finalState.awayTeam.name,
      homeTeamName: finalState.homeTeam.name,
      awayScore: finalState.score.away,
      homeScore: finalState.score.home,
      result: matchResult,
      winningTeamName: winTeamName,
      awayHits: finalState.hits.away,
      homeHits: finalState.hits.home,
      awayErrors: finalState.errors.away,
      homeErrors: finalState.errors.home,
      summary: `${finalState.awayTeam.name} ${finalState.score.away} : ${finalState.score.home} ${finalState.homeTeam.name} (${finalState.inning}이닝 경기)`,
    };

    setMatchHistory(prev => [newRecord, ...prev]);
    setTeams(updatedTeams);
    setCurrentDay(prev => prev + 1);
    setLiveGame(null);
    setActiveTab('DASHBOARD');
    handleSaveGame();
  };

  // 6. Handle Trade Execution
  const handleExecuteTrade = (myPlayer: Player, theirPlayer: Player, theirTeamId: string, logDesc: string) => {
    const updatedUserRoster = userRoster.map(p => p.id === myPlayer.id ? { ...theirPlayer, teamId: userTeam.id } : p);
    const theirRoster = (playersMap[theirTeamId] || []).map(p => p.id === theirPlayer.id ? { ...myPlayer, teamId: theirTeamId } : p);

    const newPlayersMap = {
      ...playersMap,
      [userTeam.id]: updatedUserRoster,
      [theirTeamId]: theirRoster,
    };

    setPlayersMap(newPlayersMap);
    setTradeLogs(prev => [
      { date: `${seasonNumber}회차 ${currentDay}일`, description: logDesc },
      ...prev,
    ]);
    handleSaveGame();
  };

  // 7. Handle Draft Pick
  const handleDraftPlayer = (prospect: DraftProspect, draftingTeam: Team, round: number, pickNumber: number) => {
    const draftedPlayer: Player = {
      ...prospect.playerData,
      id: `p_${draftingTeam.id}_${Date.now()}`,
      teamId: draftingTeam.id,
      tier: 'SECOND_TEAM',
    };

    const teamRoster = playersMap[draftingTeam.id] || [];
    const newTeamRoster = [...teamRoster, draftedPlayer];

    setPlayersMap(prev => ({
      ...prev,
      [draftingTeam.id]: newTeamRoster,
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
    handleSaveGame();
  };

  // 8. Restore from JSON Backup
  const handleRestoreBackup = (payload: GameExportPayload) => {
    if (payload.allTeams) setTeams(payload.allTeams);
    if (payload.userTeam) setSelectedTeamId(payload.userTeam.id);
    if (payload.allPlayers) setPlayersMap(payload.allPlayers);
    if (payload.seasonNumber) setSeasonNumber(payload.seasonNumber);
    if (payload.tradeLogs) setTradeLogs(payload.tradeLogs);
    if (payload.draftLogs) setDraftLogs(payload.draftLogs);
    handleSaveGame();
  };

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
      />

      {/* Quick Sync Notification Toast */}
      {quickSyncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-sky-900 border border-sky-400 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl animate-fade-in">
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
            roster={userRoster}
            onUpdateRoster={(newRoster) => {
              setPlayersMap(prev => ({ ...prev, [userTeam.id]: newRoster }));
              handleSaveGame();
            }}
            onOpenPlayerDetail={setInspectingPlayer}
          />
        )}

        {activeTab === 'TRAINING' && (
          <TrainingView
            userTeam={userTeam}
            roster={userRoster}
            onUpdateTeam={(newTeam) => {
              setTeams(prev => prev.map(t => t.id === newTeam.id ? newTeam : t));
              handleSaveGame();
            }}
            onUpdateRoster={(newRoster) => {
              setPlayersMap(prev => ({ ...prev, [userTeam.id]: newRoster }));
              handleSaveGame();
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
          />
        )}

        {activeTab === 'SHEETS' && (
          <GoogleSheetsView
            userTeam={userTeam}
            allTeams={teams}
            userRoster={userRoster}
            allPlayers={playersMap}
            seasonNumber={seasonNumber}
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
          handleSaveGame();
        }}
        onClose={() => setShowTeamSelectModal(false)}
      />

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={inspectingPlayer}
        team={userTeam}
        onClose={() => setInspectingPlayer(null)}
      />
    </div>
  );
}
