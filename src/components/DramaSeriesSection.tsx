import React, { useState } from 'react';
import {
  FolderArchive,
  Play,
  Check,
  Radio,
  Layers,
  Clock,
  Download,
  Loader2,
  ExternalLink,
  ChevronRight,
  CheckSquare,
  Square,
  Music,
  Image as ImageIcon,
  Plane,
} from 'lucide-react';
import { MissEvanDramaData, MissEvanEpisode } from '../types/missevan';
import { formatTime } from '../utils/parser';
import { parseMissEvanXml } from '../utils/parser';
import { generateSRT, generateLRC, generateVTT, generateTXT, downloadFile, sanitizeFilename } from '../utils/formatter';
import { safeTriggerAudioDownload } from '../utils/audioDownloader';
import { getCoverThumbnailUrl, getCoverFilename, downloadCoverImage } from '../utils/coverDownloader';
import { useLanguage } from '../context/LanguageContext';
import JSZip from 'jszip';

interface DramaSeriesSectionProps {
  dramaData: MissEvanDramaData | null;
  isLoadingDrama: boolean;
  activeSoundId: string;
  onSelectEpisode: (soundId: string) => void;
  onFetchDrama: (dramaId: string) => void;
  onOpenCoverGallery?: () => void;
}

export const DramaSeriesSection: React.FC<DramaSeriesSectionProps> = ({
  dramaData,
  isLoadingDrama,
  activeSoundId,
  onSelectEpisode,
  onFetchDrama,
  onOpenCoverGallery,
}) => {
  const { t } = useLanguage();
  const [dramaInput, setDramaInput] = useState('');
  const [activeTab, setActiveTab] = useState<'main' | 'ft' | 'music' | 'all'>('main');
  const [selectedSoundIds, setSelectedSoundIds] = useState<number[]>([]);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [isBatchAudioDownloading, setIsBatchAudioDownloading] = useState(false);
  const [audioProgress, setAudioProgress] = useState({ current: 0, total: 0 });
  const [downloadingEpId, setDownloadingEpId] = useState<number | null>(null);

  const drama = dramaData?.drama;
  const mainEpisodes = dramaData?.episodes?.episode || [];
  const ftEpisodes = dramaData?.episodes?.ft || [];
  const musicEpisodes = dramaData?.episodes?.music || [];

  const allEpisodes = [...mainEpisodes, ...ftEpisodes, ...musicEpisodes];

  const displayedEpisodes = (() => {
    switch (activeTab) {
      case 'main':
        return mainEpisodes.length > 0 ? mainEpisodes : allEpisodes;
      case 'ft':
        return ftEpisodes;
      case 'music':
        return musicEpisodes;
      case 'all':
      default:
        return allEpisodes;
    }
  })();

  const extractDramaId = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const urlMatch = trimmed.match(/drama\/(\d+)/) || trimmed.match(/drama_id=(\d+)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractDramaId(dramaInput);
    if (id) {
      onFetchDrama(id);
    }
  };

  const handleSelectAll = () => {
    const ids = displayedEpisodes.map((ep) => ep.sound_id);
    setSelectedSoundIds(ids);
  };

  const handleDeselectAll = () => {
    setSelectedSoundIds([]);
  };

  const toggleSelectOne = (soundId: number) => {
    setSelectedSoundIds((prev) =>
      prev.includes(soundId) ? prev.filter((id) => id !== soundId) : [...prev, soundId]
    );
  };

  const handleBatchDownloadDrama = async () => {
    const episodesToDownload = allEpisodes.filter((ep) =>
      selectedSoundIds.length > 0 ? selectedSoundIds.includes(ep.sound_id) : true
    );

    if (episodesToDownload.length === 0) return;

    setIsBatchDownloading(true);
    setBatchProgress({ current: 0, total: episodesToDownload.length });

    const zip = new JSZip();
    const dramaName = drama?.name ? sanitizeFilename(drama.name) : 'Drama_Manifest_Subtitles';

    for (let i = 0; i < episodesToDownload.length; i++) {
      const ep = episodesToDownload[i];
      try {
        const [soundRes, dmRes] = await Promise.all([
          fetch(`/api/missevan/sound/${ep.sound_id}`).catch(() => null),
          fetch(`/api/missevan/danmaku/${ep.sound_id}`),
        ]);

        let soundTitle = ep.soundstr || ep.name || `Ep_${i + 1}`;
        if (soundRes && soundRes.ok) {
          const soundJson = await soundRes.json().catch(() => null);
          if (soundJson?.info?.sound?.soundstr) {
            soundTitle = soundJson.info.sound.soundstr;
          }
        }

        if (dmRes.ok) {
          const xml = await dmRes.text();
          const allItems = parseMissEvanXml(xml);
          let subItems = allItems.filter((item) => item.mode === 4);
          if (subItems.length === 0) {
            subItems = allItems;
          }

          const safeTitle = sanitizeFilename(soundTitle);
          const epFolder = zip.folder(`${String(i + 1).padStart(2, '0')}_${safeTitle}`) || zip;

          epFolder.file(`${safeTitle}.srt`, generateSRT(subItems));
          epFolder.file(`${safeTitle}.lrc`, generateLRC(subItems, null));
          epFolder.file(`${safeTitle}.vtt`, generateVTT(subItems));
          epFolder.file(`${safeTitle}.txt`, generateTXT(subItems, true));
        }
      } catch (err) {
        console.warn(`Failed ep ${ep.sound_id}:`, err);
      }

      setBatchProgress({ current: i + 1, total: episodesToDownload.length });
    }

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadFile(blob, `${dramaName}_All_Subtitles.zip`, 'application/zip');
    } catch (err) {
      console.error('Failed to create drama ZIP:', err);
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleBatchDownloadAudio = async () => {
    const episodesToDownload = allEpisodes.filter((ep) =>
      selectedSoundIds.length > 0 ? selectedSoundIds.includes(ep.sound_id) : true
    );

    if (episodesToDownload.length === 0) return;

    setIsBatchAudioDownloading(true);
    setAudioProgress({ current: 0, total: episodesToDownload.length });

    for (let i = 0; i < episodesToDownload.length; i++) {
      const ep = episodesToDownload[i];
      try {
        await safeTriggerAudioDownload(String(ep.sound_id), ep.soundstr || ep.name);
      } catch (err) {
        console.warn('Batch audio error:', err);
      }
      setAudioProgress({ current: i + 1, total: episodesToDownload.length });
      if (i < episodesToDownload.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    setIsBatchAudioDownloading(false);
  };

  return (
    <div className="bg-[#060c18] border border-[#162744] rounded-2xl p-6 mt-7 shadow-2xl shadow-black/60 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#14233c]">
        <div>
          <h3 className="font-heading text-xl font-bold text-white flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-sky-400" />
            <span>{t('hangarTitle')}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {t('hangarSubtitle')}
          </p>
        </div>

        {/* Drama ID input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-md w-full sm:w-auto">
          <input
            type="text"
            placeholder={t('dramaIdPlaceholder')}
            value={dramaInput}
            onChange={(e) => setDramaInput(e.target.value)}
            className="flex-1 bg-[#091224] border border-[#1a2f52] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoadingDrama}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow"
          >
            {isLoadingDrama ? <Loader2 className="w-4 h-4 animate-spin" /> : t('loadSeries')}
          </button>
        </form>
      </div>

      {dramaData && drama && (
        <div className="space-y-6">
          {/* Drama Hero Header Card */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-4 rounded-xl bg-gradient-to-r from-[#091326] via-[#0b172d] to-[#0d1a33] border border-[#182d4f] shadow-inner">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              {drama.cover && (
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-[#233d69] shrink-0 bg-[#070e1b] shadow-md">
                  <img
                    src={getCoverThumbnailUrl(drama.cover)}
                    alt={drama.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-300 text-[10px] font-mono border border-sky-800/60 font-semibold">
                    DRAMA ID: {drama.id}
                  </span>
                  <span className="text-slate-400 text-xs">
                    {drama.type_name || drama.catalog_name || 'Radio Drama'}
                  </span>
                </div>
                <h4 className="font-heading text-lg sm:text-xl font-bold text-white truncate">
                  {drama.name}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-1 max-w-2xl">
                  {drama.abstract || drama.author}
                </p>
              </div>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={handleBatchDownloadDrama}
                disabled={isBatchDownloading}
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-sky-950/60"
              >
                {isBatchDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>
                      {t('processingBatch', { current: batchProgress.current, total: batchProgress.total })}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{t('batchSubtitles')}</span>
                  </>
                )}
              </button>

              {onOpenCoverGallery && (
                <button
                  type="button"
                  onClick={onOpenCoverGallery}
                  className="px-4 py-2.5 rounded-xl bg-[#0e1c36] hover:bg-[#14284d] border border-sky-600/70 text-sky-200 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <ImageIcon className="w-4 h-4 text-cyan-300" />
                  <span>{t('openGalleryBtn', { count: allEpisodes.length })}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleBatchDownloadAudio}
                disabled={isBatchAudioDownloading}
                className="px-4 py-2.5 rounded-xl bg-[#091224] hover:bg-[#10203e] border border-[#1e355c] text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBatchAudioDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                    <span>
                      {t('downloadingAudio')} ({audioProgress.current}/{audioProgress.total})...
                    </span>
                  </>
                ) : (
                  <>
                    <Music className="w-4 h-4 text-sky-400" />
                    <span>{t('batchAudio')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Episode Tabs & Controls */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#14233c] pb-2">
              <div className="flex items-center gap-1.5 p-1 bg-[#091224] border border-[#1a2f52] rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('main')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'main'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-sky-300'
                  }`}
                >
                  {t('tabMainEpisodes')} ({mainEpisodes.length})
                </button>

                {ftEpisodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('ft')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      activeTab === 'ft'
                        ? 'bg-sky-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-sky-300'
                    }`}
                  >
                    {t('tabExtras')} ({ftEpisodes.length})
                  </button>
                )}

                {musicEpisodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('music')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      activeTab === 'music'
                        ? 'bg-sky-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-sky-300'
                    }`}
                  >
                    {t('tabMusic')} ({musicEpisodes.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-sky-500 text-slate-950 font-bold shadow'
                      : 'text-slate-400 hover:text-sky-300'
                  }`}
                >
                  {t('tabAll')} ({allEpisodes.length})
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  {t('selectAll')}
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="hover:text-slate-200 cursor-pointer"
                >
                  {t('deselectAll')}
                </button>
              </div>
            </div>

            {/* Episode Grid List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {displayedEpisodes.map((ep, idx) => {
                const isCurrentActive = String(ep.sound_id) === String(activeSoundId);
                const isSelected = selectedSoundIds.includes(ep.sound_id);
                const durMs = Number(ep.duration);
                const durSecs = isNaN(durMs) ? 0 : durMs > 1000 ? durMs / 1000 : durMs;
                const rawCover = ep.front_cover || ep.cover_image;
                const thumbUrl = rawCover ? getCoverThumbnailUrl(rawCover) : null;

                return (
                  <div
                    key={ep.id || ep.sound_id}
                    className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      isCurrentActive
                        ? 'bg-[#0e2142] border-sky-400 text-sky-50 shadow-md shadow-sky-950/40'
                        : 'bg-[#091224] hover:bg-[#0d1a33] border-[#182b4a] hover:border-sky-600/60 text-slate-300'
                    }`}
                  >
                    {/* Checkbox for batch */}
                    <button
                      type="button"
                      onClick={() => toggleSelectOne(ep.sound_id)}
                      className="mt-0.5 text-slate-500 hover:text-sky-400 cursor-pointer shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Optional Episode Cover Thumbnail */}
                    {rawCover && thumbUrl && (
                      <div
                        onClick={() => onSelectEpisode(String(ep.sound_id))}
                        className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-[#1e3458] shrink-0 cursor-pointer group/thumb bg-[#070e1b]"
                        title={t('clickToLoadEp')}
                      >
                        <img
                          src={thumbUrl}
                          alt={ep.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover/thumb:scale-110"
                        />
                      </div>
                    )}

                    {/* Episode details & click to play */}
                    <div
                      onClick={() => onSelectEpisode(String(ep.sound_id))}
                      className="flex-1 min-w-0 cursor-pointer space-y-1"
                    >
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            isCurrentActive
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-[#0d1a33] text-sky-300 border border-sky-900/60'
                          }`}
                        >
                          {ep.name || `FLIGHT ${idx + 1}`}
                        </span>

                        <span className="font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-sky-400" />
                          {durSecs > 0 ? formatTime(durSecs, 'display') : '--:--'}
                        </span>
                      </div>

                      <p
                        className={`text-xs font-heading font-medium leading-tight truncate ${
                          isCurrentActive ? 'text-white' : 'text-slate-200'
                        }`}
                        title={ep.soundstr || ep.name}
                      >
                        {ep.soundstr || ep.name}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>ID: {ep.sound_id}</span>
                        {isCurrentActive && (
                          <span className="text-sky-400 font-bold flex items-center gap-1">
                            <Radio className="w-3 h-3 animate-pulse" />
                            <span>{t('currentlyActive')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {rawCover && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const filename = getCoverFilename(
                              drama?.name || 'Drama',
                              ep.name || `Ep_${ep.sound_id}`
                            );
                            await downloadCoverImage(rawCover, filename);
                          }}
                          className="p-2 rounded-lg text-xs bg-[#0c1628] hover:bg-sky-500 text-sky-300 hover:text-slate-950 border border-sky-800/50 hover:border-sky-400 transition-colors cursor-pointer inline-flex items-center"
                          title={t('downloadCover')}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={downloadingEpId !== null}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (downloadingEpId !== null) return;
                          setDownloadingEpId(ep.sound_id);
                          try {
                            const res = await safeTriggerAudioDownload(
                              String(ep.sound_id),
                              ep.soundstr || ep.name
                            );
                            if (!res.ok) {
                              onSelectEpisode(String(ep.sound_id));
                            }
                          } finally {
                            setDownloadingEpId(null);
                          }
                        }}
                        className="p-2 rounded-lg text-xs bg-[#0c1628] hover:bg-sky-500 text-sky-300 hover:text-slate-950 border border-sky-800/50 hover:border-sky-400 transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-60"
                        title={t('downloadAudio')}
                      >
                        {downloadingEpId === ep.sound_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
