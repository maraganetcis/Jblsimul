/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileSpreadsheet, Copy, Check, ExternalLink, Download, Upload, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { SAMPLE_APPS_SCRIPT_CODE, sendPayloadToGoogleAppsScript, downloadBattersCsv, downloadPitchersCsv, downloadJsonBackup, GameExportPayload } from '../utils/appsScriptGenerator';
import { Team, Player, HistorySeason, MatchRecord } from '../types/baseball';

interface GoogleSheetsViewProps {
  userTeam: Team;
  allTeams: Team[];
  userRoster: Player[];
  allPlayers: Record<string, Player[]>;
  seasonNumber: number;
  historicalChampions: HistorySeason[];
  tradeLogs: Array<{ date: string; description: string }>;
  draftLogs: Array<{ round: number; pickNumber: number; teamName: string; playerName: string; position: string; school: string }>;
  matchHistory?: MatchRecord[];
  webhookUrl: string;
  onSaveWebhookUrl: (url: string) => void;
  onRestoreBackup: (payload: GameExportPayload) => void;
}

export const GoogleSheetsView: React.FC<GoogleSheetsViewProps> = ({
  userTeam,
  allTeams,
  userRoster,
  allPlayers,
  seasonNumber,
  historicalChampions,
  tradeLogs,
  draftLogs,
  matchHistory = [],
  webhookUrl,
  onSaveWebhookUrl,
  onRestoreBackup,
}) => {
  const [copied, setCopied] = useState(false);
  const [urlInput, setUrlInput] = useState(webhookUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string; date?: string } | null>(null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(SAMPLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveUrl = () => {
    onSaveWebhookUrl(urlInput.trim());
    setSyncStatus({
      type: 'SUCCESS',
      message: '웹앱 Webhook URL이 브라우저에 안전하게 저장되었습니다.',
    });
  };

  const buildPayload = (): GameExportPayload => ({
    exportDate: new Date().toLocaleString('ko-KR'),
    seasonNumber,
    userTeam,
    allTeams,
    userRoster,
    allPlayers,
    historicalChampions,
    tradeLogs,
    draftLogs,
    matchHistory,
  });

  const handleSyncNow = async () => {
    if (!urlInput.trim()) {
      alert('먼저 배포된 Google Apps Script 웹앱 URL을 입력해주세요.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus(null);

    const payload = buildPayload();
    const result = await sendPayloadToGoogleAppsScript(urlInput.trim(), payload);

    setIsSyncing(false);
    if (result.success) {
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
    a.download = `JBL_경기기록_박스스코어.csv`;
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
        const json = JSON.parse(event.target?.result as string);
        if (json.userTeam && json.allTeams) {
          onRestoreBackup(json);
          alert('성공적으로 백업 파일의 리그 데이터를 복원하였습니다!');
        } else {
          alert('올바른 JBL 매니저 백업 JSON 파일 형식이 아닙니다.');
        }
      } catch (err) {
        alert('JSON 파싱 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-sky-600 font-bold">Google Workspace & Apps Script Integration</span>
          </div>
          <h2 className="text-xl font-display font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> 구글 스프레드시트(Google Sheets) & 앱스스크립트 연동 허브
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Google Apps Script 웹앱을 통해 게임 내 선수단 스탯, 경기 결과 박스스코어, 리그 순위표가 구글 시트에 7개의 탭으로 실시간 자동 전송됩니다.
          </p>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-sm ${
          syncStatus.type === 'SUCCESS'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {syncStatus.type === 'SUCCESS' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span>{syncStatus.message}</span>
          </div>
          {syncStatus.date && (
            <span className="font-mono-numbers text-[11px] text-emerald-700">
              최근 동기화: {syncStatus.date}
            </span>
          )}
        </div>
      )}

      {/* Webhook URL Input Bar & Instant Sync */}
      <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm">
        <h3 className="font-display font-bold text-base text-slate-900 mb-2 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-sky-600" /> 구글 스프레드시트 실시간 동기화 (Webhook Sync)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          아래에 Apps Script 배포 시 발급받은 웹앱 URL을 입력하고 [지금 동기화]를 누르면, 구글 시트에 7개의 전용 탭이 자동 생성되며 최신 데이터로 채워집니다.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="flex-1 bg-sky-50/50 border border-sky-200 text-slate-800 px-4 py-2.5 rounded-xl text-xs font-mono-numbers focus:outline-none focus:border-sky-500 shadow-inner"
          />
          <button
            onClick={handleSaveUrl}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors whitespace-nowrap"
          >
            URL 저장
          </button>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '동기화 전송 중...' : '구글 시트 즉시 동기화 (Sync Now)'}
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
              새 <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-sky-600 font-bold underline inline-flex items-center gap-0.5">Google Sheets<ExternalLink className="w-3 h-3 inline" /></a>를 열고, 상단 메뉴의 <strong>[확장 프로그램] &rarr; [Apps Script]</strong>를 클릭합니다.
            </p>
          </div>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center mb-3">2</span>
            <h4 className="font-display font-bold text-sm text-slate-900 mb-1">스크립트 코드 복사 & 붙여넣기</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              기존 코드를 지우고, 아래의 <strong>[Apps Script 전체 코드 복사]</strong> 버튼을 눌러 복사한 코드를 그대로 붙여넣고 저장합니다.
            </p>
          </div>
          <button
            onClick={handleCopyCode}
            className="mt-4 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-xs font-bold text-sky-800 border border-sky-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '클립보드에 복사 완료!' : 'Apps Script 전체 코드 복사'}
          </button>
        </div>

        <div className="bg-white border border-sky-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <span className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center mb-3">3</span>
            <h4 className="font-display font-bold text-sm text-slate-900 mb-1">웹앱 배포 후 URL 연동</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              우측 상단 <strong>[배포] &rarr; [새 배포] &rarr; [웹 앱]</strong> 선택 후, 액세스 권한을 <strong>[모든 사용자 (Anyone)]</strong>로 설정하여 생성된 웹앱 URL을 위 칸에 붙여넣습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Copyable Script Viewer */}
      <div className="bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-sky-50/70 px-5 py-3 border-b border-sky-100 flex items-center justify-between">
          <span className="text-xs font-display font-bold text-sky-900">
            Google Apps Script 배포 코드 (Code.gs)
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

      {/* Offline Backup & CSV Export Section */}
      <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm">
        <h3 className="font-display font-bold text-sm text-slate-800 mb-2 flex items-center gap-2">
          <Download className="w-4 h-4 text-sky-600" /> 오프라인 엑셀 CSV & 백업 파일 관리
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Google Apps Script 연동 외에도 엑셀에서 바로 열 수 있는 UTF-8 BOM CSV 파일이나 전체 게임 백업 JSON을 다운로드할 수 있습니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => downloadBattersCsv(userRoster)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50/60 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            타자 명단 CSV 다운로드
          </button>

          <button
            onClick={() => downloadPitchersCsv(userRoster)}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50/60 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-sky-600" />
            투수 명단 CSV 다운로드
          </button>

          <button
            onClick={downloadMatchesCsv}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50/60 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            경기 기록 CSV 다운로드
          </button>

          <button
            onClick={() => downloadJsonBackup(buildPayload())}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-sky-50/60 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-amber-600" />
            전체 게임 JSON 백업
          </button>
        </div>
      </div>
    </div>
  );
};
