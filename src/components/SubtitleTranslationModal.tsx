import React, { useState } from 'react';
import {
  X,
  Languages,
  Sparkles,
  Download,
  Loader2,
  Check,
  FileText,
  Music2,
  AlertCircle,
  Plane,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { MissEvanDanmakuItem, MissEvanSoundInfo } from '../types/missevan';
import {
  generateTranslatedSRT,
  generateBilingualSRT,
  generateTranslatedVTT,
  generateBilingualVTT,
  generateTranslatedLRC,
  generateBilingualLRC,
  generateTranslatedTXT,
  generateBilingualTXT,
  downloadFile,
  sanitizeFilename,
} from '../utils/formatter';
import { useLanguage } from '../context/LanguageContext';

export type SubtitleTargetLanguage = 'vi' | 'en' | 'es';

interface SubtitleTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MissEvanDanmakuItem[];
  soundInfo: MissEvanSoundInfo | null;
  timeOffset: number;
  onApplyTranslations: (translatedMap: Record<string, { text: string; role?: string }>, lang: SubtitleTargetLanguage) => void;
  platform?: 'missevan' | 'kilamanbo';
}

export const SubtitleTranslationModal: React.FC<SubtitleTranslationModalProps> = ({
  isOpen,
  onClose,
  items,
  soundInfo,
  timeOffset,
  onApplyTranslations,
  platform = 'missevan',
}) => {
  const { t, language } = useLanguage();
  const isGreen = platform === 'kilamanbo';
  const appNameText = isGreen ? 'KilaManbo' : 'MissEvan';

  const [targetLang, setTargetLang] = useState<SubtitleTargetLanguage>('vi');
  const [dramaContext, setDramaContext] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [translatedItems, setTranslatedItems] = useState<Record<string, { text: string; role?: string }>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState(false);

  if (!isOpen) return null;

  const baseTitle = soundInfo
    ? `${appNameText}_${soundInfo.id}_${sanitizeFilename(soundInfo.soundstr)}`
    : `${isGreen ? 'kilamanbo' : 'missevan'}_subtitles`;

  const hasTranslations = Object.keys(translatedItems).length > 0;
  const translatedCount = Object.keys(translatedItems).length;

  // Build merged items with translations for preview and export
  const mergedItems: MissEvanDanmakuItem[] = items.map((item) => {
    const tr = translatedItems[item.id];
    return tr
      ? {
          ...item,
          translatedText: tr.text,
          translatedRole: tr.role,
          translationLang: targetLang,
        }
      : item;
  });

  const handleStartTranslate = async () => {
    if (items.length === 0 || isTranslating) return;

    setIsTranslating(true);
    setErrorMsg(null);
    setProgressCount(0);

    try {
      // Prepare payload: translate items in chunks of 40 to display incremental progress
      const CHUNK_SIZE = 40;
      const total = items.length;
      const newTranslations: Record<string, { text: string; role?: string }> = { ...translatedItems };

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE).map((it) => ({
          id: it.id,
          text: it.text,
          role: it.role,
        }));

        const res = await fetch('/api/subtitles/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: chunk,
            targetLang,
            dramaContext: dramaContext.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}: Failed to translate chunk`);
        }

        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          for (const item of json.data) {
            newTranslations[item.id] = {
              text: item.translated,
              role: item.translatedRole,
            };
          }
          setTranslatedItems({ ...newTranslations });
        }

        setProgressCount(Math.min(total, i + CHUNK_SIZE));
      }

      // Auto apply to table
      onApplyTranslations(newTranslations, targetLang);
      setAppliedToast(true);
      setTimeout(() => setAppliedToast(false), 2500);
    } catch (err: any) {
      console.error('Translation error:', err);
      setErrorMsg(err.message || t('translationFailedNotice'));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleApply = () => {
    onApplyTranslations(translatedItems, targetLang);
    setAppliedToast(true);
    setTimeout(() => {
      setAppliedToast(false);
      onClose();
    }, 800);
  };

  const handleExport = (type: 'trans_srt' | 'bi_srt' | 'trans_vtt' | 'bi_vtt' | 'trans_lrc' | 'bi_lrc' | 'trans_txt' | 'bi_txt') => {
    const langCode = targetLang.toUpperCase();
    switch (type) {
      case 'trans_srt':
        downloadFile(generateTranslatedSRT(mergedItems, timeOffset), `${baseTitle}_[${langCode}].srt`);
        break;
      case 'bi_srt':
        downloadFile(generateBilingualSRT(mergedItems, timeOffset), `${baseTitle}_[ZH-${langCode}_Bilingual].srt`);
        break;
      case 'trans_vtt':
        downloadFile(generateTranslatedVTT(mergedItems, timeOffset), `${baseTitle}_[${langCode}].vtt`);
        break;
      case 'bi_vtt':
        downloadFile(generateBilingualVTT(mergedItems, timeOffset), `${baseTitle}_[ZH-${langCode}_Bilingual].vtt`);
        break;
      case 'trans_lrc':
        downloadFile(generateTranslatedLRC(mergedItems, soundInfo, timeOffset), `${baseTitle}_[${langCode}].lrc`);
        break;
      case 'bi_lrc':
        downloadFile(generateBilingualLRC(mergedItems, soundInfo, timeOffset), `${baseTitle}_[ZH-${langCode}_Bilingual].lrc`);
        break;
      case 'trans_txt':
        downloadFile(generateTranslatedTXT(mergedItems, true, timeOffset), `${baseTitle}_[${langCode}]_script.txt`);
        break;
      case 'bi_txt':
        downloadFile(generateBilingualTXT(mergedItems, true, timeOffset), `${baseTitle}_[ZH-${langCode}_Bilingual]_script.txt`);
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className={`rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto border-2 ${
        isGreen
          ? 'bg-[#030d06] border-emerald-500/40 shadow-emerald-950/80 military-grid'
          : 'bg-[#050a14] border-[#162744] shadow-sky-950/60'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isGreen ? 'border-[#133d24] bg-[#05180e]' : 'border-[#14233c] bg-[#070f20]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isGreen
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}>
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-semibold tracking-wider px-2 py-0.5 rounded border ${
                  isGreen
                    ? 'bg-emerald-950 border-emerald-600/70 text-emerald-300'
                    : 'bg-sky-950 border-sky-700/60 text-sky-300'
                }`}>
                  {isGreen ? 'KILAMANBO MILITARY TRANSLATION COCKPIT' : 'AI MULTILINGUAL COCKPIT'}
                </span>
                <span className="text-xs text-slate-400">
                  ({items.length} {t('colText').toLowerCase()})
                </span>
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-bold text-white mt-0.5">
                {isGreen
                  ? language === 'vi'
                    ? 'Công Cụ Dịch Phụ Đề KilaManbo'
                    : 'KilaManbo Subtitle Translation Tool'
                  : t('translationToolTitle')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer ${
              isGreen ? 'hover:bg-[#0c2415]' : 'hover:bg-[#122340]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-xs">
          {/* Target Language Selection Tabs */}
          <div>
            <label className={`block text-xs font-heading font-semibold mb-2 ${
              isGreen ? 'text-emerald-300' : 'text-sky-200'
            }`}>
              {t('targetLanguage')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTargetLang('vi')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  targetLang === 'vi'
                    ? isGreen
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-950/60'
                      : 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-950/50'
                    : isGreen
                      ? 'bg-[#05140b] border-[#143a25] text-slate-300 hover:border-emerald-600/50 hover:bg-[#082012]'
                      : 'bg-[#091326] border-[#182c4c] text-slate-300 hover:border-sky-700/50 hover:bg-[#0c1a33]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇻🇳</span>
                    <span className="font-heading font-bold text-sm">Tiếng Việt</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Chuẩn văn phong thoại kịch truyền thanh</p>
                </div>
                {targetLang === 'vi' && (
                  <Check className={`w-4 h-4 shrink-0 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setTargetLang('en')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  targetLang === 'en'
                    ? isGreen
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-950/60'
                      : 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-950/50'
                    : isGreen
                      ? 'bg-[#05140b] border-[#143a25] text-slate-300 hover:border-emerald-600/50 hover:bg-[#082012]'
                      : 'bg-[#091326] border-[#182c4c] text-slate-300 hover:border-sky-700/50 hover:bg-[#0c1a33]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇬🇧</span>
                    <span className="font-heading font-bold text-sm">English</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Punchy cinematic spoken dialogue</p>
                </div>
                {targetLang === 'en' && (
                  <Check className={`w-4 h-4 shrink-0 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setTargetLang('es')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  targetLang === 'es'
                    ? isGreen
                      ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md shadow-emerald-950/60'
                      : 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-950/50'
                    : isGreen
                      ? 'bg-[#05140b] border-[#143a25] text-slate-300 hover:border-emerald-600/50 hover:bg-[#082012]'
                      : 'bg-[#091326] border-[#182c4c] text-slate-300 hover:border-sky-700/50 hover:bg-[#0c1a33]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇪🇸</span>
                    <span className="font-heading font-bold text-sm">Español</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Traducción fluida y dramática</p>
                </div>
                {targetLang === 'es' && (
                  <Check className={`w-4 h-4 shrink-0 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                )}
              </button>
            </div>
          </div>

          {/* Optional Drama Context Input */}
          <div>
            <label className="block text-xs font-heading font-semibold text-slate-300 mb-1.5">
              {t('dramaContextLabel')}
            </label>
            <input
              type="text"
              value={dramaContext}
              onChange={(e) => setDramaContext(e.target.value)}
              placeholder={t('dramaContextPlaceholder')}
              className={`w-full rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors border ${
                isGreen
                  ? 'bg-[#040e08] border-[#133822] focus:border-emerald-400'
                  : 'bg-[#091326] border-[#162947] focus:border-sky-400'
              }`}
            />
          </div>

          {/* Translation Control Action */}
          <div className={`rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border ${
            isGreen
              ? 'bg-[#05160d] border-[#143a25]'
              : 'bg-[#081020] border-[#14233c]'
          }`}>
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Sparkles className={`w-4 h-4 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span className="font-heading font-semibold text-white">
                  {hasTranslations ? t('translatedLinesCount').replace('{count}', String(translatedCount)) : t('translationToolSubtitle')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {items.length === 0
                  ? t('emptyTableDesc')
                  : `Hỗ trợ dịch đầy đủ ${items.length} câu thoại, giữ nguyên mốc thời gian và định dạng kịch.`}
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleStartTranslate}
                disabled={isTranslating || items.length === 0}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 ${
                  isGreen
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-950/70'
                    : 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 shadow-lg shadow-sky-950/60'
                }`}
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>
                      {t('translatingProgress')
                        .replace('{current}', String(progressCount))
                        .replace('{total}', String(items.length))}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>
                      {hasTranslations ? t('clearTranslationsBtn') && 'Dịch Lại Toàn Bộ' : t('translateAllAction')}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress bar when translating */}
          {isTranslating && (
            <div className="space-y-1.5">
              <div className={`w-full h-2 rounded-full overflow-hidden border ${
                isGreen ? 'bg-[#020a05] border-[#133822]' : 'bg-[#0c1830] border-[#162744]'
              }`}>
                <div
                  className={`h-full transition-all duration-300 ${
                    isGreen
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                      : 'bg-gradient-to-r from-sky-400 to-cyan-400'
                  }`}
                  style={{
                    width: `${items.length > 0 ? (progressCount / items.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>{t('translatingSubtitles')}</span>
                <span>{Math.round(items.length > 0 ? (progressCount / items.length) * 100 : 0)}%</span>
              </div>
            </div>
          )}

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Toast on apply */}
          {appliedToast && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-200 flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>
                {t('translationCompleteNotice')
                  .replace('{count}', String(translatedCount))
                  .replace('{lang}', targetLang.toUpperCase())}
              </span>
            </div>
          )}

          {/* Live Translation Preview & Direct Export (if translated) */}
          {hasTranslations && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h4 className={`font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isGreen ? 'text-emerald-300' : 'text-white'
                }`}>
                  <Eye className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                  <span>Xem Trước Bản Dịch ({translatedCount} / {items.length} câu)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleApply}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 border transition-all ${
                    isGreen
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-600/50'
                      : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-600/50'
                  }`}
                >
                  <Check className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                  <span>{t('applyTranslationsToDeck')}</span>
                </button>
              </div>

              {/* Preview table */}
              <div className={`max-h-60 overflow-y-auto rounded-xl border divide-y ${
                isGreen
                  ? 'border-[#143a25] bg-[#020804] divide-[#0e2819]'
                  : 'border-[#162744] bg-[#030712] divide-[#101e35]'
              }`}>
                {items.slice(0, 50).map((item, idx) => {
                  const tr = translatedItems[item.id];
                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 transition-colors flex items-start gap-3 ${
                        isGreen ? 'hover:bg-[#071c10]' : 'hover:bg-[#070f20]'
                      }`}
                    >
                      <span className="font-mono text-slate-500 text-[11px] w-6 shrink-0 pt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-slate-300 text-xs">
                          {item.role && (
                            <span className={`font-semibold mr-1.5 ${
                              isGreen ? 'text-emerald-400' : 'text-sky-400'
                            }`}>
                              [{item.role}]
                            </span>
                          )}
                          <span>{item.text}</span>
                        </div>
                        {tr ? (
                          <div className={`text-xs font-medium pl-2 border-l ${
                            isGreen
                              ? 'text-emerald-200 border-emerald-500/40'
                              : 'text-sky-200 border-sky-500/40'
                          }`}>
                            {tr.role && (
                              <span className={`font-semibold mr-1.5 ${
                                isGreen ? 'text-teal-300' : 'text-cyan-300'
                              }`}>
                                [{tr.role}]
                              </span>
                            )}
                            <span>{tr.text}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic text-[11px]">Chưa dịch</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Export Translated Subtitles Grid */}
              <div className="pt-2 space-y-3">
                <h4 className={`font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isGreen ? 'text-emerald-300' : 'text-white'
                }`}>
                  <Download className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                  <span>{t('exportTranslatedHeading')} ({targetLang.toUpperCase()})</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Bilingual SRT */}
                  <button
                    type="button"
                    onClick={() => handleExport('bi_srt')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#06180e] hover:bg-[#0b2918] border-emerald-600/40 hover:border-emerald-400'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-sky-600/40 hover:border-sky-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs ${
                        isGreen ? 'text-emerald-300 group-hover:text-emerald-200' : 'text-sky-300 group-hover:text-sky-200'
                      }`}>
                        SRT Song Ngữ
                      </span>
                      <FileText className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Trung + {targetLang.toUpperCase()}</span>
                  </button>

                  {/* Translated SRT Only */}
                  <button
                    type="button"
                    onClick={() => handleExport('trans_srt')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        SRT Bản Dịch
                      </span>
                      <Download className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Chỉ {targetLang.toUpperCase()}</span>
                  </button>

                  {/* Bilingual VTT */}
                  <button
                    type="button"
                    onClick={() => handleExport('bi_vtt')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        VTT Song Ngữ
                      </span>
                      <FileText className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Web VTT song ngữ</span>
                  </button>

                  {/* Bilingual LRC */}
                  <button
                    type="button"
                    onClick={() => handleExport('bi_lrc')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        LRC Song Ngữ
                      </span>
                      <Music2 className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Khớp lời nhạc điện thoại</span>
                  </button>

                  {/* Translated VTT */}
                  <button
                    type="button"
                    onClick={() => handleExport('trans_vtt')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        VTT Bản Dịch
                      </span>
                      <Download className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Web Subtitle (.vtt)</span>
                  </button>

                  {/* Translated LRC */}
                  <button
                    type="button"
                    onClick={() => handleExport('trans_lrc')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        LRC Bản Dịch
                      </span>
                      <Music2 className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Lời nhạc (.lrc)</span>
                  </button>

                  {/* Bilingual TXT */}
                  <button
                    type="button"
                    onClick={() => handleExport('bi_txt')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        Kịch Bản Song Ngữ
                      </span>
                      <FileText className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Bản in đọc kịch (.txt)</span>
                  </button>

                  {/* Translated TXT */}
                  <button
                    type="button"
                    onClick={() => handleExport('trans_txt')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group ${
                      isGreen
                        ? 'bg-[#04120a] hover:bg-[#082012] border-[#133822] hover:border-emerald-500/50'
                        : 'bg-[#091326] hover:bg-[#0f1f3d] border-[#162744] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-heading font-bold text-xs text-white ${
                        isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
                      }`}>
                        Kịch Bản Dịch
                      </span>
                      <FileText className={`w-3.5 h-3.5 text-slate-400 ${
                        isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
                      }`} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">Văn bản thuần (.txt)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 ${
          isGreen ? 'border-[#133d24] bg-[#05180e]' : 'border-[#14233c] bg-[#070f20]'
        }`}>
          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-mono">
            <Plane className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
            <span>
              {isGreen
                ? 'KilaManbo Tactical Subtitle Translation Module'
                : 'MissEvan Flight Subtitle Translation Module'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-slate-300 text-xs font-semibold cursor-pointer border transition-colors ${
                isGreen
                  ? 'bg-[#071a10] hover:bg-[#0c2a1a] border-[#143a25]'
                  : 'bg-[#0c1830] hover:bg-[#142448] border-[#1a2f52]'
              }`}
            >
              Đóng
            </button>
            {hasTranslations && (
              <button
                type="button"
                onClick={handleApply}
                className={`px-4 py-2 rounded-xl text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all ${
                  isGreen
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300'
                    : 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('applyTranslationsToDeck')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
