import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Compass,
  Clock,
  User,
  Radio,
  Download,
  Music2,
  Check,
  Loader2,
  Lock,
  KeyRound,
  Image as ImageIcon,
  Maximize2,
  X,
  Plane,
  Gauge,
} from 'lucide-react';
import { MissEvanSoundInfo } from '../types/missevan';
import { formatTime } from '../utils/parser';
import {
  safeTriggerAudioDownload,
  fetchAudioInfo,
  formatFileSize,
  AudioFileInfo,
  getSavedMissEvanCookie,
  saveMissEvanCookie,
} from '../utils/audioDownloader';
import {
  getHighResCoverUrl,
  getCoverThumbnailUrl,
  getCoverFilename,
  downloadCoverImage,
} from '../utils/coverDownloader';
import { useLanguage } from '../context/LanguageContext';

interface SoundHeaderBannerProps {
  soundInfo: MissEvanSoundInfo | null;
  soundId: string;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onOpenCookieModal?: () => void;
}

export const SoundHeaderBanner: React.FC<SoundHeaderBannerProps> = ({
  soundInfo,
  soundId,
  currentTime,
  onTimeUpdate,
  audioRef,
  onOpenCookieModal,
}) => {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTurbineSpinning, setIsTurbineSpinning] = useState(true);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [audioInfo, setAudioInfo] = useState<AudioFileInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isViewingCover, setIsViewingCover] = useState(false);
  const [coverDownloaded, setCoverDownloaded] = useState(false);

  const toggleTurbineSpin = () => {
    setIsTurbineSpinning((prev) => !prev);
  };

  const loadAudioMetadata = (targetId: string) => {
    fetchAudioInfo(targetId)
      .then((info) => {
        setAudioInfo(info);
      })
      .catch(() => {});
  };

  useEffect(() => {
    setAudioInfo(null);
    setDownloadSuccess(false);
    setDownloadError(null);
    setDownloadProgress(0);
    setImgError(false);

    if (soundId) {
      loadAudioMetadata(soundId);
    }
  }, [soundId]);

  const handleDownloadAudio = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    try {
      const res = await safeTriggerAudioDownload(
        soundId,
        soundInfo?.soundstr,
        (percent) => setDownloadProgress(percent)
      );
      if (!res.ok) {
        loadAudioMetadata(soundId);
        if (res.isPaid && onOpenCookieModal) {
          onOpenCookieModal();
        } else {
          setDownloadError(res.error || t('failedToLoadSound'));
        }
      } else {
        loadAudioMetadata(soundId);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const activeCookie = getSavedMissEvanCookie();
  const audioSrc = audioInfo?.success
    ? `/api/missevan/audio/${soundId}/download?stream=true${
        activeCookie ? `&cookie=${encodeURIComponent(activeCookie)}` : ''
      }`
    : soundInfo?.soundurl_128 || soundInfo?.soundurl || soundInfo?.soundurl_64;

  const rawCoverSource = soundInfo?.front_cover || soundInfo?.cover_image;
  const coverUrl = getHighResCoverUrl(rawCoverSource);
  const thumbUrl = getCoverThumbnailUrl(rawCoverSource);

  const handleDownloadCover = async () => {
    if (!coverUrl) return;
    const filename = getCoverFilename(soundInfo?.soundstr || `sound_${soundId}`, `ep_${soundId}`);
    await downloadCoverImage(coverUrl, filename);
    setCoverDownloaded(true);
    setTimeout(() => setCoverDownloaded(false), 2500);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTime = () => onTimeUpdate(audio.currentTime);
    const handleLoaded = () => setDuration(audio.duration || (soundInfo?.duration ? soundInfo.duration / 1000 : 0));
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, onTimeUpdate, soundInfo]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      onTimeUpdate(val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const totalSecs = duration || (soundInfo?.duration ? soundInfo.duration / 1000 : 0);

  return (
    <div className="relative bg-[#050913] border border-[#162744] rounded-2xl p-6 mb-7 shadow-2xl shadow-sky-950/20 overflow-hidden cockpit-grid">
      {/* Background ambient radar glow */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Left: Aviation Flight Instrument / Compass & Turbine Dial */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center p-3 bg-[#081020] border border-[#1b3156] rounded-2xl shadow-inner group">
            {/* Compass / Heading Rose Dial Container */}
            <div
              className={`relative w-40 h-40 sm:w-44 sm:h-44 rounded-full border-2 border-[#203c68] shadow-2xl shadow-black/80 flex items-center justify-center transition-transform duration-700 turbine-fan ${
                isTurbineSpinning ? (isPlaying ? 'animate-spin-turbine-fast' : 'animate-spin-turbine') : ''
              }`}
            >
              {/* Radar sweep glow */}
              <div className="absolute inset-0 rounded-full radar-sweep opacity-60 pointer-events-none" />

              {/* Concentric Heading & Pitch Rings */}
              <div className="absolute inset-2 rounded-full border border-sky-400/15 pointer-events-none" />
              <div className="absolute inset-4 rounded-full border border-sky-300/10 pointer-events-none" />
              <div className="absolute inset-6 rounded-full border border-sky-400/20 pointer-events-none" />
              <div className="absolute inset-8 rounded-full border border-sky-300/10 pointer-events-none" />

              {/* Cardinal Navigation Tick Markers (N, E, S, W) */}
              <span className="absolute top-1 text-[9px] font-mono font-bold text-sky-400 tracking-tighter select-none">360°</span>
              <span className="absolute right-1.5 text-[9px] font-mono font-bold text-sky-400 select-none">090°</span>
              <span className="absolute bottom-1 text-[9px] font-mono font-bold text-sky-400 select-none">180°</span>
              <span className="absolute left-1.5 text-[9px] font-mono font-bold text-sky-400 select-none">270°</span>

              {/* Center Turbine Hub / Cover Art Showcase */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (coverUrl) setIsViewingCover(true);
                }}
                className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-sky-400/80 shadow-lg flex items-center justify-center bg-[#0c1629] cursor-pointer group/label"
                title={t('viewCoverLarge')}
              >
                {coverUrl && !imgError ? (
                  <img
                    src={thumbUrl || coverUrl}
                    alt={soundInfo?.soundstr || 'MissEvan Cover'}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover transition-transform group-hover/label:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-sky-950 to-slate-900 flex items-center justify-center text-sky-300">
                    <Compass className="w-7 h-7 animate-spin-turbine" />
                  </div>
                )}
                {/* Center Hover Zoom Hint */}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover/label:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-4 h-4 text-sky-300 drop-shadow" />
                </div>
                {/* Turbine Rotor Core */}
                <div className="absolute w-3 h-3 rounded-full bg-[#03060c] border border-sky-400 shadow-inner pointer-events-none" />
              </div>
            </div>

            {/* Flight Deck Attitude & Heading Crosshairs */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-full h-[1px] bg-sky-400/15" />
              <div className="absolute h-full w-[1px] bg-sky-400/15" />
              {/* Aircraft Reference Symbol */}
              <div className="absolute top-2 left-2 text-sky-400/40">
                <Plane className="w-3.5 h-3.5 -rotate-45" />
              </div>
            </div>
          </div>

          {/* Toggle Turbine Spin Button */}
          <button
            type="button"
            onClick={toggleTurbineSpin}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              isTurbineSpinning
                ? 'bg-[#0b172d] border-sky-600/60 text-sky-300 shadow-sm shadow-sky-950/40 hover:bg-[#102140]'
                : 'bg-[#080e1b] border-[#162744] text-slate-400 hover:text-slate-200 hover:bg-[#0e1930]'
            }`}
          >
            <Gauge className={`w-3.5 h-3.5 text-sky-400 ${isTurbineSpinning ? 'animate-spin-turbine' : ''}`} />
            <span>{isTurbineSpinning ? t('pauseTurbine') : t('resumeTurbine')}</span>
          </button>
        </div>

        {/* Center / Right: Flight Telemetry & Cockpit Control Panel */}
        <div className="flex-1 min-w-0 space-y-4 w-full text-left">
          {/* Metadata Row */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-mono flex items-center gap-1 text-sky-300 font-semibold">
                <Radio className="w-3 h-3 text-sky-400" />
                {t('soundId')}: {soundId}
              </span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span className="flex items-center gap-1 text-slate-300 truncate">
                <User className="w-3 h-3 text-sky-400" />
                {soundInfo?.username || 'MaoEr FM Flight Desk'}
              </span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span className="font-mono flex items-center gap-1 text-slate-300">
                <Clock className="w-3 h-3 text-sky-300" />
                {totalSecs > 0 ? formatTime(totalSecs, 'display') : '--:--'}
              </span>
            </div>

            <h2 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug line-clamp-2">
              {soundInfo?.soundstr || `Flight Telemetry ID: ${soundId}`}
            </h2>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <a
                href={`https://www.missevan.com/sound/player?id=${soundId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
              >
                <span>{t('viewOnMissEvan')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-700">|</span>
              <a
                href={`https://www.missevan.com/sound/getdm?soundid=${soundId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors font-mono"
              >
                <span>{t('xmlDanmaku')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={handleDownloadAudio}
                disabled={isDownloading}
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer disabled:opacity-60"
                title={t('downloadAudio')}
              >
                {isDownloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                <span>
                  {isDownloading
                    ? `${t('downloadingAudio')} (${downloadProgress}%)`
                    : `${t('downloadAudio')} (${audioInfo?.format?.toUpperCase() || 'M4A'}${
                        audioInfo?.bitrateKbps ? ` · ${audioInfo.bitrateKbps}kbps` : ''
                      }${
                        audioInfo?.contentLength ? ` · ${formatFileSize(audioInfo.contentLength)}` : ''
                      })`}
                </span>
              </button>

              {coverUrl && (
                <>
                  <span className="text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={handleDownloadCover}
                    className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 transition-colors font-medium cursor-pointer"
                    title={t('downloadCover')}
                  >
                    {coverDownloaded ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <ImageIcon className="w-3 h-3 text-cyan-400" />
                    )}
                    <span>{coverDownloaded ? t('coverDownloaded') : t('downloadCover')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsViewingCover(true)}
                    className="inline-flex items-center gap-0.5 text-slate-400 hover:text-sky-300 transition-colors text-[11px] cursor-pointer"
                    title={t('viewCoverLarge')}
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>{t('viewCoverLarge')}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Cockpit Audio Transport Console */}
          <div className="bg-[#091120] border border-[#182b4a] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              {/* Turbine Engine Master Play Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 flex items-center justify-center transition-all shadow-lg shadow-sky-950/60 shrink-0 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Flight Timeline Scrubber Rail */}
              <div className="flex-1 min-w-0">
                <input
                  type="range"
                  min="0"
                  max={totalSecs || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-[#142238] rounded-lg appearance-none cursor-pointer accent-sky-400 hover:accent-sky-300"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1.5 tabular-nums">
                  <span className="text-sky-400 font-semibold">{formatTime(currentTime, 'display')}</span>
                  <span>{formatTime(totalSecs, 'display')}</span>
                </div>
              </div>

              {/* Cockpit Audio Gain / Mute */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-[#142238] rounded-lg appearance-none cursor-pointer accent-sky-400 hidden sm:block"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Poster Preview */}
      {isViewingCover && coverUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsViewingCover(false)}
        >
          <div
            className="relative max-w-2xl w-full bg-[#070e1c] border border-sky-600/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-[#14233c] flex items-center justify-between bg-[#0b1528]">
              <span className="font-heading text-xs font-semibold text-slate-200 truncate pr-4">
                {soundInfo?.soundstr || soundId}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCover}
                  className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('downloadCover')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewingCover(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-black flex items-center justify-center">
              <img
                src={coverUrl}
                alt={soundInfo?.soundstr || 'Cover Preview'}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
