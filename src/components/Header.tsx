import React from 'react';
import {
  Compass,
  Layers,
  HelpCircle,
  ExternalLink,
  FolderArchive,
  Image as ImageIcon,
  Languages,
  Radio,
  KeyRound,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

import { CreditsBadge } from './CreditsBadge';

interface HeaderProps {
  activePlatform: 'missevan' | 'kilamanbo';
  onPlatformChange: (platform: 'missevan' | 'kilamanbo') => void;
  onOpenHelp: () => void;
  onOpenBatch?: () => void;
  onOpenDramaMode?: () => void;
  onOpenCoverGallery?: () => void;
  onOpenTranslate?: () => void;
  onOpenCookieModal?: () => void;
  onLockApp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePlatform,
  onPlatformChange,
  onOpenHelp,
  onOpenBatch,
  onOpenDramaMode,
  onOpenCoverGallery,
  onOpenTranslate,
  onOpenCookieModal,
  onLockApp,
}) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="border-b border-[#162238] bg-[#03060c]/90 backdrop-blur-md sticky top-0 z-40">
      {/* Top Avionics Ribbon */}
      <div className="bg-[#050a14] border-b border-[#131d30] px-4 sm:px-8 py-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sky-400 font-semibold tracking-wider">
            <Radio className="w-3 h-3 text-sky-400 animate-pulse" />
            <span>{t('telemetryActive')}</span>
          </span>
          <span className="text-slate-600">|</span>
          <CreditsBadge className="hidden sm:inline-flex text-[11px]" />
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {onLockApp && (
            <button
              type="button"
              onClick={onLockApp}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950/60 hover:bg-sky-900/70 border border-sky-500/30 text-sky-300 font-semibold text-[10px] cursor-pointer transition-colors shadow-sm"
              title={language === 'vi' ? 'Khóa ứng dụng (Lock Barrier)' : 'Lock Application Barrier'}
            >
              <Lock className="w-3 h-3 text-sky-400" />
              <span className="hidden sm:inline">{language === 'vi' ? 'Khóa' : 'Lock'}</span>
            </button>
          )}

          {/* Language Switcher Pill */}
          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-sky-400" />
            <div className="flex items-center bg-[#0d1627] border border-[#1e3252] rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('vi')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  language === 'vi'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                VI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Flight Deck Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 w-full">
        {/* Zone 1: Brand wordmark & Platform Switcher */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0 min-w-0">
          <a
            href="#extractor"
            className="flex items-center gap-2.5 sm:gap-3 shrink-0 cursor-pointer group"
            title={activePlatform === 'kilamanbo' ? 'KilaManbo 漫播 Extractor' : 'MissEvan 猫耳FM Extractor'}
          >
            <div
              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-[1.5px] shadow-lg group-hover:scale-105 transition-transform ${
                activePlatform === 'kilamanbo'
                  ? 'bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-400 shadow-rose-950/50'
                  : 'bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-400 shadow-sky-950/50'
              }`}
            >
              <div className="w-full h-full rounded-[10px] bg-[#080e1b] flex items-center justify-center">
                <Compass
                  className={`w-4 h-4 sm:w-5 sm:h-5 animate-spin-turbine ${
                    activePlatform === 'kilamanbo' ? 'text-rose-400' : 'text-sky-400'
                  }`}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
                  {activePlatform === 'kilamanbo' ? 'KilaManbo' : 'MissEvan'}
                  <span className="text-slate-400 font-normal ml-1 hidden xs:inline">Extractor</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate hidden md:block max-w-[150px] lg:max-w-none">
                {activePlatform === 'kilamanbo' ? '漫播 Audio & Subtitles' : 'Audio, Subtitles, Posters...'}
              </p>
            </div>
          </a>

          {/* Platform Switcher Segmented Tabs */}
          <div className="flex items-center p-0.5 sm:p-1 bg-[#070d1a] border border-[#17253d] rounded-xl shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => onPlatformChange('missevan')}
              className={`px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                activePlatform === 'missevan'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{t('tabMissEvan')}</span>
            </button>
            <button
              type="button"
              onClick={() => onPlatformChange('kilamanbo')}
              className={`px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                activePlatform === 'kilamanbo'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md shadow-rose-950/60'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{t('tabKilaManbo')}</span>
            </button>
          </div>
        </div>

        {/* Zone 2: Essential Actions & Help (Clean, Spacious & Uncramped) */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenHelp}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#182a46] hover:border-sky-500/40 bg-[#07101f] hover:bg-[#0c182e] text-slate-300 hover:text-sky-300 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title={t('navGuide')}
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">{t('navGuide')}</span>
          </button>

          {onOpenCookieModal && (
            <button
              type="button"
              onClick={onOpenCookieModal}
              className="px-3 py-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/40 shrink-0"
              title={language === 'vi' ? 'Cài đặt Cookie / Token VIP' : 'Set VIP Credentials / Cookie'}
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('vipClearance')}</span>
            </button>
          )}

          <a
            href={activePlatform === 'kilamanbo' ? 'https://www.kilamanbo.world' : 'https://www.missevan.com'}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-md whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activePlatform === 'kilamanbo'
                ? 'text-white bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 shadow-rose-950/60'
                : 'text-slate-950 bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-cyan-200 shadow-sky-950/60'
            }`}
          >
            <span className="hidden sm:inline">{activePlatform === 'kilamanbo' ? t('openManbo') : t('openMissEvan')}</span>
            <span className="sm:hidden">{activePlatform === 'kilamanbo' ? 'Manbo' : 'MissEvan'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </header>
  );
};
