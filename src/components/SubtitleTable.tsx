import React, { useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Radio,
  Edit3,
  Sparkles,
  KeyRound,
  Upload,
  Plane,
  Languages,
  Loader2,
} from 'lucide-react';
import { MissEvanDanmakuItem } from '../types/missevan';
import { formatTime } from '../utils/parser';
import { useLanguage } from '../context/LanguageContext';
import { isTranslationUnlocked } from './TranslationAdvisoryBarrier';

export type SubtitleDisplayMode = 'bilingual' | 'translated' | 'original';

interface SubtitleTableProps {
  items: MissEvanDanmakuItem[];
  currentTime: number;
  timeOffset: number;
  onJumpToTime: (time: number) => void;
  onUpdateNote: (id: string, text: string) => void;
  onUpdateTranslatedText?: (id: string, text: string) => void;
  isPaidEpisode?: boolean;
  onOpenCookieModal?: () => void;
  onImportSubtitles?: () => void;
  onOpenTranslateModal?: () => void;
  onQuickTranslateLine?: (item: MissEvanDanmakuItem) => Promise<void>;
  targetLang?: 'vi' | 'en' | 'es';
  displayMode?: SubtitleDisplayMode;
  onDisplayModeChange?: (mode: SubtitleDisplayMode) => void;
  platform?: 'missevan' | 'kilamanbo';
}

export const SubtitleTable: React.FC<SubtitleTableProps> = ({
  items,
  currentTime,
  timeOffset,
  onJumpToTime,
  onUpdateNote,
  onUpdateTranslatedText,
  isPaidEpisode,
  onOpenCookieModal,
  onImportSubtitles,
  onOpenTranslateModal,
  onQuickTranslateLine,
  targetLang = 'vi',
  displayMode = 'bilingual',
  onDisplayModeChange,
  platform = 'missevan',
}) => {
  const { t } = useLanguage();
  const isGreen = platform === 'kilamanbo';
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  const hasAnyTranslations = items.some((i) => Boolean(i.translatedText));
  const translatedCount = items.filter((i) => Boolean(i.translatedText)).length;

  const handleCopy = (item: MissEvanDanmakuItem) => {
    let copyText = item.text;
    if (displayMode === 'translated' && item.translatedText) {
      copyText = item.translatedText;
    } else if (displayMode === 'bilingual' && item.translatedText) {
      copyText = `${item.text}\n${item.translatedText}`;
    }
    navigator.clipboard.writeText(copyText);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleQuickTranslate = async (item: MissEvanDanmakuItem) => {
    if (!isTranslationUnlocked()) {
      if (onOpenTranslateModal) {
        onOpenTranslateModal();
      }
      return;
    }
    if (!onQuickTranslateLine || translatingId) return;
    setTranslatingId(item.id);
    try {
      await onQuickTranslateLine(item);
    } catch (err) {
      console.error('Quick translate line error:', err);
    } finally {
      setTranslatingId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-[#060c18] border border-[#162744] rounded-2xl p-10 sm:p-14 text-center text-slate-400 shadow-xl space-y-4">
        <Radio className="w-12 h-12 text-sky-500/40 mx-auto animate-pulse" />
        <div className="space-y-1.5 max-w-lg mx-auto">
          <p className="font-heading text-lg font-bold text-white">
            {t('emptyTableTitle')}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isPaidEpisode ? t('vipLockedNotice') : t('emptyTableDesc')}
          </p>
        </div>

        {isPaidEpisode && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onOpenCookieModal && (
              <button
                type="button"
                onClick={onOpenCookieModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t('vipCookieButton')}</span>
              </button>
            )}
            {onImportSubtitles && (
              <button
                type="button"
                onClick={onImportSubtitles}
                className="px-4 py-2 rounded-xl bg-[#0e1930] hover:bg-[#152545] border border-sky-700/60 text-sky-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('importModalTitle')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ${
      isGreen ? 'bg-[#030e07] border-emerald-500/30' : 'bg-[#060c18] border-[#162744]'
    }`}>
      {/* Table Header Controls: Translation Bar & Display Modes */}
      <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
        isGreen ? 'border-[#143a25] bg-[#05160d]' : 'border-[#14233c] bg-[#070e1c]'
      }`}>
        <div className="flex items-center gap-2.5">
          {onOpenTranslateModal && (
            <button
              type="button"
              onClick={onOpenTranslateModal}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-heading font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
                isGreen
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border-emerald-500/40 hover:border-emerald-400 text-emerald-200'
                  : 'bg-gradient-to-r from-sky-500/20 to-cyan-500/20 hover:from-sky-500/30 hover:to-cyan-500/30 border-sky-500/40 hover:border-sky-400 text-sky-200'
              }`}
            >
              <Languages className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
              <span>{t('translateSubtitlesBtn')}</span>
              {hasAnyTranslations && (
                <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  isGreen ? 'bg-emerald-500 text-slate-950' : 'bg-sky-500 text-slate-950'
                }`}>
                  {translatedCount}/{items.length}
                </span>
              )}
            </button>
          )}

          {hasAnyTranslations && (
            <span className={`text-[11px] font-mono px-2 py-1 rounded border ${
              isGreen ? 'bg-[#06180e] border-[#143a25] text-slate-400' : 'bg-[#0b162a] border-[#162847] text-slate-400'
            }`}>
              TARGET: <span className={`font-bold ${isGreen ? 'text-emerald-300' : 'text-sky-300'}`}>{targetLang.toUpperCase()}</span>
            </span>
          )}
        </div>

        {/* Display Mode Switcher if translations exist */}
        {hasAnyTranslations && onDisplayModeChange && (
          <div className={`flex items-center gap-1 p-0.5 rounded-lg border text-[11px] ${
            isGreen ? 'bg-[#06180e] border-[#143a25]' : 'bg-[#0b162b] border-[#182d4d]'
          }`}>
            <button
              type="button"
              onClick={() => onDisplayModeChange('bilingual')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                displayMode === 'bilingual'
                  ? isGreen
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Song Ngữ
            </button>
            <button
              type="button"
              onClick={() => onDisplayModeChange('translated')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                displayMode === 'translated'
                  ? isGreen
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chỉ Bản Dịch
            </button>
            <button
              type="button"
              onClick={() => onDisplayModeChange('original')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                displayMode === 'original'
                  ? isGreen
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chỉ Bản Gốc
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto max-h-[640px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-10 border-b font-heading font-semibold text-xs tracking-wider ${
            isGreen
              ? 'bg-[#06180e] text-emerald-300 border-[#143a25]'
              : 'bg-[#091326] text-sky-200/90 border-[#182c4c]'
          }`}>
            <tr>
              <th className="py-3 px-3.5 w-12 font-semibold">#</th>
              <th className="py-3 px-3.5 w-32 font-semibold">{t('colTimestamp')}</th>
              <th className="py-3 px-3.5 font-semibold">{t('colText')}</th>
              <th className="py-3 px-3.5 font-semibold">{t('colNotes')}</th>
              <th className="py-3 px-3.5 w-28 text-right font-semibold">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isGreen ? 'divide-[#0e2c1a]' : 'divide-[#101e35]'}`}>
            {items.map((item, index) => {
              const start = Math.max(0, item.time + timeOffset);
              const end = Math.max(start + 0.5, item.endTime + timeOffset);
              const isActive = currentTime >= start && currentTime <= end;
              const hasTrans = Boolean(item.translatedText);
              const isBeingTranslated = translatingId === item.id;

              return (
                <tr
                  key={item.id}
                  className={`transition-colors group ${
                    isActive
                      ? isGreen
                        ? 'bg-[#0b2817]/90 border-l-2 border-l-emerald-400 text-emerald-50'
                        : 'bg-[#0f2142]/80 border-l-2 border-l-sky-400 text-sky-50'
                      : isGreen
                        ? 'hover:bg-[#071d10]/70 text-slate-200'
                        : 'hover:bg-[#0a1426]/70 text-slate-200'
                  }`}
                >
                  {/* Index */}
                  <td className="py-2.5 px-3.5 text-slate-500 font-mono tabular-nums">
                    {isActive ? (
                      <Plane className={`w-3.5 h-3.5 -rotate-45 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                    ) : (
                      index + 1
                    )}
                  </td>

                  {/* Time Range */}
                  <td className="py-2.5 px-3.5 whitespace-nowrap font-mono tabular-nums">
                    <button
                      type="button"
                      onClick={() => onJumpToTime(start)}
                      className={`inline-flex items-center gap-1.5 font-semibold cursor-pointer transition-colors ${
                        isGreen
                          ? 'text-slate-300 hover:text-emerald-400 group-hover:text-emerald-300'
                          : 'text-slate-300 hover:text-sky-400 group-hover:text-sky-300'
                      }`}
                      title={t('jumpToTime')}
                    >
                      <Play className={`w-3 h-3 ${isGreen ? 'text-emerald-400 fill-emerald-400' : 'text-sky-400 fill-sky-400'}`} />
                      <span>{formatTime(start, 'display')}</span>
                    </button>
                    <span className="text-[10px] text-slate-500 block">
                      &rarr; {formatTime(end, 'display')}
                    </span>
                  </td>

                  {/* Dialogue Text with Role, Official Tag, & Translation */}
                  <td className="py-2.5 px-3.5 text-slate-100 text-[14px] leading-relaxed break-words max-w-sm sm:max-w-md">
                    <div className="space-y-1.5">
                      {/* Original Chinese Line */}
                      {displayMode !== 'translated' && (
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          {item.role && (
                            <span className={`px-1.5 py-0.2 rounded text-[11px] font-sans font-semibold shrink-0 border ${
                              isGreen
                                ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-200'
                                : 'bg-sky-950/80 border-sky-600/50 text-sky-200'
                            }`}>
                              {item.role}
                            </span>
                          )}
                          <span className={`font-medium text-slate-200 ${
                            isGreen ? 'selection:bg-emerald-600 selection:text-white' : 'selection:bg-sky-500 selection:text-white'
                          }`}>
                            {item.role && item.text.startsWith(`${item.role}：`)
                              ? item.text.slice(item.role.length + 1)
                              : item.text}
                          </span>
                          {item.isOfficialSubtitle && !item.role && (
                            <span className={`px-1.5 py-0.2 text-[9px] font-mono rounded border ${
                              isGreen
                                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                                : 'bg-sky-950/70 text-sky-300 border-sky-700/60'
                            }`}>
                              OFFICIAL
                            </span>
                          )}
                        </div>
                      )}

                      {/* Translated Line */}
                      {(displayMode === 'translated' || displayMode === 'bilingual') && (
                        <div>
                          {hasTrans ? (
                            <div className={`flex items-start gap-1.5 text-[13px] font-medium pl-2.5 border-l-2 py-0.5 ${
                              isGreen
                                ? 'text-emerald-300 border-emerald-400/70'
                                : 'text-sky-300 border-sky-400/70'
                            }`}>
                              <span className={`text-[10px] font-mono px-1 py-0.2 rounded shrink-0 mt-0.5 border ${
                                isGreen
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                                  : 'bg-sky-950 text-sky-300 border-sky-800/60'
                              }`}>
                                {(item.translationLang || targetLang).toUpperCase()}
                              </span>
                              {item.translatedRole && (
                                <span className={`font-semibold shrink-0 ${
                                  isGreen ? 'text-teal-200' : 'text-cyan-200'
                                }`}>
                                  [{item.translatedRole}]
                                </span>
                              )}
                              <span className={`text-slate-100 ${
                                isGreen
                                  ? 'text-emerald-100 selection:bg-emerald-600 selection:text-white'
                                  : 'text-sky-100 selection:bg-sky-600 selection:text-white'
                              }`}>
                                {item.translatedText}
                              </span>
                            </div>
                          ) : (
                            displayMode === 'translated' && (
                              <div className="text-slate-500 italic text-xs">
                                ({item.text})
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Note / Edit Field */}
                  <td className="py-2.5 px-3.5 max-w-xs sm:max-w-md">
                    <div className="relative group/edit">
                      <input
                        type="text"
                        placeholder="Add note..."
                        value={item.userNote || ''}
                        onChange={(e) => onUpdateNote(item.id, e.target.value)}
                        className={`w-full px-2 py-1 rounded-md border text-xs placeholder-slate-600 transition-colors focus:outline-none ${
                          isGreen
                            ? 'bg-transparent hover:bg-[#071d10] focus:bg-[#0b2817] border-transparent hover:border-[#143a25] focus:border-emerald-400 text-emerald-200'
                            : 'bg-transparent hover:bg-[#0c172a] focus:bg-[#0e1d35] border-transparent hover:border-[#1e3458] focus:border-sky-400 text-sky-200'
                        }`}
                      />
                      <Edit3 className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                    </div>
                  </td>

                  {/* Action Buttons: Quick Translate & Copy */}
                  <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {/* Quick Translate Single Line */}
                      {onQuickTranslateLine && (
                        <button
                          type="button"
                          onClick={() => handleQuickTranslate(item)}
                          disabled={isBeingTranslated}
                          className={`p-1.5 transition-colors cursor-pointer rounded-lg ${
                            isGreen
                              ? hasTrans
                                ? 'text-emerald-400/80 hover:text-emerald-300 hover:bg-[#0c2619]'
                                : 'text-slate-500 hover:text-emerald-300 hover:bg-[#0c2619]'
                              : hasTrans
                                ? 'text-sky-400/80 hover:text-sky-300 hover:bg-[#122340]'
                                : 'text-slate-500 hover:text-sky-300 hover:bg-[#122340]'
                          }`}
                          title={hasTrans ? `Dịch lại dòng này (${targetLang.toUpperCase()})` : `Dịch dòng này sang ${targetLang.toUpperCase()}`}
                        >
                          {isBeingTranslated ? (
                            <Loader2 className={`w-3.5 h-3.5 animate-spin ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(item)}
                        className={`p-1.5 text-slate-400 transition-colors cursor-pointer rounded-lg ${
                          isGreen ? 'hover:text-emerald-300 hover:bg-[#0c2619]' : 'hover:text-sky-300 hover:bg-[#122340]'
                        }`}
                        title={t('copyLine')}
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
