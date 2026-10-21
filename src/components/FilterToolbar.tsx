import React from 'react';
import {
  Search,
  ShieldCheck,
  Clock,
  UserCheck,
  RotateCcw,
  Radio,
  Sparkles,
  Lock,
  Upload,
  SlidersHorizontal,
} from 'lucide-react';
import { FilterMode, FilterOptions, UserStats } from '../types/missevan';
import { useLanguage } from '../context/LanguageContext';

interface FilterToolbarProps {
  options: FilterOptions;
  onChange: (options: FilterOptions) => void;
  userStats: UserStats[];
  totalRawCount: number;
  filteredCount: number;
  officialCount?: number;
  isPaidEpisode?: boolean;
  hasOfficialSubNotice?: boolean;
  onOpenCookieModal?: () => void;
  onImportSubtitles?: () => void;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  options,
  onChange,
  userStats,
  totalRawCount,
  filteredCount,
  officialCount = 0,
  isPaidEpisode = false,
  hasOfficialSubNotice = false,
  onOpenCookieModal,
  onImportSubtitles,
}) => {
  const { t } = useLanguage();

  const handleModeChange = (mode: FilterMode) => {
    onChange({ ...options, mode });
  };

  const handleSmartCleanToggle = () => {
    onChange({ ...options, smartClean: !options.smartClean });
  };

  const handleUidChange = (uid: string) => {
    onChange({
      ...options,
      mode: uid ? 'custom_uid' : (officialCount > 0 ? 'official_subs' : 'subtitles_only'),
      selectedUid: uid,
    });
  };

  const handleOffsetAdjust = (delta: number) => {
    onChange({
      ...options,
      timeOffset: Number((options.timeOffset + delta).toFixed(2)),
    });
  };

  const resetOffset = () => {
    onChange({ ...options, timeOffset: 0 });
  };

  return (
    <div className="bg-[#060c18] border border-[#162744] rounded-2xl p-4.5 mb-6 space-y-4 shadow-xl shadow-black/60 text-left">
      {/* Top row: Mode selector & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Segmented control for Filter Mode */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0a1224] border border-[#1a2e50] rounded-xl">
          {/* Option 1: Official Subtitles (if available) */}
          {officialCount > 0 ? (
            <button
              type="button"
              onClick={() => handleModeChange('official_subs')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                options.mode === 'official_subs'
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 shadow-md font-bold'
                  : 'text-sky-300 hover:text-white hover:bg-[#12223f]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
              <span>{t('modeOfficial')} ({officialCount})</span>
            </button>
          ) : isPaidEpisode ? (
            <button
              type="button"
              onClick={onOpenCookieModal}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-700/60"
              title={t('vipLockedNotice')}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('modeOfficial')} ({t('vipCookieButton')})</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => handleModeChange('subtitles_only')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              options.mode === 'subtitles_only'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-950/60'
                : 'text-slate-300 hover:text-sky-300'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('modeMode4')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              options.mode === 'all'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-950/60'
                : 'text-slate-300 hover:text-sky-300'
            }`}
          >
            {t('modeAll')} ({totalRawCount})
          </button>

          {options.selectedUid && (
            <button
              type="button"
              onClick={() => handleModeChange('custom_uid')}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                options.mode === 'custom_uid'
                  ? 'bg-sky-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-sky-300'
              }`}
            >
              UID: {options.selectedUid}
            </button>
          )}
        </div>

        {/* Search input & Import Button */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {onImportSubtitles && (
            <button
              type="button"
              onClick={onImportSubtitles}
              className="px-3 py-2 rounded-xl bg-[#0c1629] hover:bg-[#122240] border border-[#1e3458] text-sky-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              title={t('importModalTitle')}
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('modeCustom')}</span>
            </button>
          )}

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t('searchDialogue')}
              value={options.searchQuery}
              onChange={(e) => onChange({ ...options, searchQuery: e.target.value })}
              className="w-full bg-[#0a1224] border border-[#1a2e50] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Middle row: Fine-tuning controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2.5 border-t border-[#14233c] text-xs">
        {/* Smart Filter toggle */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSmartCleanToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
              options.smartClean
                ? 'bg-[#0f1f3a] border-sky-600/70 text-sky-200 shadow-sm shadow-sky-950/40'
                : 'bg-[#0a1224] border-[#1a2e50] text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('smartClean')}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#172c4e] text-sky-300 ml-1">
              {options.smartClean ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Subtitle count indicator */}
          <span className="text-slate-400">
            {t('showingCount', { filtered: filteredCount, total: totalRawCount })}
          </span>
        </div>

        {/* Time Offset adjuster */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            {t('timeOffset')}:
          </span>
          <div className="inline-flex items-center bg-[#0a1224] border border-[#1a2e50] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => handleOffsetAdjust(-1)}
              className="px-2 py-1 text-slate-400 hover:text-sky-300 hover:bg-[#122240] cursor-pointer transition-colors font-mono"
              title="-1s"
            >
              -1s
            </button>
            <button
              type="button"
              onClick={() => handleOffsetAdjust(-0.5)}
              className="px-2 py-1 text-slate-400 hover:text-sky-300 hover:bg-[#122240] cursor-pointer transition-colors font-mono"
              title="-0.5s"
            >
              -0.5s
            </button>
            <span className="px-2.5 py-1 font-mono tabular-nums font-semibold text-sky-400 min-w-14 text-center">
              {options.timeOffset > 0 ? `+${options.timeOffset}s` : `${options.timeOffset}s`}
            </span>
            <button
              type="button"
              onClick={() => handleOffsetAdjust(0.5)}
              className="px-2 py-1 text-slate-400 hover:text-sky-300 hover:bg-[#122240] cursor-pointer transition-colors font-mono"
              title="+0.5s"
            >
              +0.5s
            </button>
            <button
              type="button"
              onClick={() => handleOffsetAdjust(1)}
              className="px-2 py-1 text-slate-400 hover:text-sky-300 hover:bg-[#122240] cursor-pointer transition-colors font-mono"
              title="+1s"
            >
              +1s
            </button>
            {options.timeOffset !== 0 && (
              <button
                type="button"
                onClick={resetOffset}
                className="px-2 py-1 text-slate-400 hover:text-sky-400 border-l border-[#1a2e50] cursor-pointer"
                title="Reset to 0s"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Top Contributor UIDs (Subbers) */}
      {options.mode !== 'official_subs' && userStats.length > 0 && (
        <div className="pt-2 border-t border-[#14233c] flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-sky-400" />
            {t('topSubbers')}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {userStats.slice(0, 5).map((u) => {
              const isSelected = options.mode === 'custom_uid' && options.selectedUid === u.userId;
              return (
                <button
                  type="button"
                  key={u.userId}
                  onClick={() => handleUidChange(isSelected ? '' : u.userId)}
                  className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-900/60 border-sky-400 text-sky-200 font-semibold shadow-sm'
                      : 'bg-[#0a1224] border-[#1a2e50] text-slate-400 hover:text-white hover:border-sky-700/60'
                  }`}
                  title={`${u.count} danmaku (${u.mode4Count} subs)`}
                >
                  UID {u.userId} ({u.mode4Count > 0 ? `${u.mode4Count} subs` : `${u.count} dm`})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
