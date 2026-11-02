import React, { useState, useEffect } from 'react';
import {
  Languages,
  Sparkles,
  Download,
  Loader2,
  Check,
  FileText,
  Radio,
  SlidersHorizontal,
  Trash2,
  ExternalLink,
  ChevronRight,
  Eye,
  RefreshCw,
  Globe,
  ShieldAlert,
  Lock,
  Unlock,
} from 'lucide-react';
import { MissEvanDanmakuItem, MissEvanSoundInfo } from '../types/missevan';
import { SubtitleTargetLanguage } from './SubtitleTranslationModal';
import { SubtitleDisplayMode } from './SubtitleTable';
import {
  generateTranslatedSRT,
  generateBilingualSRT,
  generateTranslatedVTT,
  generateTranslatedLRC,
  generateTranslatedTXT,
  generateBilingualTXT,
  downloadFile,
  sanitizeFilename,
} from '../utils/formatter';
import { useLanguage } from '../context/LanguageContext';
import {
  TranslationAdvisoryBarrier,
  SubtitleTranslationEngine,
  isTranslationUnlocked,
  lockTranslationTool,
  ENGINE_STORAGE_KEY,
} from './TranslationAdvisoryBarrier';

interface SubtitleTranslationBannerProps {
  items: MissEvanDanmakuItem[];
  soundInfo: MissEvanSoundInfo | null;
  timeOffset: number;
  targetLang: SubtitleTargetLanguage;
  onTargetLangChange: (lang: SubtitleTargetLanguage) => void;
  displayMode: SubtitleDisplayMode;
  onDisplayModeChange: (mode: SubtitleDisplayMode) => void;
  translationsMap: Record<string, { text: string; role?: string }>;
  onApplyTranslations: (
    map: Record<string, { text: string; role?: string }>,
    lang: SubtitleTargetLanguage
  ) => void;
  onClearTranslations: () => void;
  onOpenModal: () => void;
  platform?: 'missevan' | 'kilamanbo';
}

export const SubtitleTranslationBanner: React.FC<SubtitleTranslationBannerProps> = ({
  items,
  soundInfo,
  timeOffset,
  targetLang,
  onTargetLangChange,
  displayMode,
  onDisplayModeChange,
  translationsMap,
  onApplyTranslations,
  onClearTranslations,
  onOpenModal,
  platform = 'missevan',
}) => {
  const { t, language } = useLanguage();
  const isGreen = platform === 'kilamanbo';
  const appNameText = isGreen ? 'KilaManbo' : 'MissEvan';

  const [engine, setEngine] = useState<SubtitleTranslationEngine>(() => {
    try {
      const saved = localStorage.getItem(ENGINE_STORAGE_KEY);
      return saved === 'google' ? 'google' : 'gemini';
    } catch {
      return 'gemini';
    }
  });

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isTranslationUnlocked());

  useEffect(() => {
    const handleUnlocked = () => setIsUnlocked(true);
    const handleLocked = () => setIsUnlocked(false);
    window.addEventListener('subtitle-translation-unlocked', handleUnlocked);
    window.addEventListener('subtitle-translation-locked', handleLocked);
    return () => {
      window.removeEventListener('subtitle-translation-unlocked', handleUnlocked);
      window.removeEventListener('subtitle-translation-locked', handleLocked);
    };
  }, []);

  const [showAdvisoryModal, setShowAdvisoryModal] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleSelectEngine = (newEngine: SubtitleTranslationEngine) => {
    setEngine(newEngine);
    try {
      localStorage.setItem(ENGINE_STORAGE_KEY, newEngine);
    } catch {
      // ignore
    }
  };

  const handleDismissAdvisory = () => {
    setIsUnlocked(true);
    setShowAdvisoryModal(false);
  };

  const handleLockTool = () => {
    lockTranslationTool();
    setIsUnlocked(false);
  };

  const totalLines = items.length;
  const translatedLinesCount = Object.keys(translationsMap).length;
  const isFullyTranslated = totalLines > 0 && translatedLinesCount >= totalLines;
  const hasSomeTranslations = translatedLinesCount > 0;

  const baseTitle = soundInfo
    ? `${isGreen ? 'KilaManbo' : 'MissEvan'}_${soundInfo.id}_${sanitizeFilename(soundInfo.soundstr)}`
    : `${isGreen ? 'kilamanbo' : 'missevan'}_subtitles`;

  const handleStartTranslate = async (langToUse = targetLang) => {
    if (items.length === 0 || isTranslating) return;

    setIsTranslating(true);
    setErrorMsg(null);
    setProgressCount(0);

    try {
      const CHUNK_SIZE = 30;
      const total = items.length;
      const newMap: Record<string, { text: string; role?: string }> = { ...translationsMap };

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
            targetLang: langToUse,
            engine,
            dramaContext: soundInfo?.soundstr,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}: Failed to translate chunk`);
        }

        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          for (const item of json.data) {
            newMap[item.id] = {
              text: item.translated,
              role: item.translatedRole,
            };
          }
          onApplyTranslations(newMap, langToUse);
        }

        setProgressCount(Math.min(total, i + CHUNK_SIZE));
      }

      onDisplayModeChange('bilingual');
    } catch (err: any) {
      console.error('Translation error in banner:', err);
      setErrorMsg(err.message || t('translationFailedNotice'));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTriggerTranslate = (langToUse = targetLang) => {
    if (!isUnlocked) {
      setShowAdvisoryModal(true);
      return;
    }
    handleStartTranslate(langToUse);
  };

  const handleQuickDownload = (format: 'bilingual_srt' | 'trans_srt' | 'vtt' | 'lrc' | 'txt') => {
    // Merge active translations into items
    const merged = items.map((it) => {
      const tr = translationsMap[it.id];
      return tr
        ? {
            ...it,
            translatedText: tr.text,
            translatedRole: tr.role,
            translationLang: targetLang,
          }
        : it;
    });

    const langSuffix = targetLang.toUpperCase();

    switch (format) {
      case 'bilingual_srt':
        downloadFile(
          generateBilingualSRT(merged, timeOffset),
          `${baseTitle}_[ZH_${langSuffix}].srt`
        );
        break;
      case 'trans_srt':
        downloadFile(
          generateTranslatedSRT(merged, timeOffset),
          `${baseTitle}_[${langSuffix}].srt`
        );
        break;
      case 'vtt':
        downloadFile(
          generateTranslatedVTT(merged, timeOffset),
          `${baseTitle}_[${langSuffix}].vtt`
        );
        break;
      case 'lrc':
        downloadFile(
          generateTranslatedLRC(merged, soundInfo, timeOffset),
          `${baseTitle}_[${langSuffix}].lrc`
        );
        break;
      case 'txt':
        downloadFile(
          generateBilingualTXT(merged, true, timeOffset),
          `${baseTitle}_[ZH_${langSuffix}]_transcript.txt`
        );
        break;
    }

    setDownloadSuccess(format);
    setTimeout(() => setDownloadSuccess(null), 2000);
  };

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 p-4 sm:p-6 shadow-2xl animate-in fade-in transition-all ${
        isGreen
          ? 'border-emerald-500/50 bg-gradient-to-r from-[#03150a] via-[#052110] to-[#020e06] shadow-emerald-950/70 military-grid'
          : 'border-sky-500/50 bg-gradient-to-r from-[#040916] via-[#07132a] to-[#040916] shadow-sky-950/60'
      }`}
    >
      {/* Background Accent Radar Glow */}
      <div
        className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl ${
          isGreen ? 'bg-emerald-500/15' : 'bg-sky-500/10'
        }`}
      />
      <div
        className={`pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full blur-3xl ${
          isGreen ? 'bg-teal-500/15' : 'bg-cyan-500/10'
        }`}
      />

      {/* In-Place Locked Blur Barrier Overlay (active before unlocking) */}
      {!isUnlocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-5 sm:p-7 text-center bg-slate-950/80 backdrop-blur-md rounded-2xl border-2 border-amber-500/40 animate-in fade-in">
          <div className="max-w-md space-y-3.5 my-auto">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center border shadow-xl ${
                isGreen
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-emerald-950/70'
                  : 'bg-amber-950/80 border-amber-500/50 text-amber-400 shadow-amber-950/70'
              }`}
            >
              <Lock className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold tracking-wider px-2.5 py-0.5 rounded border uppercase ${
                    isGreen
                      ? 'bg-emerald-950 border-emerald-600/70 text-emerald-300'
                      : 'bg-amber-950 border-amber-600/70 text-amber-300'
                  }`}
                >
                  {language === 'vi' ? 'TRÌNH DỊCH ĐANG ĐƯỢC KHÓA BẢO VỆ' : 'TRANSLATOR ACCESS LOCKED'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {isGreen ? 'KilaManbo 漫播' : 'MissEvan 猫耳FM'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-heading font-extrabold text-white">
                {language === 'vi' ? 'Cần Đọc Lưu Ý Trước Khi Dịch Phụ Đề' : 'Read AI Advisory Before Accessing Translator'}
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {language === 'vi'
                  ? 'Công cụ dịch phụ đề có tích hợp AI (Gemini). Do AI có thể tự do phóng tác làm lệch nghĩa thoại gốc tiếng Trung, hệ thống yêu cầu bạn đọc kỹ bảng lưu ý và xác nhận động cơ dịch (Gemini hoặc Google Translate) trước khi mở khóa.'
                  : 'The translation tool integrates Gemini AI. Because AI models may infer creative nuances that distort original Chinese script lines, you must read the advisory notice before unlocking the tool.'}
              </p>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowAdvisoryModal(true)}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-heading font-extrabold text-xs flex items-center justify-center gap-2 text-slate-950 cursor-pointer shadow-lg transition-all ring-2 ${
                  isGreen
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 ring-emerald-400/50 shadow-emerald-950/80'
                    : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-200 ring-amber-400/50 shadow-amber-950/80'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-slate-950" />
                <span>{language === 'vi' ? 'ĐỌC LƯU Ý & MỞ KHÓA TRÌNH DỊCH' : 'READ NOTICE & UNLOCK TRANSLATOR'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Underlying Content Container - blurred when locked */}
      <div className={`relative z-10 flex flex-col gap-5 transition-all duration-500 ${
        !isUnlocked ? 'filter blur-md select-none pointer-events-none opacity-25 scale-[0.99]' : ''
      }`}>
        {/* Header Bar */}
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4 ${
          isGreen ? 'border-[#143a25]' : 'border-[#142848]'
        }`}>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  isGreen
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                    : 'bg-sky-500/20 border border-sky-400/50 text-sky-300'
                }`}
              >
                <Languages className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span>
                  {isGreen
                    ? language === 'vi'
                      ? 'KILAMANBO · CÔNG CỤ DỊCH PHỤ ĐỀ'
                      : 'KILAMANBO SUBTITLE TRANSLATION TOOL'
                    : t('translationToolTitle')}
                </span>
              </span>

              {hasSomeTranslations && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  isGreen
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
                }`}>
                  <Check className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                  <span>
                    {translatedLinesCount} / {totalLines} {t('colText').toLowerCase()}
                  </span>
                </span>
              )}

              {isTranslating && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-mono text-amber-300 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  <span>
                    {t('translatingProgress', { current: progressCount, total: totalLines })}
                  </span>
                </span>
              )}
            </div>

            <h2 className="font-heading text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>
                {language === 'vi'
                  ? `Dịch Phụ Đề ${appNameText} Sang Tiếng Việt / English / Español`
                  : `Translate ${appNameText} Subtitles into Vietnamese / English / Español`}
              </span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isGreen
                ? language === 'vi'
                  ? 'Tự động đối soát lời thoại kịch truyền thanh KilaManbo (漫播), chuẩn hóa danh xưng Hán Việt cho tên nhân vật và lời thoại giàu cảm xúc. Tải trực tiếp file phụ đề song ngữ SRT để dựng video hoặc lưu trữ.'
                  : 'Automated KilaManbo audio drama translation, standardizing Sino-Vietnamese names and emotional speech. Directly export bilingual SRT/LRC subtitles.'
                : 'Tự động đối soát lời thoại audio drama, chuẩn hóa danh xưng Hán Việt cho tên nhân vật và lời thoại giàu cảm xúc. Tải trực tiếp file phụ đề song ngữ SRT để dựng video hoặc lưu trữ.'}
            </p>
          </div>

          {/* Advanced Modal Opener & Engine Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Engine Switcher Capsule */}
            <div className={`p-1 rounded-xl border flex items-center gap-1 ${
              isGreen ? 'bg-[#041209] border-[#143a25]' : 'bg-[#081224] border-[#162947]'
            }`}>
              <button
                type="button"
                onClick={() => handleSelectEngine('google')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  engine === 'google'
                    ? isGreen
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={language === 'vi' ? 'Google Translate: Dịch sát nghĩa từng từ, không phóng tác hay chế nghĩa' : 'Google Translate: Strict verbatim literal translation'}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Google Translate</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  engine === 'google'
                    ? 'bg-slate-950/30 text-slate-900 font-extrabold'
                    : 'bg-emerald-950 text-emerald-400'
                }`}>
                  {language === 'vi' ? 'Sát nghĩa' : 'Literal'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectEngine('gemini')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  engine === 'gemini'
                    ? isGreen
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={language === 'vi' ? 'Gemini AI: Dịch giàu cảm xúc thoại kịch, có thể tự do phóng tác' : 'Gemini AI: Expressive audio drama translation'}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gemini AI</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  engine === 'gemini'
                    ? 'bg-slate-950/30 text-slate-900 font-extrabold'
                    : 'bg-cyan-950 text-cyan-400'
                }`}>
                  {language === 'vi' ? 'Kịch nói' : 'Drama'}
                </span>
              </button>
            </div>

            {/* AI Accuracy Advisory Trigger */}
            <button
              type="button"
              onClick={() => setShowAdvisoryModal(true)}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-amber-500/15 border border-amber-500/35 text-amber-300 hover:bg-amber-500/25"
              title={language === 'vi' ? 'Xem lưu ý về AI và Google Translate' : 'View AI & Google Translate Advisory'}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-mono">
                {language === 'vi' ? 'Lưu Ý AI' : 'Notice'}
              </span>
            </button>

            {/* Re-lock Button (allows user to lock the translation tool back) */}
            <button
              type="button"
              onClick={handleLockTool}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white"
              title={language === 'vi' ? 'Khóa lại công cụ dịch phụ đề' : 'Lock translator'}
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden xl:inline font-mono text-[11px]">{language === 'vi' ? 'Khóa lại' : 'Lock'}</span>
            </button>

            {/* Advanced Modal Opener */}
            <button
              type="button"
              onClick={onOpenModal}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                isGreen
                  ? 'bg-[#06180d] hover:bg-[#0c2e1b] border border-[#164429] hover:border-emerald-400/60 text-emerald-200'
                  : 'bg-[#09152b] hover:bg-[#0f2142] border border-[#1b345e] hover:border-sky-400/60 text-sky-200'
              }`}
              title="Cài đặt ghi chú nhân vật, bối cảnh kịch và xem đối chiếu chi tiết"
            >
              <SlidersHorizontal className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
              <span>Tùy Chọn Nâng Cao</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Translation Controls & Actions Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Target Language Buttons */}
          <div className="lg:col-span-6 flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {t('targetLanguage')}:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onTargetLangChange('vi');
                  if (hasSomeTranslations && targetLang !== 'vi') {
                    handleTriggerTranslate('vi');
                  }
                }}
                className={`px-3 py-2.5 rounded-xl border text-xs font-heading font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  targetLang === 'vi'
                    ? isGreen
                      ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-slate-950 border-emerald-300 shadow-md shadow-emerald-950/80'
                      : 'bg-gradient-to-b from-sky-500 to-sky-600 text-slate-950 border-sky-300 shadow-md shadow-sky-950/80'
                    : isGreen
                      ? 'bg-[#05140b] hover:bg-[#092213] border-[#143a25] text-slate-300 hover:text-white'
                      : 'bg-[#081224] hover:bg-[#0e1d38] border-[#182c4c] text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-sm">🇻🇳 Tiếng Việt</span>
                <span className={`text-[10px] font-sans font-normal ${targetLang === 'vi' ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                  Chuẩn Hán Việt
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onTargetLangChange('en');
                  if (hasSomeTranslations && targetLang !== 'en') {
                    handleTriggerTranslate('en');
                  }
                }}
                className={`px-3 py-2.5 rounded-xl border text-xs font-heading font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  targetLang === 'en'
                    ? isGreen
                      ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-slate-950 border-emerald-300 shadow-md shadow-emerald-950/80'
                      : 'bg-gradient-to-b from-sky-500 to-sky-600 text-slate-950 border-sky-300 shadow-md shadow-sky-950/80'
                    : isGreen
                      ? 'bg-[#05140b] hover:bg-[#092213] border-[#143a25] text-slate-300 hover:text-white'
                      : 'bg-[#081224] hover:bg-[#0e1d38] border-[#182c4c] text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-sm">🇬🇧 English</span>
                <span className={`text-[10px] font-sans font-normal ${targetLang === 'en' ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                  Standard Pinyin
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onTargetLangChange('es');
                  if (hasSomeTranslations && targetLang !== 'es') {
                    handleTriggerTranslate('es');
                  }
                }}
                className={`px-3 py-2.5 rounded-xl border text-xs font-heading font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all ${
                  targetLang === 'es'
                    ? isGreen
                      ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-slate-950 border-emerald-300 shadow-md shadow-emerald-950/80'
                      : 'bg-gradient-to-b from-sky-500 to-sky-600 text-slate-950 border-sky-300 shadow-md shadow-sky-950/80'
                    : isGreen
                      ? 'bg-[#05140b] hover:bg-[#092213] border-[#143a25] text-slate-300 hover:text-white'
                      : 'bg-[#081224] hover:bg-[#0e1d38] border-[#182c4c] text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-sm">🇪🇸 Español</span>
                <span className={`text-[10px] font-sans font-normal ${targetLang === 'es' ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                  Natural Spoken
                </span>
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="lg:col-span-6 flex flex-col gap-1.5 justify-end">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {t('colActions')}:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleTriggerTranslate(targetLang)}
                disabled={isTranslating || totalLines === 0}
                className={`flex-1 py-3 px-5 rounded-xl font-heading font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 ${
                  isGreen
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 hover:from-emerald-300 hover:to-teal-200 shadow-lg shadow-emerald-950/70'
                    : 'bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500 hover:from-sky-300 hover:to-cyan-300 shadow-lg shadow-sky-950/70'
                }`}
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {t('translatingProgress', { current: progressCount, total: totalLines })}
                    </span>
                  </>
                ) : hasSomeTranslations ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Dịch Lại Toàn Bộ ({totalLines} câu)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>Dịch Toàn Bộ Phụ Đề ({totalLines} câu)</span>
                  </>
                )}
              </button>

              {hasSomeTranslations && (
                <button
                  type="button"
                  onClick={onClearTranslations}
                  disabled={isTranslating}
                  className="px-3.5 py-3 rounded-xl bg-[#12080c] hover:bg-[#1a0c12] border border-rose-900/60 hover:border-rose-600/70 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title={t('clearTranslationsBtn')}
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">{t('clearTranslationsBtn')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Progress Bar when translating */}
        {isTranslating && (
          <div className="space-y-1">
            <div className={`flex justify-between text-[11px] font-mono ${isGreen ? 'text-emerald-300' : 'text-sky-300'}`}>
              <span>Đang dịch lời thoại audio drama sang {targetLang === 'vi' ? 'Tiếng Việt' : targetLang === 'es' ? 'Español' : 'English'}...</span>
              <span>{Math.round((progressCount / (totalLines || 1)) * 100)}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden border ${isGreen ? 'bg-[#041209] border-[#143a25]' : 'bg-[#081224] border-[#162744]'}`}>
              <div
                className={`h-full transition-all duration-300 ${
                  isGreen
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                    : 'bg-gradient-to-r from-sky-400 to-cyan-400'
                }`}
                style={{ width: `${Math.round((progressCount / (totalLines || 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom Strip: Display Mode & Instant Download Buttons (when translations exist) */}
        {hasSomeTranslations && (
          <div className={`pt-3 border-t flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
            isGreen ? 'border-[#143a25]' : 'border-[#142848]'
          }`}>
            {/* Display Mode Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px] font-mono">
                {t('displayModeLabel')}
              </span>
              <div className={`inline-flex rounded-lg p-0.5 border ${
                isGreen ? 'bg-[#041209] border-[#143a25]' : 'bg-[#071020] border-[#182c4c]'
              }`}>
                <button
                  type="button"
                  onClick={() => onDisplayModeChange('bilingual')}
                  className={`px-3 py-1 rounded-md font-medium text-xs cursor-pointer transition-all ${
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
                  className={`px-3 py-1 rounded-md font-medium text-xs cursor-pointer transition-all ${
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
                  className={`px-3 py-1 rounded-md font-medium text-xs cursor-pointer transition-all ${
                    displayMode === 'original'
                      ? isGreen
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                        : 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Chỉ Lời Gốc
                </button>
              </div>
            </div>

            {/* Instant Download Quick Links */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-mono mr-1">Tải nhanh:</span>
              <button
                type="button"
                onClick={() => handleQuickDownload('bilingual_srt')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-sm ${
                  isGreen
                    ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600/70 text-emerald-200'
                    : 'bg-sky-950 hover:bg-sky-900 border-sky-600/70 text-sky-200'
                }`}
              >
                <Download className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span>SRT Song Ngữ</span>
                {downloadSuccess === 'bilingual_srt' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => handleQuickDownload('trans_srt')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  isGreen
                    ? 'bg-[#05140b] hover:bg-[#092213] border-[#143a25] text-slate-200'
                    : 'bg-[#0a162a] hover:bg-[#102240] border-[#1b345a] text-slate-200'
                }`}
              >
                <Download className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span>SRT Bản Dịch</span>
                {downloadSuccess === 'trans_srt' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => handleQuickDownload('vtt')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  isGreen
                    ? 'bg-[#05140b] hover:bg-[#092213] border-[#143a25] text-slate-200'
                    : 'bg-[#0a162a] hover:bg-[#102240] border-[#1b345a] text-slate-200'
                }`}
              >
                <Download className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span>VTT</span>
                {downloadSuccess === 'vtt' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => handleQuickDownload('txt')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                  isGreen
                    ? 'bg-[#05140b] hover:bg-[#092213] border-[#143a25] text-slate-200'
                    : 'bg-[#0a162a] hover:bg-[#102240] border-[#1b345a] text-slate-200'
                }`}
              >
                <FileText className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
                <span>Kịch Bản TXT</span>
                {downloadSuccess === 'txt' && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-white cursor-pointer ml-2"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Accuracy Advisory Barrier Modal */}
      {showAdvisoryModal && (
        <TranslationAdvisoryBarrier
          platform={platform}
          currentEngine={engine}
          onSelectEngine={handleSelectEngine}
          onDismiss={handleDismissAdvisory}
          isInlineOverlay={false}
        />
      )}
    </section>
  );
};
