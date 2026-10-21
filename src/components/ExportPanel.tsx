import React, { useState } from 'react';
import {
  FileText,
  Archive,
  Copy,
  Check,
  Music2,
  Code,
  Radio,
  Download,
  Loader2,
  Image as ImageIcon,
  Plane,
} from 'lucide-react';
import { MissEvanDanmakuItem, MissEvanSoundInfo } from '../types/missevan';
import {
  generateSRT,
  generateLRC,
  generateVTT,
  generateASS,
  generateTXT,
  generateTranslatedSRT,
  generateBilingualSRT,
  generateTranslatedVTT,
  generateBilingualVTT,
  generateTranslatedLRC,
  generateBilingualLRC,
  generateTranslatedTXT,
  generateBilingualTXT,
  downloadFile,
  downloadAllAsZip,
  sanitizeFilename,
} from '../utils/formatter';
import { safeTriggerAudioDownload } from '../utils/audioDownloader';
import { getCoverFilename, downloadCoverImage, getHighResCoverUrl } from '../utils/coverDownloader';
import { useLanguage } from '../context/LanguageContext';
import { Languages, Sparkles } from 'lucide-react';

interface ExportPanelProps {
  items: MissEvanDanmakuItem[];
  soundInfo: MissEvanSoundInfo | null;
  rawXml?: string;
  timeOffset: number;
  onOpenTranslateModal?: () => void;
  targetLang?: 'vi' | 'en' | 'es';
  customBaseTitle?: string;
  onCustomDownloadAudio?: () => Promise<void> | void;
  customAudioDownloading?: boolean;
  customAudioProgress?: number;
  customAudioSuccess?: boolean;
  customAudioError?: string | null;
  isVipLocked?: boolean;
  onOpenVipModal?: () => void;
  theme?: 'missevan' | 'kilamanbo';
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  items,
  soundInfo,
  rawXml = '',
  timeOffset,
  onOpenTranslateModal,
  targetLang = 'vi',
  customBaseTitle,
  onCustomDownloadAudio,
  customAudioDownloading,
  customAudioProgress,
  customAudioSuccess,
  customAudioError,
  isVipLocked,
  onOpenVipModal,
  theme = 'missevan',
}) => {
  const { t } = useLanguage();
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [isAudioDownloading, setIsAudioDownloading] = useState(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioDownloaded, setAudioDownloaded] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [coverDownloaded, setCoverDownloaded] = useState(false);

  const isGreen = theme === 'kilamanbo';

  const baseTitle = customBaseTitle
    ? sanitizeFilename(customBaseTitle)
    : soundInfo
    ? `MissEvan_${soundInfo.id}_${sanitizeFilename(soundInfo.soundstr)}`
    : 'missevan_avionics_subtitles';

  const rawCoverUrl = soundInfo?.front_cover || soundInfo?.cover_image;
  const hdCoverUrl = rawCoverUrl ? getHighResCoverUrl(rawCoverUrl) : '';

  const handleDownloadCover = async () => {
    if (!hdCoverUrl || !soundInfo) return;
    const filename = getCoverFilename(soundInfo.soundstr || `sound_${soundInfo.id}`, `ep_${soundInfo.id}`);
    await downloadCoverImage(hdCoverUrl, filename);
    setCoverDownloaded(true);
    setTimeout(() => setCoverDownloaded(false), 2500);
  };

  const effectiveAudioDownloading = customAudioDownloading !== undefined ? customAudioDownloading : isAudioDownloading;
  const effectiveAudioProgress = customAudioProgress !== undefined ? customAudioProgress : audioProgress;
  const effectiveAudioDownloaded = customAudioSuccess !== undefined ? customAudioSuccess : audioDownloaded;
  const effectiveAudioError = customAudioError || audioNotice;

  const handleDownloadAudio = async () => {
    if (isVipLocked && onOpenVipModal && theme !== 'kilamanbo') {
      onOpenVipModal();
      return;
    }
    if (onCustomDownloadAudio) {
      await onCustomDownloadAudio();
      return;
    }
    if (!soundInfo || isAudioDownloading) return;
    setIsAudioDownloading(true);
    setAudioProgress(0);
    setAudioNotice(null);
    try {
      const result = await safeTriggerAudioDownload(
        String(soundInfo.id),
        soundInfo.soundstr,
        (percent) => setAudioProgress(percent)
      );
      if (!result.ok) {
        setAudioNotice(result.error || t('vipLockedNotice'));
      } else {
        setAudioDownloaded(true);
        setTimeout(() => setAudioDownloaded(false), 3000);
      }
    } catch (err) {
      console.error('Download audio error:', err);
    } finally {
      setIsAudioDownloading(false);
      setAudioProgress(0);
    }
  };

  const handleDownload = (format: 'srt' | 'lrc' | 'vtt' | 'ass' | 'txt' | 'json' | 'xml') => {
    if (items.length === 0 && format !== 'xml') return;

    switch (format) {
      case 'srt':
        downloadFile(generateSRT(items, timeOffset), `${baseTitle}.srt`);
        break;
      case 'lrc':
        downloadFile(generateLRC(items, soundInfo, timeOffset), `${baseTitle}.lrc`);
        break;
      case 'vtt':
        downloadFile(generateVTT(items, timeOffset), `${baseTitle}.vtt`);
        break;
      case 'ass':
        downloadFile(generateASS(items, soundInfo, timeOffset), `${baseTitle}.ass`);
        break;
      case 'txt':
        downloadFile(generateTXT(items, true, timeOffset), `${baseTitle}_transcript.txt`);
        break;
      case 'json':
        downloadFile(JSON.stringify(items, null, 2), `${baseTitle}_data.json`, 'application/json');
        break;
      case 'xml':
        if (rawXml) downloadFile(rawXml, `${baseTitle}_raw.xml`, 'application/xml');
        break;
    }
  };

  const handleCopySRT = () => {
    const srt = generateSRT(items, timeOffset);
    navigator.clipboard.writeText(srt);
    setCopiedFormat('srt');
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      await downloadAllAsZip(items, soundInfo, rawXml, timeOffset, customBaseTitle);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className={`rounded-2xl p-6 mt-7 shadow-2xl shadow-black/60 text-left border ${
      isGreen ? 'bg-[#040c08] border-[#113121]' : 'bg-[#060c18] border-[#162744]'
    }`}>
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-5 border-b ${
        isGreen ? 'border-[#113121]' : 'border-[#14233c]'
      }`}>
        <div>
          <h3 className="font-heading text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Plane className={`w-5 h-5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
            <span>{t('exportConsole')}</span>
          </h3>
        </div>

        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={isZipping || items.length === 0}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
            isGreen
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-950/60'
              : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 hover:from-sky-400 hover:to-cyan-300 text-slate-950 shadow-sky-950/60'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>{isZipping ? t('compressingZip') : t('downloadAllZip')}</span>
        </button>
      </div>

      {/* Featured Audio Track Download Strip */}
      {soundInfo && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 shadow-inner ${
          isGreen
            ? 'bg-gradient-to-r from-[#06140d] via-[#040e09] to-[#081a11] border-[#163e2a]'
            : 'bg-gradient-to-r from-[#0a1428] via-[#091224] to-[#0e1c38] border-[#1b335a]'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow ${
              isGreen
                ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-400'
                : 'bg-sky-950/80 border-sky-600/60 text-sky-400'
            }`}>
              <Music2 className={`w-5 h-5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-heading font-bold text-white text-base truncate">
                  {t('directAudioDownloadTitle')}
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border shrink-0 ${
                  isGreen
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                }`}>
                  {isGreen ? 'KilaManbo Audio' : t('audioQualityBadge')}
                </span>
                {isVipLocked && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-950/90 text-amber-300 border border-amber-700/60 shrink-0">
                    VIP LOCKED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                {soundInfo.soundstr || `ID ${soundInfo.id}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadAudio}
            disabled={effectiveAudioDownloading}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shrink-0 ${
              isVipLocked
                ? 'bg-amber-950/80 hover:bg-amber-900 border border-amber-600 text-amber-300 shadow-amber-950/50'
                : effectiveAudioDownloaded
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-950/60'
                : isGreen
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-950/60'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-950/60'
            }`}
          >
            {effectiveAudioDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>{t('downloadingAudio')} {effectiveAudioProgress > 0 ? `${effectiveAudioProgress}%` : ''}...</span>
              </>
            ) : effectiveAudioDownloaded ? (
              <>
                <Check className="w-4 h-4" />
                <span>{t('audioDownloadedSuccess')}</span>
              </>
            ) : isVipLocked ? (
              <>
                <span>🔒 Mở Khóa VIP Audio</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{t('downloadAudioFile')}</span>
              </>
            )}
          </button>
        </div>
      )}

      {effectiveAudioError && (
        <div className="p-3.5 mb-5 rounded-xl bg-amber-950/30 border border-amber-600/60 text-amber-200 text-xs flex items-center justify-between gap-3">
          <span>
            🔒 <strong>Alert:</strong> {effectiveAudioError}
          </span>
          <button
            type="button"
            onClick={() => setAudioNotice(null)}
            className="text-amber-300 hover:text-white cursor-pointer shrink-0"
          >
            &times;
          </button>
        </div>
      )}

      {/* Format Grid - Subtitles + Audio + HD Cover */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {/* Audio Track Button */}
        <button
          type="button"
          onClick={handleDownloadAudio}
          disabled={effectiveAudioDownloading || !soundInfo}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-500'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-500'
          }`}
          title={t('downloadAudio')}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-emerald-400' : 'text-sky-400'
            }`}>
              {isGreen ? '.MP4' : '.M4A'}
            </span>
            <span className={`block text-[10px] ${isGreen ? 'text-emerald-300/80' : 'text-sky-300/80'}`}>
              {isVipLocked ? 'VIP Locked' : t('formatAudio')}
            </span>
          </div>
          <Music2 className={`w-4 h-4 group-hover:scale-110 transition-transform shrink-0 ${
            isGreen ? 'text-emerald-400' : 'text-sky-400'
          }`} />
        </button>

        {/* .JPG Cover Art */}
        <button
          type="button"
          onClick={handleDownloadCover}
          disabled={!hdCoverUrl}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-teal-400'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-cyan-400'
          }`}
          title={t('downloadCover')}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-teal-300' : 'text-cyan-300'
            }`}>.JPG</span>
            <span className={`block text-[10px] ${isGreen ? 'text-teal-300/80' : 'text-cyan-300/80'}`}>
              {coverDownloaded ? t('coverDownloaded') : t('formatCover')}
            </span>
          </div>
          {coverDownloaded ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ImageIcon className={`w-4 h-4 group-hover:scale-110 transition-transform shrink-0 ${
              isGreen ? 'text-teal-400' : 'text-cyan-400'
            }`} />
          )}
        </button>

        {/* .SRT */}
        <button
          type="button"
          onClick={() => handleDownload('srt')}
          disabled={items.length === 0}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-400'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-400'
          }`}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-emerald-300' : 'text-sky-300'
            }`}>.SRT</span>
            <span className="block text-[10px] text-slate-400">{t('formatSrt')}</span>
          </div>
          <FileText className={`w-4 h-4 text-slate-500 transition-colors shrink-0 ${
            isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
          }`} />
        </button>

        {/* .LRC */}
        <button
          type="button"
          onClick={() => handleDownload('lrc')}
          disabled={items.length === 0}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-400'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-400'
          }`}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-emerald-300' : 'text-sky-300'
            }`}>.LRC</span>
            <span className="block text-[10px] text-slate-400">{t('formatLrc')}</span>
          </div>
          <Music2 className={`w-4 h-4 text-slate-500 transition-colors shrink-0 ${
            isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
          }`} />
        </button>

        {/* .VTT */}
        <button
          type="button"
          onClick={() => handleDownload('vtt')}
          disabled={items.length === 0}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-400'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-400'
          }`}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-emerald-300' : 'text-sky-300'
            }`}>.VTT</span>
            <span className="block text-[10px] text-slate-400">{t('formatVtt')}</span>
          </div>
          <FileText className={`w-4 h-4 text-slate-500 transition-colors shrink-0 ${
            isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
          }`} />
        </button>

        {/* .ASS */}
        <button
          type="button"
          onClick={() => handleDownload('ass')}
          disabled={items.length === 0}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-400'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-400'
          }`}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-emerald-300' : 'text-sky-300'
            }`}>.ASS</span>
            <span className="block text-[10px] text-slate-400">{t('formatAss')}</span>
          </div>
          <Code className={`w-4 h-4 text-slate-500 transition-colors shrink-0 ${
            isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
          }`} />
        </button>

        {/* .TXT */}
        <button
          type="button"
          onClick={() => handleDownload('txt')}
          disabled={items.length === 0}
          className={`group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer disabled:opacity-50 shadow-sm text-left ${
            isGreen
              ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-400'
              : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-400'
          }`}
        >
          <div>
            <span className={`font-mono font-bold text-base group-hover:text-white ${
              isGreen ? 'text-emerald-300' : 'text-sky-300'
            }`}>.TXT</span>
            <span className="block text-[10px] text-slate-400">{t('formatTxt')}</span>
          </div>
          <FileText className={`w-4 h-4 text-slate-500 transition-colors shrink-0 ${
            isGreen ? 'group-hover:text-emerald-400' : 'group-hover:text-sky-400'
          }`} />
        </button>
      </div>

      {/* Translated Subtitles Section */}
      {items.some((i) => Boolean(i.translatedText)) ? (
        <div className="mt-5 pt-5 border-t border-[#14233c] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-sky-400" />
              <h4 className="font-heading font-bold text-white text-xs uppercase tracking-wider">
                {t('exportTranslatedHeading')} ({targetLang.toUpperCase()})
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 border border-sky-700/60 text-sky-300">
                {items.filter((i) => Boolean(i.translatedText)).length}/{items.length} {t('translatedLinesCount').replace('{count}', '')}
              </span>
            </div>

            {onOpenTranslateModal && (
              <button
                type="button"
                onClick={onOpenTranslateModal}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>{t('translateSubtitlesBtn')} &rarr;</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Bilingual SRT */}
            <button
              type="button"
              onClick={() => downloadFile(generateBilingualSRT(items, timeOffset), `${baseTitle}_[ZH-${targetLang.toUpperCase()}_Bilingual].srt`)}
              className="p-3 rounded-xl bg-[#091326] hover:bg-[#0f2142] border border-sky-500/50 hover:border-sky-400 text-left transition-all cursor-pointer group shadow-sm"
            >
              <span className="font-mono font-bold text-sm text-sky-300 group-hover:text-white block">.SRT Song Ngữ</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Tiếng Trung + {targetLang.toUpperCase()}</span>
            </button>

            {/* Translated SRT Only */}
            <button
              type="button"
              onClick={() => downloadFile(generateTranslatedSRT(items, timeOffset), `${baseTitle}_[${targetLang.toUpperCase()}].srt`)}
              className="p-3 rounded-xl bg-[#091326] hover:bg-[#0f2142] border border-[#1a2f52] hover:border-sky-400 text-left transition-all cursor-pointer group shadow-sm"
            >
              <span className="font-mono font-bold text-sm text-white group-hover:text-sky-300 block">.SRT Bản Dịch</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Chỉ {targetLang.toUpperCase()}</span>
            </button>

            {/* Bilingual VTT */}
            <button
              type="button"
              onClick={() => downloadFile(generateBilingualVTT(items, timeOffset), `${baseTitle}_[ZH-${targetLang.toUpperCase()}_Bilingual].vtt`)}
              className="p-3 rounded-xl bg-[#091326] hover:bg-[#0f2142] border border-[#1a2f52] hover:border-sky-400 text-left transition-all cursor-pointer group shadow-sm"
            >
              <span className="font-mono font-bold text-sm text-white group-hover:text-sky-300 block">.VTT Song Ngữ</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Web VTT Chuẩn</span>
            </button>

            {/* Bilingual LRC */}
            <button
              type="button"
              onClick={() => downloadFile(generateBilingualLRC(items, soundInfo, timeOffset), `${baseTitle}_[ZH-${targetLang.toUpperCase()}_Bilingual].lrc`)}
              className="p-3 rounded-xl bg-[#091326] hover:bg-[#0f2142] border border-[#1a2f52] hover:border-sky-400 text-left transition-all cursor-pointer group shadow-sm"
            >
              <span className="font-mono font-bold text-sm text-white group-hover:text-sky-300 block">.LRC Song Ngữ</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Khớp lời nhạc</span>
            </button>

            {/* Bilingual TXT */}
            <button
              type="button"
              onClick={() => downloadFile(generateBilingualTXT(items, true, timeOffset), `${baseTitle}_[ZH-${targetLang.toUpperCase()}_Bilingual]_script.txt`)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer group shadow-sm ${
                isGreen
                  ? 'bg-[#06140d] hover:bg-[#0c2419] border-[#153a27] hover:border-emerald-400'
                  : 'bg-[#091326] hover:bg-[#0f2142] border-[#1a2f52] hover:border-sky-400'
              }`}
            >
              <span className={`font-mono font-bold text-sm text-white block ${
                isGreen ? 'group-hover:text-emerald-300' : 'group-hover:text-sky-300'
              }`}>.TXT Kịch Bản</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Bản in đối chiếu</span>
            </button>
          </div>
        </div>
      ) : onOpenTranslateModal ? (
        <div className={`mt-5 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border ${
          isGreen
            ? 'border-[#113121] bg-[#05140d]/80'
            : 'border-[#14233c] bg-[#081020]/70'
        }`}>
          <div className="flex items-center gap-2.5">
            <Sparkles className={`w-4 h-4 shrink-0 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
            <p className="text-xs text-slate-300">
              {t('translationToolSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenTranslateModal}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm shrink-0 ${
              isGreen
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border-emerald-500/50 hover:border-emerald-400 text-emerald-200'
                : 'bg-gradient-to-r from-sky-500/20 to-cyan-500/20 hover:from-sky-500/30 hover:to-cyan-500/30 border-sky-500/50 hover:border-sky-400 text-sky-200'
            }`}
          >
            <Languages className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
            <span>{t('translateSubtitlesBtn')}</span>
          </button>
        </div>
      ) : null}

      {/* Quick Clipboard Action */}
      <div className={`mt-5 pt-3.5 border-t flex items-center justify-between text-xs text-slate-400 ${
        isGreen ? 'border-[#113121]' : 'border-[#14233c]'
      }`}>
        <span>{t('copySrtClipboard')}:</span>
        <button
          type="button"
          onClick={handleCopySRT}
          className={`inline-flex items-center gap-1.5 transition-colors font-medium cursor-pointer ${
            isGreen
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'text-sky-400 hover:text-sky-300'
          }`}
        >
          {copiedFormat === 'srt' ? (
            <>
              <Check className={`w-3.5 h-3.5 ${isGreen ? 'text-emerald-400' : 'text-sky-400'}`} />
              <span className={isGreen ? 'text-emerald-300' : 'text-sky-300'}>{t('copiedSrtNotice')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{t('copySrtClipboard')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
