/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Save,
  FileSpreadsheet,
  ChevronDown,
  Bell,
  Home,
  PlayCircle,
  BarChart3,
  Users,
  LayoutGrid,
  X,
  Dumbbell,
  ArrowLeftRight,
  UserPlus,
  Trophy,
  CloudDownload,
  CloudUpload,
  Smartphone,
  Share,
  Briefcase,
} from 'lucide-react';
import { Team } from '../types/baseball';
import { soundEffects } from '../utils/audio';
import { usePWAInstall } from '../hooks/usePWAInstall';

export type ActiveTab =
  | 'DASHBOARD'
  | 'LIVE_GAME'
  | 'ANALYSIS'
  | 'ROSTER'
  | 'TRAINING'
  | 'TRADE'
  | 'FA'
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
  onQuickPullSheets?: () => void;
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
  onQuickPullSheets,
  hasWebhookUrl,
  onOpenTeamSelect,
  pendingApprovalsCount,
  onOpenApprovals,
}) => {
  const [isMuted, setIsMuted] = useState(soundEffects.getMuted());
  const [saveToast, setSaveToast] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const toggleSound = () => {
    const next = soundEffects.toggleMute();
    setIsMuted(next);
  };

  const handleSave = () => {
    onSaveGame();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleSelectNav = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const navItems: { id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'DASHBOARD', label: '구단 사옥', shortLabel: '사옥', icon: <Home className="w-5 h-5" /> },
    { id: 'LIVE_GAME', label: '실시간 경기', shortLabel: '경기', icon: <PlayCircle className="w-5 h-5" /> },
    { id: 'ANALYSIS', label: '경기 분석', shortLabel: '분석', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'ROSTER', label: '선수단', shortLabel: '선수단', icon: <Users className="w-5 h-5" /> },
    { id: 'TRAINING', label: '육성실', shortLabel: '육성실', icon: <Dumbbell className="w-5 h-5" /> },
    { id: 'TRADE', label: '트레이드', shortLabel: '트레이드', icon: <ArrowLeftRight className="w-5 h-5" /> },
    { id: 'FA', label: 'FA 시장', shortLabel: 'FA시장', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'DRAFT', label: '드래프트', shortLabel: '드래프트', icon: <UserPlus className="w-5 h-5" /> },
    { id: 'STANDINGS', label: '순위·기록', shortLabel: '순위·기록', icon: <Trophy className="w-5 h-5" /> },
    { id: 'SHEETS', label: '시트 연동', shortLabel: '시트 연동', icon: <FileSpreadsheet className="w-5 h-5" /> },
  ];

  const primaryMobileTabs: ActiveTab[] = ['DASHBOARD', 'LIVE_GAME', 'ANALYSIS', 'ROSTER'];
  const isOverflowTabActive = !primaryMobileTabs.includes(activeTab);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-sky-100 text-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 lg:h-16 gap-2 sm:gap-3">
          {/* Zone 1: Brand & Team Wordmark */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center font-display font-extrabold text-white text-sm lg:text-base shadow-sm tracking-wider">
                JBL
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-sm lg:text-base text-slate-900 tracking-tight whitespace-nowrap">
                    JBL 매니저
                  </span>
                  <span className="text-[11px] text-sky-700 font-mono-numbers bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                    제{seasonNumber}회 · {currentDay}일
                  </span>
                </div>
              </div>
            </div>

            {userTeam && (
              <button
                onClick={onOpenTeamSelect}
                title="지휘 구단 선택 및 변경"
                className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs text-slate-700 transition-colors shadow-xs max-w-[140px] sm:max-w-none"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: userTeam.color }}
                />
                <span className="font-bold text-slate-900 truncate">{userTeam.name}</span>
                <span className="hidden 2xl:inline text-slate-500 font-mono-numbers text-[11px]">
                  ({userTeam.wins}승 {userTeam.draws}무 {userTeam.losses}패)
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              </button>
            )}
          </div>

          {/* Zone 2: Desktop Navigation Links (lg+) */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 overflow-x-auto no-scrollbar py-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-2 xl:px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  <span className="hidden xl:inline">{item.label}</span>
                  <span className="xl:hidden">{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={onOpenApprovals}
              title="트레이드 · 콜업 결재 알림함"
              className={`relative flex items-center justify-center gap-1 min-w-[38px] min-h-[38px] px-2 rounded-lg text-xs font-bold transition-colors ${
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
              className="hidden sm:flex items-center justify-center min-w-[38px] min-h-[38px] p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
            </button>

            {!isInstalled && (isInstallable || isIOS) && (
              <button
                onClick={handleInstallClick}
                title="스마트폰/태블릿 앱으로 설치"
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 transition-colors whitespace-nowrap"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">앱 설치</span>
              </button>
            )}

            {hasWebhookUrl && (
              <button
                onClick={onQuickSyncSheets}
                title="Google 스프레드시트 즉시 저장 동기화"
                className="hidden sm:flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden md:inline">시트 동기화</span>
              </button>
            )}

            <button
              onClick={handleSave}
              title="게임 진행 저장"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 transition-colors whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-[11px] sm:text-xs">{saveToast ? '저장!' : '저장'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Fixed Bottom Navigation Bar (< lg) */}
      <nav
        aria-label="모바일·태블릿 하단 메뉴"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-sky-100 pb-safe shadow-[0_-4px_20px_rgba(14,165,233,0.08)]"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-5 h-14">
          {navItems
            .filter((item) => primaryMobileTabs.includes(item.id))
            .map((item) => {
              const isActive = activeTab === item.id && !mobileMenuOpen;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
                    isActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-sky-600'
                  }`}
                >
                  <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-sky-50' : ''}`}>
                    {item.icon}
                  </div>
                  <span className="text-[10px] leading-none tracking-tight whitespace-nowrap">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
              mobileMenuOpen || isOverflowTabActive
                ? 'text-sky-600 font-bold'
                : 'text-slate-500 hover:text-sky-600'
            }`}
          >
            <div className={`p-1 rounded-lg transition-colors ${mobileMenuOpen || isOverflowTabActive ? 'bg-sky-50' : ''}`}>
              <LayoutGrid className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-none tracking-tight whitespace-nowrap">전체 메뉴</span>
          </button>
        </div>
      </nav>

      {/* Slide-Up Mobile/Tablet Full Menu & Multi-Device Sync Sheet */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-3xl border-t border-sky-100 shadow-2xl p-5 pb-safe space-y-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  JBL 구단 전체 메뉴
                </h3>
                <p className="text-[11px] text-slate-500">
                  제 {seasonNumber}회차 {currentDay}일차 · {userTeam?.name}
                </p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* All 9 Navigation Destinations */}
            <div className="grid grid-cols-3 gap-2.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 min-h-[68px] rounded-2xl border text-center transition-all active:scale-95 ${
                      isActive
                        ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20'
                        : 'bg-sky-50/60 hover:bg-sky-100 text-slate-800 border-sky-100'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs font-bold leading-tight">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Multi-Device Quick Sync & Utility Actions */}
            <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-sky-900 block">
                여러 기기 이어하기 · 빠른 도구
              </span>

              {hasWebhookUrl && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onQuickSyncSheets();
                    }}
                    className="flex items-center justify-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm"
                  >
                    <CloudUpload className="w-4 h-4" />
                    시트에 현재 진행 저장
                  </button>
                  {onQuickPullSheets && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onQuickPullSheets();
                      }}
                      className="flex items-center justify-center gap-2 min-h-[44px] px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm"
                    >
                      <CloudDownload className="w-4 h-4" />
                      다른 기기 기록 불러오기
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={toggleSound}
                  className="flex items-center justify-center gap-1.5 min-h-[42px] px-3 py-2 rounded-xl bg-white border border-sky-200 text-xs font-semibold text-slate-700"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 text-rose-500" /> 소리 꺼짐
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-600" /> 소리 켜짐
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenTeamSelect();
                  }}
                  className="flex items-center justify-center gap-1.5 min-h-[42px] px-3 py-2 rounded-xl bg-white border border-sky-200 text-xs font-semibold text-slate-700"
                >
                  <ArrowLeftRight className="w-4 h-4 text-sky-600" /> 구단 변경
                </button>

                {!isInstalled && (isInstallable || isIOS) && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleInstallClick();
                    }}
                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 min-h-[42px] px-3 py-2 rounded-xl bg-sky-100 border border-sky-300 text-xs font-bold text-sky-900"
                  >
                    <Smartphone className="w-4 h-4 text-sky-600" /> 홈 화면에 앱 설치
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* iOS / iPadOS Safari Install Guide Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-white border border-sky-100 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-sky-600" /> iPhone · iPad 앱 설치 방법
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-slate-700 bg-sky-50/70 p-4 rounded-xl border border-sky-100 leading-relaxed">
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center shrink-0">1</span>
                <span>
                  Safari 브라우저 하단(또는 상단)의 <strong className="inline-flex items-center gap-0.5 text-sky-700"><Share className="w-3.5 h-3.5" /> 공유</strong> 버튼을 누릅니다.
                </span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-white font-bold flex items-center justify-center shrink-0">2</span>
                <span>
                  메뉴에서 <strong>&ldquo;홈 화면에 추가&rdquo;</strong>를 선택하면 앱처럼 전체 화면으로 플레이할 수 있습니다.
                </span>
              </p>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
};
