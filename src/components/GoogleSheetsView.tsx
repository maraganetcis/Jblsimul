/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Copy,
  Check,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  CloudDownload,
  ClipboardPaste,
  Info,
  Wifi,
  ShieldAlert,
  FileJson,
} from 'lucide-react';
import {
  SAMPLE_APPS_SCRIPT_CODE,
  validateWebhookUrl,
  testAppsScriptConnection,
  sendPayloadToGoogleAppsScript,
  fetchPayloadFromGoogleAppsScript,
  parseSheetDataPayload,
  downloadBattersCsv,
  downloadPitchersCsv,
  downloadAllBattersCsv,
  downloadAllPitchersCsv,
  downloadJsonBackup,
  parseSpreadsheetText,
  applyImportedPlayersToMap,
  PulledSheetSyncData,
  GameExportPayload,
} from '../utils/appsScriptGenerator';
import { Team, Player, HistorySeason, MatchRecord } from '../types/baseball';

interface GoogleSheetsViewProps {
  userTeam: Team;
  allTeams: Team[];
  userRoster: Player[];
  allPlayers: Record<string, Player[]>;
  seasonNumber: number;
  currentDay: number;
  historicalChampions: HistorySeason[];
  tradeLogs: Array<{ date: string; description: string }>;
  draftLogs: Array<{ round: number; pickNumber: number; teamName: string; playerName: string; position: string; school: string }>;
  matchHistory?: MatchRecord[];
  webhookUrl: string;
  onSaveWebhookUrl: (url: string) => void;
  onRestoreBackup: (payload: GameExportPayload) => void;
  onApplyPulledSheetData: (data: PulledSheetSyncData) => void;
  onImportPlayersAndLeague: (updates: {
    nextPlayersMap?: Record<string, Player[]>;
    nextSeasonNumber?: number;
    nextChampions?: HistorySeason[];
    teamUpdates?: Array<{ name: string; owner?: string; homeStadium?: string; foundedYear?: number; championships?: number }>;
  }) => void;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  userTeam,
  allTeams,
  userRoster,
  allPlayers,
  seasonNumber,
  currentDay,
  historicalChampions,
  tradeLogs,
  draftLogs,
  matchHistory = [],
  webhookUrl,
  onSaveWebhookUrl,
  onRestoreBackup,
  onApplyPulledSheetData,
  onImportPlayersAndLeague,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [urlInput, setUrlInput] = useState(webhookUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string; date?: string } | null>(null);

  // CSV / TSV / JSON Direct Paste & File Import State
  const [pasteText, setPasteText] = useState('');
  const [defaultImportTeamId, setDefaultImportTeamId] = useState(userTeam.id);
  const [importMode, setImportMode] = useState<'SYNC_AND_ADD' | 'REPLACE_TEAMS' | 'APPEND'>('SYNC_AND_ADD');

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrlInput(webhookUrl);
  }, [webhookUrl]);

  const urlValidation = urlInput.trim() ? validateWebhookUrl(urlInput) : null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(SAMPLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveUrl = () => {
    const clean = urlInput.trim();
    onSaveWebhookUrl(clean);
    if (clean) {
      const check = validateWebhookUrl(clean);
      if (!check.valid) {
        setSyncStatus({
          type: 'ERROR',
          message: `URL은 저장되었으나 형식이 올바르지 않습니다: ${check.reason}`,
        });
        return;
      }
    }
    setSyncStatus({
      type: 'SUCCESS',
      message: '웹앱 Webhook URL이 브라우저에 저장되었습니다. [연결 테스트] 버튼으로 실제 통신을 확인해보세요.',
    });
  };

  const buildPayload = (): GameExportPayload => ({
    exportDate: new Date().toLocaleString('ko-KR'),
    seasonNumber,
    currentDay,
    userTeam,
    allTeams,
    userRoster,
    allPlayers,
    historicalChampions,
    tradeLogs,
    draftLogs,
    matchHistory,
  });

  const handleCopyFullJson = () => {
    const payload = buildPayload();
    navigator.clipboard.writeText(JSON.stringify(payload));
    setCopiedJson(true);
    setSyncStatus({
      type: 'SUCCESS',
      message:
        '전체 리그 JSON이 클립보드에 복사되었습니다! 구글 시트 상단 메뉴 [⚾ JBL 리그 매니저 → 📥 게임 JSON 붙여넣어 시트 전체 갱신]에 붙여넣으면 웹앱 차단 없이 100% 시트가 업데이트됩니다.',
      date: new Date().toLocaleTimeString('ko-KR'),
    });
    setTimeout(() => setCopiedJson(false), 3000);
  };

  const handleTestConnection = async () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setSyncStatus({ type: 'ERROR', message: '먼저 배포된 Google Apps Script 웹앱 URL(/exec)을 입력해주세요.' });
      return;
    }

    onSaveWebhookUrl(cleanUrl);
    setIsTesting(true);
    setSyncStatus(null);

    const result = await testAppsScriptConnection(cleanUrl);
    setIsTesting(false);
    setSyncStatus({
      type: result.success ? 'SUCCESS' : 'ERROR',
      message: result.message,
      date: result.success ? new Date().toLocaleTimeString('ko-KR') : undefined,
    });
  };

  // Push -> Google Sheets
  const handleSyncNow = async () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setSyncStatus({ type: 'ERROR', message: '먼저 배포된 Google Apps Script 웹앱 URL(/exec)을 입력해주세요.' });
      return;
    }

    onSaveWebhookUrl(cleanUrl);
    setIsSyncing(true);
    setSyncStatus(null);

    const payload = buildPayload();
    const result = await sendPayloadToGoogleAppsScript(cleanUrl, payload);

    setIsSyncing(false);
    setSyncStatus({
      type: result.success ? 'SUCCESS' : 'ERROR',
      message: result.message,
      date: result.success ? new Date().toLocaleTimeString('ko-KR') : undefined,
    });
  };

  // Pull <- Google Sheets
  const handlePullFromSheets = async () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setSyncStatus({ type: 'ERROR', message: '먼저 배포된 Google Apps Script 웹앱 URL(/exec)을 입력해주세요.' });
      return;
    }

    onSaveWebhookUrl(cleanUrl);
    setIsPulling(true);
    setSyncStatus(null);

    const result = await fetchPayloadFromGoogleAppsScript(cleanUrl, allTeams, allPlayers);
    setIsPulling(false);

    if (result.success && result.data) {
      onApplyPulledSheetData(result.data);
      setSyncStatus({
        type: 'SUCCESS',
        message: result.message,
        date: new Date().toLocaleTimeString('ko-KR'),
      });
    } else {
      setSyncStatus({
        type: 'ERROR',
        message: result.message,
      });
    }
  };

  const downloadMatchesCsv = () => {
    const headers = ['일자,시즌,매치업,원정팀,원정점수,홈팀,홈점수,결과,승리팀,원정안타,홈안타,경기요약'];
    const lines = matchHistory.map(m => {
      const res = m.result === 'WIN' ? '승리' : m.result === 'LOSS' ? '패배' : '무승부';
      return `"${m.day}일차","${m.seasonNumber}회차","${m.awayTeamName} vs ${m.homeTeamName}","${m.awayTeamName}",${m.awayScore},"${m.homeTeamName}",${m.homeScore},"${res}","${m.winningTeamName}",${m.awayHits},${m.homeHits},"${m.summary}"`;
    });
    const csvContent = '\uFEFF' + [headers, ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JBL_전체경기기록_박스스코어.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let json = JSON.parse(event.target?.result as string);
        if (json?.status === 'success' && json?.data) {
          json = json.data;
        }
        if (json.allTeams && json.allPlayers) {
          onRestoreBackup(json);
          setSyncStatus({
            type: 'SUCCESS',
            message: `JSON 백업 복원 완료! (${json.seasonNumber || 26}회차 · 전체 구단 및 선수단 동기화됨)`,
            date: new Date().toLocaleTimeString('ko-KR'),
          });
        } else if (json.meta || json.teams || json.batters || json.pitchers) {
          const parsed = parseSheetDataPayload(json, allTeams, allPlayers);
          onApplyPulledSheetData(parsed);
          setSyncStatus({
            type: 'SUCCESS',
            message: `시트 JSON 데이터 동기화 완료! (${parsed.summaryText} 불러옴)`,
            date: new Date().toLocaleTimeString('ko-KR'),
          });
        } else {
          setSyncStatus({ type: 'ERROR', message: '올바른 JBL 매니저 백업 JSON 파일 형식이 아닙니다.' });
        }
      } catch {
        setSyncStatus({ type: 'ERROR', message: 'JSON 파싱 오류가 발생했습니다.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processImportedSpreadsheetText = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setSyncStatus({ type: 'ERROR', message: '입력된 데이터가 비어 있습니다.' });
      return;
    }

    // 1) JSON 붙여넣기 지원 (시트 메뉴 [현재 시트 -> 게임용 JSON 추출] 또는 백업 JSON)
    if (trimmed.startsWith('{')) {
      try {
        let json = JSON.parse(trimmed);
        if (json?.status === 'success' && json?.data) {
          json = json.data;
        }
        if (json.allTeams && json.allPlayers) {
          onRestoreBackup(json);
          setSyncStatus({
            type: 'SUCCESS',
            message: `전체 리그 JSON 동기화 완료! (${json.seasonNumber || 26}회차 · 전체 구단/선수 반영됨)`,
            date: new Date().toLocaleTimeString('ko-KR'),
          });
          setPasteText('');
          return;
        }
        if (json.meta || json.teams || json.batters || json.pitchers) {
          const parsed = parseSheetDataPayload(json, allTeams, allPlayers);
          onApplyPulledSheetData(parsed);
          setSyncStatus({
            type: 'SUCCESS',
            message: `시트 추출 JSON 동기화 완료! (${parsed.summaryText} 불러옴)`,
            date: new Date().toLocaleTimeString('ko-KR'),
          });
          setPasteText('');
          return;
        }
        setSyncStatus({ type: 'ERROR', message: 'JSON 형식이지만 JBL 리그/시트 데이터 필드를 찾을 수 없습니다.' });
        return;
      } catch {
        setSyncStatus({ type: 'ERROR', message: 'JSON 형식이 올바르지 않습니다. 전체 중괄호({ ... })를 빠짐없이 복사했는지 확인해주세요.' });
        return;
      }
    }

    // 2) CSV / TSV 표 붙여넣기 지원
    const defaultTeam = allTeams.find(t => t.id === defaultImportTeamId) || userTeam;
    const parsed = parseSpreadsheetText(rawText, defaultTeam.name);

    if (parsed.kind === 'UNKNOWN') {
      setSyncStatus({ type: 'ERROR', message: parsed.message });
      return;
    }

    if (parsed.kind === 'JBL_LEAGUE_CSV') {
      onImportPlayersAndLeague({
        nextSeasonNumber: parsed.detectedSeasonNumber,
        nextChampions: parsed.detectedChampions,
        teamUpdates: parsed.teamUpdates,
      });
      setSyncStatus({
        type: 'SUCCESS',
        message: parsed.message,
        date: new Date().toLocaleTimeString('ko-KR'),
      });
      return;
    }

    if (parsed.kind === 'PLAYERS') {
      const { nextMap, updatedCount, addedCount } = applyImportedPlayersToMap(
        allPlayers,
        allTeams,
        defaultTeam.id,
        parsed.players,
        importMode
      );
      onImportPlayersAndLeague({ nextPlayersMap: nextMap });
      setSyncStatus({
        type: 'SUCCESS',
        message: `선수 동기화 완료! (기존 선수 업데이트 ${updatedCount}명 · 신규 선수 추가 ${addedCount}명)`,
        date: new Date().toLocaleTimeString('ko-KR'),
      });
      setPasteText('');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      processImportedSpreadsheetText(text);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="text-xs uppercase tracking-wider text-sky-600 font-bold">
            Google Sheets Two-Way Sync & League Importer
          </span>
          <h2 className="text-xl font-display font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> 구글 스프레드시트 양방향 연동 & 리그 백업 허브
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            전체 10개 구단·선수단 이름/포지션/스탯·현재 리그 회차({seasonNumber}회차)·역대 우승족보·경기 기록을 시트로 저장하고, 시트에서 다시 게임으로 불러와 동기화합니다.
          </p>
        </div>
      </div>

      {/* Original CSV Notice */}
      <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold">초기 업로드된 스프레드시트(JBL) 파일 안내 & 선수 일괄 동기화 방법</p>
          <p className="text-sky-800">
            처음 첨부해주신 CSV 파일에는 <strong>10개 구단 정보와 1~25회 우승 족보 + 26회차</strong> 탭만 저장되어 있어 선수 명단 데이터는 비어 있었습니다.
            실제 구단 선수 이름·포지션·스탯을 반영하려면 아래 <strong>[CSV / 시트 복사-붙여넣기 선수 가져오기]</strong>에 스프레드시트 선수표를 그대로 붙여넣거나, <strong>[구글 시트에서 불러오기]</strong>를 사용하세요!
          </p>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-sm ${
            syncStatus.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncStatus.type === 'SUCCESS' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="leading-relaxed">{syncStatus.message}</span>
          </div>
          {syncStatus.date && (
            <span className="font-mono-numbers text-[11px] text-emerald-700 shrink-0 ml-2">
              {syncStatus.date}
            </span>
          )}
        </div>
      )}

      {/* Webhook URL Input Bar: Test, Push & Pull */}
      <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-display font-bold text-base text-slate-900 mb-1 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-600" /> 구글 스프레드시트 실시간 양방향 동기화 (저장 ↔ 불러오기)
          </h3>
          <p className="text-xs text-slate-500">
            Apps Script v2.1 <strong>웹앱 URL(/exec)</strong>을 연결하면 모든 10개 구단·선수·회차를 구글 시트에 저장(Push)하거나 즉시 불러오기(Pull) 할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2.5">
          <input
            type="text"
            placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 bg-sky-50/50 border border-sky-200 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-mono-numbers focus:outline-none focus:border-sky-500 shadow-inner"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveUrl}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors whitespace-nowrap"
            >
              URL 저장
            </button>
            <button
              onClick={handleTestConnection}
              disabled={isSyncing || isPulling || isTesting}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-800 font-bold text-xs border border-indigo-200 transition-all whitespace-nowrap"
            >
              <Wifi className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? '확인 중...' : '연결 테스트'}
            </button>
            <button
              onClick={handleSyncNow}
              disabled={isSyncing || isPulling || isTesting}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? '저장 중...' : '구글 시트로 저장 (Push)'}
            </button>
            <button
              onClick={handlePullFromSheets}
              disabled={isSyncing || isPulling || isTesting}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all whitespace-nowrap"
            >
              <CloudDownload className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
              {isPulling ? '불러오는 중...' : '구글 시트에서 불러오기 (Pull)'}
            </button>
          </div>
        </div>

        {/* Live URL Validation Warning */}
        {urlValidation?.reason && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              urlValidation.valid
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <ShieldAlert
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                urlValidation.valid ? 'text-amber-600' : 'text-rose-600'
              }`}
            />
            <span className="leading-relaxed font-medium">{urlValidation.reason}</span>
          </div>
        )}

        {/* Troubleshooting & Zero-WebApp School-Safe Menu Fallback */}
        <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              연결이 안 될 때 3가지 필수 체크 & 100% 성공하는 시트 메뉴 연동법
            </h4>
            <button
              onClick={handleCopyFullJson}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors whitespace-nowrap"
            >
              {copiedJson ? <Check className="w-3.5 h-3.5" /> : <FileJson className="w-3.5 h-3.5" />}
              {copiedJson ? '전체 리그 JSON 복사됨!' : '전체 리그 JSON 복사 (시트 메뉴용)'}
            </button>
          </div>
          <ul className="text-[11px] text-slate-700 space-y-1.5 leading-relaxed list-disc pl-4">
            <li>
              <strong>① 시트 주소가 아닌 웹앱 주소(/exec) 입력:</strong>{' '}
              <code className="bg-white px-1 rounded border border-sky-200">docs.google.com/spreadsheets/...</code> 주소가 아니라,
              Apps Script에서 <strong>[배포 → 새 배포 → 웹 앱]</strong> 완료 시 나오는{' '}
              <code className="bg-white px-1 rounded border border-sky-200">https://script.google.com/.../exec</code> 주소를 넣어야 합니다.
            </li>
            <li>
              <strong>② [모든 사용자(Anyone)] 권한 & v2.1 재배포:</strong>{' '}
              코드를 수정했다면 반드시 <strong>[배포 → 배포 관리 → 연필 아이콘 → 버전: 새 버전]</strong>으로 다시 배포해야 반영됩니다.
            </li>
            <li>
              <strong>③ 학교/기관(.ms.kr 등) 계정에서 웹앱이 차단될 때 (100% 우회 해결):</strong>{' '}
              학교 Google Workspace 계정은 보안 정책상 외부 웹앱 통신을 막는 경우가 많습니다. 이때는 위 <strong>[전체 리그 JSON 복사]</strong>를 누른 뒤,
              아래 <strong>v2.1 코드</strong>가 들어있는 구글 시트를 새로고침(F5)하면 상단에 생기는{' '}
              <strong className="text-sky-800">[⚾ JBL 리그 매니저 → 📥 게임 JSON 붙여넣어 시트 전체 갱신]</strong> 메뉴에 붙여넣으세요! (반대로 시트에서 추출한 JSON을 아래 입력창에 붙여넣으면 게임으로 불러와집니다.)
            </li>
          </ul>
        </div>
      </div>

      {/* Spreadsheet Paste / CSV / JSON Direct Importer */}
      <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-sky-600" /> 스프레드시트(CSV / 표 / JSON 복사-붙여넣기) 선수·리그 동기화
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              구글 시트 표를 복사(Ctrl+C)해 붙여넣거나, 시트 상단 <strong>[⚾ JBL 리그 매니저 → 📤 현재 시트 → 게임용 JSON 추출]</strong> 결과를 붙여넣으면 즉시 게임에 반영됩니다.
            </p>
          </div>
          <div>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.json"
              onChange={handleCsvFileUpload}
              className="hidden"
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs border border-sky-200 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> CSV / TSV / JSON 파일 업로드
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="block">
            <span className="font-bold text-slate-700 block mb-1">구단명 열이 없을 때 기본 소속 구단</span>
            <select
              value={defaultImportTeamId}
              onChange={(e) => setDefaultImportTeamId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/50 font-bold text-slate-800"
            >
              {allTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-bold text-slate-700 block mb-1">표(CSV/TSV) 동기화 반영 방식</span>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'SYNC_AND_ADD' | 'REPLACE_TEAMS' | 'APPEND')}
              className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-sky-50/50 font-bold text-slate-800"
            >
              <option value="SYNC_AND_ADD">동기화 + 추가 (동일 이름 선수 업데이트, 새 선수 추가)</option>
              <option value="REPLACE_TEAMS">해당 구단 명단 교체 (시트 명단으로 통째 덮어쓰기)</option>
              <option value="APPEND">신규 선수로 모두 추가</option>
            </select>
          </label>
        </div>

        <textarea
          rows={5}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={`1) 구글 시트에서 선수 표 영역을 드래그해 복사(Ctrl+C) 후 붙여넣기 (CSV / 탭 TSV 자동 인식)\n2) 또는 시트 메뉴 [⚾ JBL 리그 매니저 -> 현재 시트 JSON 추출]에서 복사한 { ... } JSON 붙여넣기\n\n예시:\n구단명, 이름, 포지션, 1군/2군, 나이, 잠재력, 컨택, 파워, 선구안, 주력, 수비\n난하 지도, 김도영, 3B, 1군, 22, S, 88, 86, 80, 92, 82`}
          className="w-full bg-sky-50/40 border border-sky-200 rounded-xl p-3 text-xs font-mono-numbers text-slate-800 focus:outline-none focus:border-sky-500"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            지원 헤더: 구단명, 이름(선수명), 포지션(선발/불펜/마무리/포수/유격수 또는 SP/C/SS 등), 역할(투수/타자), 1군/2군, 나이, 잠재력, 컨택·파워·구속·제구·구위·타석·안타·홈런·이닝·승·패·ERA 등
          </span>
          <button
            onClick={() => processImportedSpreadsheetText(pasteText)}
            disabled={!pasteText.trim()}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-colors"
          >
            붙여넣은 선수/리그 데이터 즉시 적용
          </button>
        </div>
      </div>

      {/* Offline Full League JSON Backup & All-Teams CSV Export */}
      <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
              <Download className="w-4 h-4 text-sky-600" /> 전체 리그 JSON 백업 저장·불러오기 & 구단별 CSV 내보내기
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              10개 구단 전체 기록, 모든 선수 명단, 현재 회차({seasonNumber}회차), 경기 박스스코어를 JSON 파일로 통째 저장하고 언제든 불러와 동기화하세요.
            </p>
          </div>
          <div>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              onChange={handleJsonFileUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => downloadJsonBackup(buildPayload())}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs text-amber-900 font-bold transition-colors"
          >
            <Download className="w-4 h-4 text-amber-600" />
            전체 리그 JSON 저장
          </button>

          <button
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs text-white font-bold shadow-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            JSON 백업 불러오기 (복원)
          </button>

          <button
            onClick={() => downloadAllBattersCsv(allTeams, allPlayers)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50/60 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            전체 구단 타자 CSV
          </button>

          <button
            onClick={() => downloadAllPitchersCsv(allTeams, allPlayers)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50/60 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-sky-600" />
            전체 구단 투수 CSV
          </button>

          <button
            onClick={() => downloadBattersCsv(userRoster, `${userTeam.name}_타자명단.csv`)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            내 구단 타자 CSV
          </button>

          <button
            onClick={() => downloadPitchersCsv(userRoster, `${userTeam.name}_투수명단.csv`)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-sky-600" />
            내 구단 투수 CSV
          </button>

          <button
            onClick={downloadMatchesCsv}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold transition-colors sm:col-span-2"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            전체 리그 경기 박스스코어 CSV 다운로드
          </button>
        </div>
      </div>

      {/* Step by Step Setup Guide (3 Steps) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center mb-3">1</span>
            <h4 className="font-display font-bold text-sm text-slate-900 mb-1">구글 시트 생성 & Apps Script 열기</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-sky-600 font-bold underline inline-flex items-center gap-0.5">
                Google Sheets<ExternalLink className="w-3 h-3 inline" />
              </a>에서 상단 메뉴 <strong>[확장 프로그램] &rarr; [Apps Script]</strong>를 엽니다.
            </p>
          </div>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center mb-3">2</span>
            <h4 className="font-display font-bold text-sm text-slate-900 mb-1">양방향 Code.gs v2.1 붙여넣기</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              아래 <strong>v2.1 스크립트</strong>를 복사해 붙여넣고 저장(Ctrl+S)합니다. (웹앱 Push/Pull + 시트 내 전용 메뉴 모두 포함)
            </p>
          </div>
          <button
            onClick={handleCopyCode}
            className="mt-4 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-xs font-bold text-sky-800 border border-sky-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '클립보드에 복사 완료!' : 'Apps Script v2.1 전체 복사'}
          </button>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center mb-3">3</span>
            <h4 className="font-display font-bold text-sm text-slate-900 mb-1">웹앱 배포 (/exec URL 복사)</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>[배포] &rarr; [새 배포] &rarr; [웹 앱]</strong>에서 액세스 권한을 <strong>[모든 사용자 (Anyone)]</strong>로 설정하고 발급된 <strong>/exec URL</strong>을 위에 입력하세요. (학교 계정은 시트 메뉴 방식 권장)
            </p>
          </div>
        </div>
      </div>

      {/* Copyable Script Viewer */}
      <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
          <span className="text-xs font-display font-bold text-sky-900">
            Google Apps Script v2.1 전체 리그 양방향 동기화 코드 (Code.gs)
          </span>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-sm transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사됨!' : '원클릭 복사'}
          </button>
        </div>
        <pre className="p-4 bg-slate-900 text-slate-200 font-mono text-[11px] max-h-72 overflow-y-auto leading-relaxed selection:bg-sky-500 selection:text-white rounded-b-2xl">
          {SAMPLE_APPS_SCRIPT_CODE}
        </pre>
      </div>
    </div>
  );
};
