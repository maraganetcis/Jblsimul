/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Save, FileSpreadsheet, ChevronDown, Bell } from 'lucide-react';
import { Team } from '../types/baseball';
import { soundEffects } from '../utils/audio';

export type ActiveTab = 
  | 'DASHBOARD'
  | 'LIVE_GAME'
  | 'ROSTER'
  | 'TRAINING'
  | 'TRADE'
  | 'DRAFT'
  | 'STANDINGS'
  | 'SHEETS';

interface HeaderProps {
  userTeam: Team | null;
  seasonNumber: number;
  currentDay: number;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onSaveGame: () => void;
  onQuickSyncSheets: () => void;
  hasWebhookUrl: boolean;
  onOpenTeamSelect: () => void;
  pendingApprovalsCount: number;
  onOpenApprovals: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userTeam,
  seasonNumber,
  currentDay,
  activeTab,
  onSelectTab,
  onSaveGame,
  onQuickSyncSheets,
  hasWebhookUrl,
  onOpenTeamSelect,
  pendingApprovalsCount,
  onOpenApprovals,
}) => {
  const [isMuted, setIsMuted] = React.useState(soundEffects.getMuted());
  const [saveToast, setSaveToast] = React.useState(false);

  const toggleSound = () => {
    const next = soundEffects.toggleMute();
    setIsMuted(next);
  };

  const handleSave = () => {
    onSaveGame();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'DASHBOARD', label: '구단 사옥' },
    { id: 'LIVE_GAME', label: '실시간 경기' },
    { id: 'ROSTER', label: '선수단 라인업' },
    { id: 'TRAINING', label: '선수 육성실' },
    { id: 'TRADE', label: '트레이드' },
    { id: 'DRAFT', label: '신인 드래프트' },
    { id: 'STANDINGS', label: '리그 순위·기록' },
    { id: 'SHEETS', label: '스프레드시트 연동' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-sky-100 text-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-3">
        {/* Zone 1: Brand & Team Wordmark */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center font-display font-extrabold text-white text-base shadow-sm tracking-wider">
              JBL
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-slate-900 tracking-tight whitespace-nowrap">
                  JBL Baseball Manager
                </span>
                <span className="text-xs text-sky-700 font-mono-numbers bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded font-semibold">
                  제 {seasonNumber}회 ({currentDay}일차)
                </span>
              </div>
            </div>
          </div>

          {userTeam && (
            <button
              onClick={onOpenTeamSelect}
              title="지휘 구단 선택 및 변경"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 transition-colors shadow-xs"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: userTeam.color }}
              />
              <span className="font-bold text-slate-900 whitespace-nowrap">{userTeam.name}</span>
              <span className="hidden xl:inline text-slate-500 font-mono-numbers text-[11px]">
                ({userTeam.wins}승 {userTeam.draws}무 {userTeam.losses}패)
              </span>
              <span className="text-[10px] text-sky-700 font-semibold hidden sm:inline">변경</span>
              <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
            </button>
          )}
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Action Tools (Approvals, Sound, Sheet Sync, Save) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenApprovals}
            title="트레이드 · 콜업 결재 알림함"
            className={`relative flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${
              pendingApprovalsCount > 0
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <Bell className={`w-4 h-4 ${pendingApprovalsCount > 0 ? 'text-amber-600 animate-pulse' : ''}`} />
            {pendingApprovalsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono-numbers leading-tight">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleSound}
            title={isMuted ? '소리 켜기' : '소리 끄기'}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
          </button>

          {hasWebhookUrl && (
            <button
              onClick={onQuickSyncSheets}
              title="Google 스프레드시트 즉시 동기화"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">시트 동기화</span>
            </button>
          )}

          <button
            onClick={handleSave}
            title="게임 진행 저장"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">{saveToast ? '저장 완료!' : '저장'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav row */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 border-t border-sky-100 overflow-x-auto bg-sky-50/60">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-sky-700'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
