import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  Search,
  Loader2,
  Sparkles,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FileText,
  AlertCircle,
  ExternalLink,
  Users,
  Film,
  Check,
  Languages,
  SlidersHorizontal,
  KeyRound,
  Image as ImageIcon,
  ShieldCheck,
  Radio,
  Clock,
  RotateCcw,
  UserCheck,
  Lock,
  Copy,
  Layers,
  FolderArchive,
  Upload,
  Link as LinkIcon,
  Music,
  FileCode,
  Plane,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { KilaManboDramaDetail, KilaManboEpisode } from '../types/kilamanbo';
import {
  MissEvanDanmakuItem,
  MissEvanSoundInfo,
  FilterOptions,
  FilterMode,
  UserStats,
} from '../types/missevan';
import { SubtitleTable, SubtitleDisplayMode } from './SubtitleTable';
import { SubtitleTranslationBanner } from './SubtitleTranslationBanner';
import { ExportPanel } from './ExportPanel';
import { SubtitleTargetLanguage } from './SubtitleTranslationModal';
import {
  getSavedManboCookie,
  downloadKilaManboAudio,
  downloadKilaManboAudioWithFormat,
  ManboExportAudioFormat,
  formatFileSize,
} from '../utils/audioDownloader';
import {
  isSpamOrBarrage,
  analyzeUserContributions,
} from '../utils/parser';
import {
  downloadFile,
  generateSRT,
  generateLRC,
  generateVTT,
  generateTXT,
  generateBilingualSRT,
  generateBilingualLRC,
  sanitizeFilename,
} from '../utils/formatter';
import { GalleryCoverItem } from './CoverGalleryModal';
import { ManboBatchDownloadModal } from './ManboBatchDownloadModal';
import { MilitaryRadarDisc } from './MilitaryRadarDisc';

export interface KilaManboActiveState {
  dramaData: KilaManboDramaDetail | null;
  selectedEpisode: KilaManboEpisode | null;
  filteredSubtitles: MissEvanDanmakuItem[];
  syntheticSoundInfo: MissEvanSoundInfo | null;
  timeOffset: number;
  openCoverGallery: () => void;
  openTranslateModal: () => void;
  applyTranslations: (map: Record<string, { text: string; role?: string }>) => void;
}

interface KilaManboWorkspaceProps {
  onOpenCookieModal: () => void;
  onOpenTranslateModal?: (
    items: MissEvanDanmakuItem[],
    soundInfo: MissEvanSoundInfo | null,
    timeOffset: number,
    onApply: (map: Record<string, { text: string; role?: string }>) => void
  ) => void;
  onOpenCoverGallery?: (title: string, covers: GalleryCoverItem[]) => void;
  onRegisterWorkspace?: (state: KilaManboActiveState) => void;
}

/**
 * Structured console logging interceptor for KilaManbo API calls.
 * Deeply inspects payloads and explicitly verifies VIP episode data returns.
 */
function logManboInterceptor(
  endpoint: 'RESOLVE' | 'EPISODE' | 'SUBTITLES' | 'AUDIO_INFO' | 'AUDIO_DOWNLOAD',
  data: {
    status?: number;
    url?: string;
    dramaId?: string;
    dramaSetId?: string;
    episodeTitle?: string;
    isPaid?: boolean;
    isLocked?: boolean;
    hasAudioUrl?: boolean;
    audioUrl?: string;
    setLrcUrl?: string;
    officialCount?: number;
    danmakuCount?: number;
    vipEpisodeData?: any;
    rawResponse?: any;
    error?: any;
  }
) {
  const isVip = data.isPaid || data.isLocked || (data.vipEpisodeData && data.vipEpisodeData.payType === 1);
  const prefix = `[KilaManbo Interceptor][${endpoint}]`;
  const badge = isVip ? '🔒 VIP EPISODE' : '🟢 FREE EPISODE';

  console.groupCollapsed(
    `%c${prefix} %c${badge} %c(HTTP ${data.status ?? 200}) ${data.episodeTitle || data.dramaSetId || ''}`,
    'color: #10B981; font-weight: bold;',
    isVip
      ? 'background: #78350F; color: #FCD34D; font-weight: bold; padding: 2px 6px; border-radius: 4px;'
      : 'background: #064E3B; color: #6EE7B7; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
    'color: #94A3B8;'
  );
  console.log('🔗 Endpoint / Target URL:', data.url || endpoint);
  console.log('📦 Status & Payload Summary:', {
    status: data.status,
    isPaid: data.isPaid,
    isLocked: data.isLocked,
    hasAudioStream: Boolean(data.hasAudioUrl || (data.audioUrl && data.audioUrl.length > 0)),
    audioUrl: data.audioUrl || '(none)',
    hasOfficialLrc: Boolean(data.setLrcUrl),
    setLrcUrl: data.setLrcUrl,
    officialSubtitlesCount: data.officialCount,
    danmakuBulletCommentsCount: data.danmakuCount,
  });

  if (isVip) {
    console.log('%c🔒 VIP Episode Data Verification:', 'color: #F59E0B; font-weight: bold;', {
      dramaSetId: data.dramaSetId,
      isPaid: data.isPaid,
      isLocked: data.isLocked,
      serverReturnedData: Boolean(data.rawResponse),
      vipAudioDecrypted: Boolean(data.audioUrl),
      vipSubtitlesAvailable: Boolean((data.officialCount ?? 0) > 0 || (data.danmakuCount ?? 0) > 0 || data.setLrcUrl),
      officialCount: data.officialCount,
      danmakuCount: data.danmakuCount,
      audioStatus: data.audioUrl
        ? '✓ VIP audio is unlocked & decrypted for playback/download.'
        : '🔒 VIP audio requires user authToken in Cookie Modal. Official LRC & danmaku subtitles ARE available for free!',
    });
  }

  if (data.rawResponse) {
    console.log('📄 Raw Server JSON Response:', data.rawResponse);
  }
  if (data.error) {
    console.error('❌ Interceptor Captured Error:', data.error);
  }
  console.groupEnd();
}

export const KilaManboWorkspace: React.FC<KilaManboWorkspaceProps> = ({
  onOpenCookieModal,
  onOpenTranslateModal,
  onOpenCoverGallery,
  onRegisterWorkspace,
}) => {
  const { t, language } = useLanguage();

  const [inputUrl, setInputUrl] = useState('');
  const [isLoadingDrama, setIsLoadingDrama] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Drama & Episode state
  const [dramaData, setDramaData] = useState<KilaManboDramaDetail | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<KilaManboEpisode | null>(null);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(false);

  // Audio Player state
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPaidLocked, setIsPaidLocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Download progress state
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadProgressBytes, setDownloadProgressBytes] = useState<{ loaded: number; total: number } | null>(null);
  const [downloadSuccessToast, setDownloadSuccessToast] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Audio Format & Workaround state
  const [selectedAudioFormat, setSelectedAudioFormat] = useState<ManboExportAudioFormat>('m4a');
  const [customStreamInput, setCustomStreamInput] = useState('');
  const [isMountingStream, setIsMountingStream] = useState(false);
  const [workaroundMsg, setWorkaroundMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showWorkaroundPanel, setShowWorkaroundPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subtitles & Danmaku state
  const [officialSubItems, setOfficialSubItems] = useState<MissEvanDanmakuItem[]>([]);
  const [rawDanmakuItems, setRawDanmakuItems] = useState<MissEvanDanmakuItem[]>([]);
  const [rawLrc, setRawLrc] = useState<string>('');
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);

  // Translation state
  const [targetLang, setTargetLang] = useState<SubtitleTargetLanguage>('vi');
  const [displayMode, setDisplayMode] = useState<SubtitleDisplayMode>('bilingual');
  const [translationsMap, setTranslationsMap] = useState<Record<string, { text: string; role?: string }>>({});

  // Filter & Search Toolbar Options (1:1 parity with MissEvan)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    mode: 'official_subs',
    selectedUid: '',
    smartClean: true,
    minDuration: 1.5,
    maxDuration: 6.0,
    timeOffset: 0,
    searchQuery: '',
  });

  // Tab Mode (1:1 parity with MissEvan tab): 'single' | 'drama'
  const [activeTabMode, setActiveTabMode] = useState<'single' | 'drama'>('single');
  const [batchModalInitialScope, setBatchModalInitialScope] = useState<'single' | 'series'>('series');

  // Cover modal & Batch download modal
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverToPreview, setCoverToPreview] = useState<string>('');
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [copiedDramaId, setCopiedDramaId] = useState(false);

  // Fetch drama details and episode list
  const handleFetchDrama = async (urlToFetch?: string) => {
    const target = (urlToFetch || inputUrl).trim();
    if (!target) {
      setErrorMessage(
        language === 'vi'
          ? 'Vui lòng dán liên kết kịch KilaManbo hoặc nhập ID kịch.'
          : 'Please enter a valid KilaManbo URL or drama ID.'
      );
      return;
    }

    setIsLoadingDrama(true);
    setErrorMessage(null);

    try {
      const cookie = getSavedManboCookie();
      const headers: Record<string, string> = {};
      if (cookie) headers['x-manbo-cookie'] = cookie;

      const resolveUrl = `/api/manbo/resolve?url=${encodeURIComponent(target)}`;
      const res = await fetch(resolveUrl, { headers });
      const json = await res.json();

      logManboInterceptor('RESOLVE', {
        status: res.status,
        url: resolveUrl,
        dramaId: json.drama?.dramaId,
        rawResponse: json,
      });

      if (!res.ok || !json.success || !json.drama) {
        throw new Error(json.error || 'Không thể tải thông tin kịch KilaManbo');
      }

      const drama: KilaManboDramaDetail = json.drama;
      setDramaData(drama);

      // Smart auto-select episode:
      // If the URL or input had a single episode (decryptedParams.dramaSetId or direct match), select that episode!
      let targetEp: KilaManboEpisode | undefined = undefined;
      if (json.decryptedParams?.dramaSetId) {
        const sid = String(json.decryptedParams.dramaSetId).trim();
        targetEp = drama.setRespList?.find((e) => String(e.setIdStr || e.setId).trim() === sid);
      }
      if (!targetEp && activeTabMode === 'single') {
        const cleanedTarget = target.replace(/[^0-9]/g, '');
        if (cleanedTarget) {
          targetEp = drama.setRespList?.find((e) => String(e.setIdStr || e.setId).trim() === cleanedTarget);
        }
      }
      if (!targetEp && Array.isArray(drama.setRespList) && drama.setRespList.length > 0) {
        targetEp =
          drama.setRespList.find((e) => e.setLrcUrl && e.duration && e.duration > 180000) ||
          drama.setRespList.find((e) => e.setLrcUrl) ||
          drama.setRespList.find((e) => e.duration && e.duration > 60000) ||
          drama.setRespList[0];
      }
      if (targetEp) {
        handleSelectEpisode(targetEp, drama);
      }
    } catch (err: any) {
      logManboInterceptor('RESOLVE', {
        error: err,
      });
      setErrorMessage(err.message || 'Lỗi khi trích xuất bộ kịch KilaManbo');
    } finally {
      setIsLoadingDrama(false);
    }
  };

  // Select episode & load its decrypted audio and subtitles
  const handleSelectEpisode = async (ep: KilaManboEpisode, parentDrama?: KilaManboDramaDetail) => {
    setSelectedEpisode(ep);
    setIsLoadingEpisode(true);
    setIsLoadingSubtitles(true);
    setTranslationsMap({});
    setIsPaidLocked(false);
    setDownloadError(null);
    setDownloadSuccessToast(false);
    setIsPlaying(false);
    setCurrentTime(0);

    const dramaSetId = String(ep.setIdStr || ep.setId || '').trim();
    const resolvedLrc = ep.setLrcUrl || '';
    const activeDrama = parentDrama || dramaData;
    const currentDramaId = String(activeDrama?.radioDramaIdStr || activeDrama?.radioDramaId || '');

    try {
      const cookie = getSavedManboCookie();
      const headers: Record<string, string> = {};
      if (cookie) headers['x-manbo-cookie'] = cookie;

      const epUrl = `/api/manbo/episode?dramaSetId=${encodeURIComponent(dramaSetId)}${
        currentDramaId ? `&dramaId=${encodeURIComponent(currentDramaId)}` : ''
      }&lrcUrl=${encodeURIComponent(resolvedLrc)}`;
      const subUrl = `/api/manbo/subtitles?dramaSetId=${encodeURIComponent(dramaSetId)}${
        currentDramaId ? `&dramaId=${encodeURIComponent(currentDramaId)}` : ''
      }&lrcUrl=${encodeURIComponent(resolvedLrc)}`;

      // 1. Fetch episode detail for audio stream & VIP status concurrently with subtitles
      const [epRes, subRes] = await Promise.all([
        fetch(epUrl, { headers }),
        fetch(subUrl, { headers }),
      ]);

      const epJson = await epRes.json();
      const subJson = await subRes.json();

      logManboInterceptor('EPISODE', {
        status: epRes.status,
        url: epUrl,
        dramaSetId,
        episodeTitle: ep.setTitle || ep.setName,
        isPaid: epJson.isPaid ?? (ep.payType === 1),
        isLocked: epJson.isLocked,
        hasAudioUrl: Boolean(epJson.audioUrl),
        audioUrl: epJson.audioUrl,
        setLrcUrl: epJson.setLrcUrl || resolvedLrc,
        vipEpisodeData: ep.payType === 1 ? epJson : undefined,
        rawResponse: epJson,
      });

      logManboInterceptor('SUBTITLES', {
        status: subRes.status,
        url: subUrl,
        dramaSetId,
        episodeTitle: ep.setTitle || ep.setName,
        isPaid: epJson.isPaid ?? (ep.payType === 1),
        officialCount: subJson.officialCount || (subJson.officialSubtitles?.length || 0),
        danmakuCount: subJson.danmakuCount || (subJson.danmakuItems?.length || 0),
        setLrcUrl: resolvedLrc,
        vipEpisodeData: ep.payType === 1 ? subJson : undefined,
        rawResponse: subJson,
      });

      // Process Episode Audio
      if (epRes.ok && epJson.success) {
        const fullEp: KilaManboEpisode = epJson.episode || ep;
        setSelectedEpisode(fullEp);

        const isVipPaid = epJson.isPaid === true || ep.payType === 1;
        let stream = epJson.audioUrl || '';

        // If audio stream was not directly returned, check setAudioResp from dramaDetail or episode
        if (!stream && fullEp.setAudioResp) {
          const resp = fullEp.setAudioResp;
          const candidate =
            resp.superQualityResp?.decryptedAudioUrl ||
            resp.highQualityResp?.decryptedAudioUrl ||
            resp.normalQualityResp?.decryptedAudioUrl ||
            resp.superQualityResp?.audioUrl ||
            resp.highQualityResp?.audioUrl ||
            resp.normalQualityResp?.audioUrl ||
            '';

          if (candidate) {
            if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
              stream = candidate;
            } else {
              try {
                const decRes = await fetch('/api/manbo/decrypt-stream', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ encryptedUrl: candidate }),
                });
                const decJson = await decRes.json();
                if (decJson.success && decJson.decryptedUrl) {
                  stream = decJson.decryptedUrl;
                }
              } catch {
                // fall through
              }
            }
          }
        }

        if (stream) {
          setIsPaidLocked(false);
          setAudioUrl(stream);
        } else if (isVipPaid) {
          setIsPaidLocked(true);
          setAudioUrl('');
        } else {
          setIsPaidLocked(false);
          setAudioUrl('');
        }
      }

      // Process Subtitles & Danmaku
      if (subRes.ok && subJson.success) {
        const officialList: MissEvanDanmakuItem[] = Array.isArray(subJson.officialSubtitles)
          ? subJson.officialSubtitles
          : [];
        const danmakuList: MissEvanDanmakuItem[] = Array.isArray(subJson.danmakuItems)
          ? subJson.danmakuItems
          : [];

        setOfficialSubItems(officialList);
        setRawDanmakuItems(danmakuList);
        setRawLrc(subJson.rawLrc || '');

        // Auto-select smartest mode
        if (officialList.length > 0) {
          setFilterOptions((prev) => ({
            ...prev,
            mode: 'official_subs',
            selectedUid: '',
          }));
        } else {
          const hasMode4 = danmakuList.some((i) => i.mode === 4);
          setFilterOptions((prev) => ({
            ...prev,
            mode: hasMode4 ? 'subtitles_only' : 'all',
            selectedUid: '',
          }));
        }
      } else {
        setOfficialSubItems([]);
        setRawDanmakuItems([]);
        setRawLrc('');
      }
    } catch (err: any) {
      logManboInterceptor('EPISODE', {
        error: err,
        dramaSetId,
      });
      console.error('Failed to load episode details:', err);
    } finally {
      setIsLoadingEpisode(false);
      setIsLoadingSubtitles(false);
    }
  };

  // Convert selected episode to a synthetic MissEvanSoundInfo for component parity
  const syntheticSoundInfo: MissEvanSoundInfo | null = useMemo(() => {
    if (!dramaData || !selectedEpisode) return null;
    return {
      id: Number(selectedEpisode.setId) || 0,
      soundstr: `${dramaData.title} - ${selectedEpisode.setTitle || selectedEpisode.setName || 'Tập kịch'}`,
      intro: selectedEpisode.desc || dramaData.desc || '',
      duration: selectedEpisode.duration ? Math.floor(selectedEpisode.duration / 1000) : 0,
      username: dramaData.ownerResp?.nickname || 'KilaManbo 漫播',
      user_id: dramaData.ownerResp?.id || 0,
      cover_image: selectedEpisode.setPic || dramaData.coverPic || '',
      front_cover: dramaData.largePic || dramaData.coverPic || '',
      need_pay: selectedEpisode.payType === 1 ? 1 : 0,
      price: selectedEpisode.price || 0,
    };
  }, [dramaData, selectedEpisode]);

  // Analyze danmaku contributors (EID)
  const userStats: UserStats[] = useMemo(() => {
    if (filterOptions.mode === 'official_subs' || rawDanmakuItems.length === 0) {
      return [];
    }
    return analyzeUserContributions(rawDanmakuItems);
  }, [rawDanmakuItems, filterOptions.mode]);

  // Filtered subtitle items based on current options
  const filteredSubtitles: MissEvanDanmakuItem[] = useMemo(() => {
    let source: MissEvanDanmakuItem[] = [];

    if (filterOptions.mode === 'official_subs') {
      source = officialSubItems;
    } else if (filterOptions.mode === 'subtitles_only') {
      source = rawDanmakuItems.filter((i) => i.mode === 4);
    } else if (filterOptions.mode === 'custom_uid' && filterOptions.selectedUid) {
      source = rawDanmakuItems.filter((i) => i.userId === filterOptions.selectedUid);
    } else {
      source = rawDanmakuItems;
    }

    // Smart clean spam on danmaku items
    if (filterOptions.smartClean && filterOptions.mode !== 'official_subs') {
      source = source.filter((i) => !isSpamOrBarrage(i.text));
    }

    // Search query matching
    if (filterOptions.searchQuery.trim()) {
      const q = filterOptions.searchQuery.toLowerCase().trim();
      source = source.filter((i) => {
        const matchText = i.text.toLowerCase().includes(q);
        const matchRole = (i.role || '').toLowerCase().includes(q);
        const tr = translationsMap[i.id]?.text?.toLowerCase() || '';
        const matchTr = tr.includes(q);
        return matchText || matchRole || matchTr;
      });
    }

    // Apply translations
    return source.map((item) => {
      const tr = translationsMap[item.id];
      if (tr) {
        return {
          ...item,
          translatedText: tr.text,
          translatedRole: tr.role || item.role,
          translationLang: targetLang,
        };
      }
      return item;
    });
  }, [
    officialSubItems,
    rawDanmakuItems,
    filterOptions,
    translationsMap,
    targetLang,
  ]);

  // Quick single-line translation on demand with saved engine preference
  const handleQuickTranslateLine = async (item: MissEvanDanmakuItem) => {
    let savedEngine = 'gemini';
    try {
      savedEngine = localStorage.getItem('subtitle_translation_engine') || 'gemini';
    } catch {
      // ignore
    }

    const res = await fetch('/api/subtitles/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: item.id, text: item.text, role: item.role }],
        targetLang,
        engine: savedEngine,
        dramaContext: dramaData?.title,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const tr = json.data[0];
        setTranslationsMap((prev) => ({
          ...prev,
          [item.id]: {
            text: tr.translated,
            role: tr.translatedRole,
          },
        }));
      }
    }
  };

  // Audio Playback Controls
  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleTimeSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    audioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else if (isMuted) setIsMuted(false);
    }
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Safe chunked audio download execution
  const handleTriggerAudioDownload = async () => {
    if (!audioUrl) {
      if (filteredSubtitles.length > 0 || rawLrc) {
        handleDownloadRawLrc();
        handleDownloadSrt();
        setDownloadSuccessToast(true);
        setTimeout(() => setDownloadSuccessToast(false), 4000);
      } else {
        setShowWorkaroundPanel(true);
        setDownloadError(
          language === 'vi'
            ? 'Tập này là tập VIP. Bạn có thể dán link stream từ DevTools hoặc tải file âm thanh lên qua khung Cứu cánh bên dưới!'
            : 'VIP episode. You can paste the direct stream link or upload audio file via the Workaround panel below!'
        );
      }
      return;
    }

    setIsDownloadingAudio(true);
    setDownloadProgress(0);
    setDownloadProgressBytes(null);
    setDownloadError(null);
    setDownloadSuccessToast(false);

    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;

    logManboInterceptor('AUDIO_DOWNLOAD', {
      url: audioUrl,
      dramaSetId: selectedEpisode?.setIdStr,
      episodeTitle: selectedEpisode?.setTitle || selectedEpisode?.setName,
      isPaid: isPaidLocked || selectedEpisode?.payType === 1,
      isLocked: isPaidLocked,
      hasAudioUrl: true,
      audioUrl,
    });

    try {
      const result = await downloadKilaManboAudioWithFormat(
        audioUrl,
        title,
        selectedAudioFormat,
        (pct, loaded, total) => {
          setDownloadProgress(pct);
          setDownloadProgressBytes({ loaded, total });
        }
      );

      if (result.ok) {
        setDownloadSuccessToast(true);
        setTimeout(() => setDownloadSuccessToast(false), 5000);
      } else {
        setDownloadError(result.error || 'Lỗi khi tải file âm thanh');
      }
    } catch (err: any) {
      setDownloadError(err.message || 'Lỗi tải âm thanh');
    } finally {
      setIsDownloadingAudio(false);
    }
  };

  // Mount direct stream URL, encrypted AES string, or DevTools JSON
  const handleMountStream = async () => {
    const trimmed = customStreamInput.trim();
    if (!trimmed) {
      setWorkaroundMsg({ text: language === 'vi' ? 'Vui lòng dán link stream, chuỗi mã hóa hoặc JSON phản hồi' : 'Please paste a stream URL, ciphertext or JSON response', isError: true });
      return;
    }

    setIsMountingStream(true);
    setWorkaroundMsg(null);

    try {
      let resolvedUrl = '';

      // Case 1: Plain HTTP/HTTPS URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        resolvedUrl = trimmed;
      }
      // Case 2: JSON snippet containing audioUrl
      else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          const candidate =
            parsed.audioUrl ||
            parsed.data?.setAudioResp?.superQualityResp?.audioUrl ||
            parsed.data?.setAudioResp?.highQualityResp?.audioUrl ||
            parsed.data?.setAudioResp?.normalQualityResp?.audioUrl ||
            parsed.setAudioResp?.superQualityResp?.audioUrl ||
            parsed.setAudioResp?.highQualityResp?.audioUrl ||
            parsed.setAudioResp?.normalQualityResp?.audioUrl;

          if (candidate) {
            if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
              resolvedUrl = candidate;
            } else {
              const decRes = await fetch('/api/manbo/decrypt-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encryptedUrl: candidate }),
              });
              const decJson = await decRes.json();
              if (decJson.success && decJson.decryptedUrl) {
                resolvedUrl = decJson.decryptedUrl;
              }
            }
          }
        } catch {
          // fall through
        }
      }

      // Case 3: AES-128 ciphertext
      if (!resolvedUrl) {
        const decRes = await fetch('/api/manbo/decrypt-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedUrl: trimmed }),
        });
        const decJson = await decRes.json();
        if (decJson.success && decJson.decryptedUrl) {
          resolvedUrl = decJson.decryptedUrl;
        }
      }

      if (resolvedUrl) {
        setAudioUrl(resolvedUrl);
        setIsPaidLocked(false);
        setCustomStreamInput('');
        setWorkaroundMsg({
          text: language === 'vi' ? '✓ Đã gắn luồng âm thanh thành công! Trình phát & nút tải đã sẵn sàng.' : '✓ Audio stream mounted successfully! Player & downloads are ready.',
        });
        setTimeout(() => setWorkaroundMsg(null), 5000);
      } else {
        throw new Error(language === 'vi' ? 'Không thể nhận diện hoặc giải mã chuỗi âm thanh này.' : 'Could not recognize or decrypt this audio string.');
      }
    } catch (err: any) {
      setWorkaroundMsg({ text: err.message || 'Lỗi gắn luồng', isError: true });
    } finally {
      setIsMountingStream(false);
    }
  };

  // Local audio file upload handler
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const localUrl = URL.createObjectURL(file);
      setAudioUrl(localUrl);
      setIsPaidLocked(false);
      setWorkaroundMsg({
        text: language === 'vi' ? `✓ Đã gắn file "${file.name}" vào trình phát và đồng bộ phụ đề!` : `✓ Mounted file "${file.name}" to player & synced with subtitles!`,
      });
      setTimeout(() => setWorkaroundMsg(null), 5000);
    } catch (err: any) {
      setWorkaroundMsg({ text: err.message || 'Lỗi tải file', isError: true });
    }
  };

  // Download raw official LRC directly
  const handleDownloadRawLrc = () => {
    if (!rawLrc) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    const blob = new Blob([rawLrc], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${title}_Official.lrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  };

  // Quick download current subtitles as SRT
  const handleDownloadSrt = () => {
    if (filteredSubtitles.length === 0) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    downloadFile(generateSRT(filteredSubtitles, filterOptions.timeOffset), `${title}.srt`);
  };

  // Quick download current subtitles as VTT
  const handleDownloadVtt = () => {
    if (filteredSubtitles.length === 0) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    downloadFile(generateVTT(filteredSubtitles, filterOptions.timeOffset), `${title}.vtt`);
  };

  // Download plain dialogue text transcript
  const handleDownloadTxt = (withTimestamps = true) => {
    if (filteredSubtitles.length === 0) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    downloadFile(generateTXT(filteredSubtitles, withTimestamps, filterOptions.timeOffset), `${title}_transcript.txt`);
  };

  // Download structured JSON
  const handleDownloadJson = () => {
    if (filteredSubtitles.length === 0) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    downloadFile(JSON.stringify(filteredSubtitles, null, 2), `${title}_subtitles.json`, 'application/json');
  };

  // Download Bilingual SRT
  const handleDownloadBilingualSrt = () => {
    if (filteredSubtitles.length === 0) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    downloadFile(generateBilingualSRT(filteredSubtitles, filterOptions.timeOffset), `${title}_bilingual.srt`);
  };

  // Download Bilingual LRC
  const handleDownloadBilingualLrc = () => {
    if (filteredSubtitles.length === 0) return;
    const title = `KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`;
    downloadFile(generateBilingualLRC(filteredSubtitles, syntheticSoundInfo, filterOptions.timeOffset), `${title}_bilingual.lrc`);
  };

  // Build covers array for gallery
  const handleOpenCoverGallery = () => {
    if (!dramaData) return;
    const allCovers: GalleryCoverItem[] = [];
    if (dramaData.largePic || dramaData.coverPic) {
      allCovers.push({
        id: 'poster',
        name: language === 'vi' ? 'Poster Phim Gốc (HD)' : 'Main Drama Poster (HD)',
        soundstr: `${dramaData.title} - Main Poster`,
        front_cover: dramaData.largePic || dramaData.coverPic,
      });
    }
    if (Array.isArray(dramaData.setRespList)) {
      dramaData.setRespList.forEach((ep, idx) => {
        allCovers.push({
          id: ep.setIdStr || idx + 1,
          name: ep.setTitle || ep.setName || `Tập ${ep.setNo || idx + 1}`,
          soundstr: `${dramaData.title} - ${ep.setTitle || ep.setName || `Tập ${idx + 1}`}`,
          front_cover: ep.setPic || dramaData.coverPic,
          subText: ep.duration ? `${Math.floor(ep.duration / 60000)}m` : undefined,
        });
      });
    }
    if (onOpenCoverGallery) {
      onOpenCoverGallery(dramaData.title, allCovers);
    } else {
      setCoverToPreview(dramaData.largePic || dramaData.coverPic);
      setShowCoverModal(true);
    }
  };

  // Register workspace state with parent for header synchronization
  useEffect(() => {
    if (onRegisterWorkspace) {
      onRegisterWorkspace({
        dramaData,
        selectedEpisode,
        filteredSubtitles,
        syntheticSoundInfo,
        timeOffset: filterOptions.timeOffset,
        openCoverGallery: handleOpenCoverGallery,
        openTranslateModal: () => {
          if (onOpenTranslateModal) {
            onOpenTranslateModal(
              filteredSubtitles,
              syntheticSoundInfo,
              filterOptions.timeOffset,
              (newMap) => setTranslationsMap(newMap)
            );
          }
        },
        applyTranslations: (newMap) => setTranslationsMap(newMap),
      });
    }
  }, [
    dramaData,
    selectedEpisode,
    filteredSubtitles,
    syntheticSoundInfo,
    filterOptions.timeOffset,
    translationsMap,
  ]);

  return (
    <div className="space-y-6 animate-in fade-in pb-12 text-slate-200 military-grid p-1 sm:p-3 rounded-3xl bg-[#020b05]/60 border border-emerald-500/20 shadow-2xl">
      {/* Hidden native audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={`/api/manbo/audio-proxy?url=${encodeURIComponent(audioUrl)}`}
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Hero / Input Console - Dark Green Military Obsidian Palette */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#05180e] via-[#030e07] to-[#010804] border-2 border-emerald-500/35 p-6 sm:p-8 shadow-2xl military-grid">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>KILAMANBO 漫播 EXTRACTION SUITE</span>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            {t('manboExtractorTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            {t('manboSubtitle')}
          </p>

          {/* Mode Switcher Tabs (Single Track vs Series Drama - 1:1 Parity with MissEvan) */}
          <div className="flex items-center justify-center pt-1">
            <div className="inline-flex items-center gap-1.5 p-1 bg-[#040e09] border border-[#143a25] rounded-xl text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTabMode('single')}
                className={`px-4 py-1.5 rounded-lg font-heading font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTabMode === 'single'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-950/60 font-bold'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{t('singleTrackTab')}</span>
                {selectedEpisode && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono border ${
                      activeTabMode === 'single'
                        ? 'bg-emerald-950 text-emerald-200 border-emerald-800/80'
                        : 'bg-[#06180e] text-emerald-400 border-emerald-600/40'
                    }`}
                  >
                    {selectedEpisode.setTitle || selectedEpisode.setName || 'Ep'}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTabMode('drama')}
                className={`px-4 py-1.5 rounded-lg font-heading font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTabMode === 'drama'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-950/60 font-bold'
                    : 'text-slate-400 hover:text-emerald-300'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>{t('seriesDramaTab')}</span>
                {dramaData && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono border ${
                      activeTabMode === 'drama'
                        ? 'bg-emerald-950 text-emerald-200 border-emerald-800/80'
                        : 'bg-[#06180e] text-emerald-400 border-emerald-600/40'
                    }`}
                  >
                    {dramaData.setRespList?.length ?? 0}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search / Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFetchDrama();
            }}
            className="pt-1 max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch gap-2.5"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={
                  activeTabMode === 'single'
                    ? (language === 'vi'
                        ? 'Dán link tập KilaManbo (...detail?id=...&dramaSetId=...) hoặc DramaSet ID...'
                        : 'Paste KilaManbo single track URL (...detail?id=...&dramaSetId=...) or Episode ID...')
                    : t('manboInputPlaceholder')
                }
                className="w-full h-12 pl-4 pr-10 rounded-xl bg-[#040c08] border border-[#143523] focus:border-emerald-400 text-white placeholder-slate-500 text-xs sm:text-sm font-mono focus:outline-none shadow-inner transition-colors"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={isLoadingDrama}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-950/60 disabled:opacity-50 shrink-0"
            >
              {isLoadingDrama ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{t('manboLoading')}</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 text-slate-950" />
                  <span>
                    {activeTabMode === 'single'
                      ? (language === 'vi' ? 'Trích Xuất Tập Lẻ' : 'Extract Single Track')
                      : t('manboLoadPayload')}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Presets */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 pt-0.5">
            <span className="text-slate-500 text-[11px] font-mono">
              {activeTabMode === 'single'
                ? (language === 'vi' ? 'Tập lẻ mẫu:' : 'Sample single track:')
                : t('manboDemoLabel')}
            </span>
            {activeTabMode === 'single' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('https://www.kilamanbo.world/manbo/pc/detail?id=2235647356781461610&dramaSetId=2235647356781461611');
                    handleFetchDrama('https://www.kilamanbo.world/manbo/pc/detail?id=2235647356781461610&dramaSetId=2235647356781461611');
                  }}
                  className="px-2.5 py-0.5 rounded-lg bg-[#05170d] hover:bg-[#092617] border border-emerald-600/60 text-emerald-300 font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>尾钩 Ep 1 (2235647356781461611)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('https://www.kilamanbo.world/manbo/pc/detail?id=2235647356781461610&dramaSetId=2235647356781461612');
                    handleFetchDrama('https://www.kilamanbo.world/manbo/pc/detail?id=2235647356781461610&dramaSetId=2235647356781461612');
                  }}
                  className="px-2.5 py-0.5 rounded-lg bg-[#05170d] hover:bg-[#092617] border border-emerald-800 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>尾钩 Ep 2 (2235647356781461612)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('2235647356781461610');
                    handleFetchDrama('2235647356781461610');
                  }}
                  className="px-2.5 py-0.5 rounded-lg bg-[#05170d] hover:bg-[#092617] border border-emerald-600/60 text-emerald-300 font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>尾钩 Trọn Bộ (2235647356781461610)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('1746208889815048192');
                    handleFetchDrama('1746208889815048192');
                  }}
                  className="px-2.5 py-0.5 rounded-lg bg-[#05170d] hover:bg-[#092617] border border-emerald-800 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>1746208889815048192</span>
                </button>
              </>
            )}
          </div>

          {/* Action Ribbon & Payload Launchers with Scope Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-400">
            <span className="text-emerald-400/90 font-mono text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#05170d] border border-emerald-500/30">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>
                {language === 'vi'
                  ? 'Hỗ trợ: Link kịch, link tập lẻ hoặc nhập thẳng Drama ID'
                  : 'Supported: Drama link, episode link, or Drama ID'}
              </span>
            </span>

            {/* Launch Batch Modal for Single Track */}
            <button
              type="button"
              onClick={() => {
                setBatchModalInitialScope('single');
                setIsBatchOpen(true);
              }}
              disabled={!dramaData || !selectedEpisode}
              className="px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40"
              title="Đóng gói trọn bộ âm thanh chất lượng cao + phụ đề + ảnh bìa của tập hiện tại thành file ZIP"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'vi' ? 'Tải Gói 1 Tập (.ZIP)' : 'Single Track (.ZIP)'}</span>
            </button>

            {/* Launch Batch Modal for Entire Drama Series */}
            <button
              type="button"
              onClick={() => {
                setBatchModalInitialScope('series');
                setIsBatchOpen(true);
              }}
              disabled={!dramaData}
              className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40 shadow-sm"
              title="Đóng gói toàn bộ các tập của bộ kịch thành file ZIP hàng loạt"
            >
              <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'vi' ? 'Toàn Bộ Kịch (.ZIP)' : 'Whole Series (.ZIP)'}</span>
            </button>

            {onOpenCookieModal && (
              <button
                type="button"
                onClick={onOpenCookieModal}
                className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                title={language === 'vi' ? 'Nhập authToken tài khoản đã mua' : 'Enter authToken of purchased account'}
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'vi' ? '🔑 Xác Thực VIP (authToken)' : '🔑 VIP Token / Credentials'}</span>
              </button>
            )}
          </div>

          <div className="pt-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {language === 'vi'
                  ? 'Trích xuất & tải tập VIP KilaManbo trực tiếp qua Drama ID (Không yêu cầu Cookie token)'
                  : 'Extract & download KilaManbo VIP episodes directly via Drama ID (No Cookie token required)'}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center justify-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </section>

      {/* Standby Flight Deck when no drama is loaded yet */}
      {!dramaData && !isLoadingDrama && (
        <section className="bg-gradient-to-b from-[#03150a]/90 to-[#010904]/90 border border-emerald-500/25 rounded-3xl p-8 sm:p-12 shadow-2xl military-grid flex flex-col items-center justify-center text-center space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold tracking-widest">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>AVIONIC RADAR STANDBY // AWAITING KILAMANBO DRAMA</span>
          </div>

          <div className="w-20 h-20 rounded-full bg-[#031208] border-2 border-emerald-500/40 p-2 flex items-center justify-center shadow-lg shadow-emerald-950/60 animate-spin-turbine">
            <Compass className="w-10 h-10 text-emerald-400" />
          </div>

          <div className="max-w-md space-y-2">
            <h3 className="font-heading text-lg sm:text-xl font-extrabold text-white">
              {language === 'vi' ? 'Sẵn Sàng Tiếp Nhận Dữ Liệu Kịch KilaManbo' : 'Flight Deck Ready for Drama Input'}
            </h3>
            <p className="text-xs sm:text-[13px] text-slate-400 font-mono leading-relaxed">
              {language === 'vi'
                ? 'Thanh tìm kiếm đã được để trống. Dán liên kết kịch KilaManbo (kilamanbo.world/...) hoặc nhập Drama ID vào thanh tìm kiếm phía trên để bắt đầu trích xuất.'
                : 'Search box is clear. Paste any KilaManbo drama link (kilamanbo.world/...) or enter a Drama ID above to begin extracting.'}
            </p>
          </div>
        </section>
      )}

      {/* Drama Metadata & Audio Cockpit */}
      {dramaData && (
        <section className="bg-[#030f08] border border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 military-grid">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Poster Cover & Tactical Radar Disc */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4 shrink-0 mx-auto lg:mx-0">
              <div className="relative group shrink-0 w-36 sm:w-44 aspect-[3/4] rounded-2xl overflow-hidden bg-[#07160e] border border-emerald-500/40 shadow-xl">
                <img
                  src={dramaData.coverPic || dramaData.largePic}
                  alt={dramaData.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  type="button"
                  onClick={handleOpenCoverGallery}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white text-xs font-semibold cursor-pointer p-2 text-center"
                >
                  <ImageIcon className="w-6 h-6 text-emerald-400" />
                  <span>{language === 'vi' ? 'Mở Kho Bìa Kịch HD' : 'Open Cover Gallery'}</span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    ({dramaData.setRespList?.length || 0} covers)
                  </span>
                </button>
              </div>

              {/* Tactical Spinning Military Radar Disc */}
              <MilitaryRadarDisc
                coverUrl={selectedEpisode?.setPic || dramaData.coverPic || dramaData.largePic}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                title={selectedEpisode?.setTitle || selectedEpisode?.setName || dramaData.title}
              />
            </div>

            {/* Drama Details */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {dramaData.title}
                </h2>

                {/* Prominent Drama ID badge with 1-click copy & KilaManbo link */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold shadow-sm">
                  <span className="text-slate-400 font-normal">Drama ID:</span>
                  <span>{dramaData.radioDramaIdStr || dramaData.radioDramaId || '2235647356781461610'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const idVal = String(dramaData.radioDramaIdStr || dramaData.radioDramaId || '2235647356781461610');
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(idVal);
                        setCopiedDramaId(true);
                        setTimeout(() => setCopiedDramaId(false), 2000);
                      }
                    }}
                    className="ml-0.5 text-slate-400 hover:text-white cursor-pointer"
                    title="Sao chép Drama ID"
                  >
                    {copiedDramaId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={`https://www.kilamanbo.world/manbo/pc/detail?id=${dramaData.radioDramaIdStr || dramaData.radioDramaId || '2235647356781461610'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-emerald-400 cursor-pointer ml-0.5"
                    title="Mở kịch trên KilaManbo"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                    dramaData.endStatus === 1
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                      : 'bg-teal-950/80 text-teal-300 border border-teal-700/60'
                  }`}
                >
                  {dramaData.endStatus === 1 ? t('manboFinished') : t('manboUpdating')}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {t('manboEpisodeCount').replace('{count}', String(dramaData.setRespList?.length || 0))}
                </span>
                <button
                  type="button"
                  onClick={handleOpenCoverGallery}
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'vi' ? 'Kho Bìa HD' : 'HD Covers'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBatchModalInitialScope('single');
                    setIsBatchOpen(true);
                  }}
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Tải gói 1 tập hiện tại (âm thanh + phụ đề + ảnh bìa)"
                >
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'vi' ? 'Tập Này (.ZIP)' : 'This Ep (.ZIP)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBatchModalInitialScope('series');
                    setIsBatchOpen(true);
                  }}
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  title="Xuất hàng loạt toàn bộ phụ đề, ảnh bìa và âm thanh của bộ kịch"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'vi' ? 'Toàn Bộ Kịch (.ZIP)' : 'Whole Series (.ZIP)'}</span>
                </button>
              </div>

              {/* CV Cast Badges */}
              {Array.isArray(dramaData.cvRespList) && dramaData.cvRespList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('manboCvCast')}:</span>
                  </span>
                  {dramaData.cvRespList.slice(0, 8).map((cv, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-[#071910] border border-[#163f2b] text-[11px] text-slate-300 font-medium"
                    >
                      {cv.roleName ? `${cv.roleName}: ` : ''}
                      <span className="text-emerald-300 font-semibold">{cv.cvName}</span>
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 pt-1">
                {dramaData.desc}
              </p>

              {/* VIP Episode Status Banner verified via Drama ID */}
              {isPaidLocked && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/50 text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-300 flex items-center gap-2">
                        <span>{t('manboVipNotice')}</span>
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-900/60 border border-emerald-500/40 text-emerald-200">
                          ID: {dramaData.radioDramaIdStr || dramaData.radioDramaId || '2235647356781461610'}
                        </span>
                      </p>
                      <p className="text-slate-300 text-[11px] mt-0.5">
                        {t('manboVipDesc')}
                      </p>
                      <p className="text-emerald-400 text-[11px] font-semibold mt-1">
                        ✓ Phụ đề chính thức (.LRC), timeline đạn mạc và ảnh bìa HD của tập VIP này đều đã sẵn sàng tải về!
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onOpenCookieModal && (
                      <button
                        type="button"
                        onClick={onOpenCookieModal}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
                        title="Nhập authToken tài khoản đã mua để tải âm thanh"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-950" />
                        <span>{language === 'vi' ? '🔑 Nhập Token VIP' : '🔑 Enter VIP Token'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setBatchModalInitialScope('series');
                        setIsBatchOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('manboVipBtn')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Audio Cockpit Player */}
              <div className="mt-4 p-4 rounded-xl bg-[#06140c] border border-[#143a25] space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      disabled={!audioUrl || isLoadingEpisode || isPaidLocked}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                        isPaidLocked
                          ? 'bg-amber-950/80 border border-amber-700/60 text-amber-400 cursor-not-allowed opacity-60'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 cursor-pointer shadow-md shadow-emerald-950/50 disabled:opacity-40 font-bold'
                      }`}
                    >
                      {isLoadingEpisode ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      ) : isPaidLocked ? (
                        <Lock className="w-4 h-4" />
                      ) : isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{selectedEpisode?.setTitle || selectedEpisode?.setName || 'Tập kịch'}</span>
                        {selectedEpisode?.payType === 1 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                            VIP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-400/80">
                        {formatSeconds(currentTime)} /{' '}
                        {formatSeconds(
                          duration || (selectedEpisode?.duration ? selectedEpisode.duration / 1000 : 0)
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Volume */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <button type="button" onClick={toggleMute} className="cursor-pointer hover:text-white">
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    {/* Multi-Format Audio Download Hub */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-[#040e08] p-0.5 rounded-lg border border-[#143a25]">
                        {(['m4a', 'mp3', 'wav'] as ManboExportAudioFormat[]).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setSelectedAudioFormat(fmt)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                              selectedAudioFormat === fmt
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title={`Đổi định dạng xuất âm thanh: ${fmt.toUpperCase()}`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>

                      {audioUrl ? (
                        <button
                          type="button"
                          onClick={() => handleTriggerAudioDownload()}
                          disabled={isDownloadingAudio}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isDownloadingAudio ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                              <span>
                                {downloadProgress > 0 ? `${downloadProgress}%` : 'Đang tải...'}
                              </span>
                            </>
                          ) : downloadSuccessToast ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Đã tải {selectedAudioFormat.toUpperCase()}!</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>Tải {selectedAudioFormat.toUpperCase()}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowWorkaroundPanel((prev) => !prev)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                          title="Mở bảng cứu cánh để dán link stream hoặc tải file âm thanh lên"
                        >
                          <Music className="w-3.5 h-3.5 text-amber-400" />
                          <span>{language === 'vi' ? 'Cứu Cánh Âm Thanh' : 'Audio Workaround'}</span>
                        </button>
                      )}
                    </div>

                    {/* Quick Subtitle Export Buttons */}
                    <div className="flex items-center gap-1 border-l border-[#143a25] pl-2">
                      {rawLrc && (
                        <button
                          type="button"
                          onClick={handleDownloadRawLrc}
                          className="px-2 py-1 rounded-lg bg-[#071910] hover:bg-[#0e2c1d] border border-[#174229] text-teal-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Tải trực tiếp file LRC gốc của kịch KilaManbo"
                        >
                          <FileText className="w-3 h-3 text-teal-400" />
                          <span>LRC Gốc</span>
                        </button>
                      )}
                      {filteredSubtitles.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleDownloadSrt}
                            className="px-2 py-1 rounded-lg bg-[#071910] hover:bg-[#0e2c1d] border border-[#174229] text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Tải phụ đề SRT hiện tại"
                          >
                            <FileText className="w-3 h-3 text-emerald-400" />
                            <span>SRT</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadVtt}
                            className="px-2 py-1 rounded-lg bg-[#071910] hover:bg-[#0e2c1d] border border-[#174229] text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Tải phụ đề WebVTT hiện tại"
                          >
                            <FileText className="w-3 h-3 text-emerald-400" />
                            <span>VTT</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadTxt(true)}
                            className="px-2 py-1 rounded-lg bg-[#071910] hover:bg-[#0e2c1d] border border-[#174229] text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Tải kịch bản thoại dạng TXT"
                          >
                            <FileText className="w-3 h-3 text-slate-400" />
                            <span>TXT</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadJson}
                            className="px-2 py-1 rounded-lg bg-[#071910] hover:bg-[#0e2c1d] border border-[#174229] text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Tải dữ liệu phụ đề JSON timeline"
                          >
                            <FileCode className="w-3 h-3 text-slate-400" />
                            <span>JSON</span>
                          </button>
                          {Object.keys(translationsMap).length > 0 && (
                            <button
                              type="button"
                              onClick={handleDownloadBilingualSrt}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title="Tải phụ đề Song Ngữ (Bilingual SRT)"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>Song Ngữ</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audio Workaround Panel (Direct URL / AES Ciphertext / JSON / Local File upload) */}
                {(showWorkaroundPanel || (isPaidLocked && !audioUrl)) && (
                  <div className="p-3.5 rounded-xl bg-[#04120a] border border-emerald-500/40 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>{language === 'vi' ? 'Cứu Cánh Luồng Âm Thanh Tập VIP' : 'VIP Episode Audio Stream Workaround'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {language === 'vi' ? 'Dán link từ DevTools hoặc tải file từ máy' : 'Paste from DevTools or upload local file'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={customStreamInput}
                        onChange={(e) => setCustomStreamInput(e.target.value)}
                        placeholder={
                          language === 'vi'
                            ? 'Dán link stream .mp4/.m4a, chuỗi AES, hoặc JSON phản hồi Network...'
                            : 'Paste direct .mp4/.m4a stream URL, AES ciphertext, or Network JSON...'
                        }
                        className="flex-1 bg-[#020805] border border-[#143a25] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400"
                      />
                      <button
                        type="button"
                        onClick={handleMountStream}
                        disabled={isMountingStream || !customStreamInput.trim()}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {isMountingStream ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                        <span>{language === 'vi' ? 'Gắn Luồng' : 'Mount Stream'}</span>
                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAudioFileUpload}
                        accept="audio/*,.m4a,.mp3,.mp4,.wav,.aac"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[#071910] hover:bg-[#0e2c1d] border border-emerald-600/50 text-emerald-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        title="Tải lên file âm thanh (.m4a, .mp3, .wav) của tập kịch này"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{language === 'vi' ? 'Tải File Lên' : 'Upload File'}</span>
                      </button>

                      {onOpenCookieModal && (
                        <button
                          type="button"
                          onClick={onOpenCookieModal}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                          title="Nhập authToken tài khoản đã mua"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>{language === 'vi' ? 'Nhập Token VIP' : 'Enter VIP Token'}</span>
                        </button>
                      )}
                    </div>

                    {workaroundMsg && (
                      <div className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
                        workaroundMsg.isError
                          ? 'bg-rose-950/60 border border-rose-800 text-rose-300'
                          : 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-300'
                      }`}>
                        <span>{workaroundMsg.text}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress scrub bar */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleTimeSeek}
                  className="w-full h-1.5 bg-[#030906] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                {downloadError && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{downloadError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Episode Selector Carousel */}
          <div className="border-t border-[#113121] pt-4 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Film className="w-4 h-4 text-emerald-400" />
                <span>{t('manboEpisodesList')}</span>
              </span>
              <span className="text-[11px] text-emerald-400/80 font-mono">
                {dramaData.setRespList?.length || 0} tracks
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-emerald-950">
              {dramaData.setRespList?.map((ep) => {
                const isSelected = selectedEpisode?.setIdStr === ep.setIdStr;
                return (
                  <button
                    key={ep.setIdStr}
                    type="button"
                    onClick={() => handleSelectEpisode(ep, dramaData)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer flex flex-col items-start gap-1 border text-left min-w-[125px] ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-950 to-teal-950 border-emerald-500/80 text-white shadow-md shadow-emerald-950/60 ring-1 ring-emerald-500/50'
                        : 'bg-[#06120b] hover:bg-[#0a1f13] border-[#133623] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="font-bold truncate max-w-[90px]">
                        {ep.setTitle || ep.setName || `Tập ${ep.setNo}`}
                      </span>
                      {ep.payType === 1 && (
                        <span className="text-[9px] font-bold text-amber-400 font-mono">VIP</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-mono">
                      <span>{formatSeconds((ep.duration || 0) / 1000)}</span>
                      {ep.setLrcUrl && <span className="text-emerald-400 font-bold">LRC</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Filter Toolbar - 1:1 Parity with MissEvan, in Dark Green Palette */}
      {selectedEpisode && (
        <div className="bg-[#040c08] border border-[#113121] rounded-2xl p-4.5 space-y-4 shadow-xl text-left">
          {/* Top row: Mode selector & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Segmented control for Filter Mode */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#06140d] border border-[#153a27] rounded-xl">
              {/* Option 1: Official Subtitles (parsed from LRC) */}
              {officialSubItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterOptions((prev) => ({ ...prev, mode: 'official_subs', selectedUid: '' }))}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    filterOptions.mode === 'official_subs'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md font-bold'
                      : 'text-emerald-300 hover:text-white hover:bg-[#0c2419]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                  <span>
                    {language === 'vi' ? 'Phụ Đề Chính Thức (LRC)' : 'Official Script (LRC)'} ({officialSubItems.length})
                  </span>
                </button>
              )}

              {/* Option 2: Bottom Dialogue Subtitles (Mode 4) */}
              <button
                type="button"
                onClick={() => setFilterOptions((prev) => ({ ...prev, mode: 'subtitles_only', selectedUid: '' }))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  filterOptions.mode === 'subtitles_only'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950/60'
                    : 'text-slate-300 hover:text-emerald-300'
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {language === 'vi' ? 'Lời Thoại / Phụ Đề Dưới' : 'Bottom Subtitles / Dialogue'} (
                  {rawDanmakuItems.filter((i) => i.mode === 4).length})
                </span>
              </button>

              {/* Option 3: All Danmaku & Bullet comments */}
              <button
                type="button"
                onClick={() => setFilterOptions((prev) => ({ ...prev, mode: 'all', selectedUid: '' }))}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  filterOptions.mode === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950/60'
                    : 'text-slate-300 hover:text-emerald-300'
                }`}
              >
                {t('modeAll')} ({rawDanmakuItems.length})
              </button>

              {filterOptions.selectedUid && (
                <button
                  type="button"
                  onClick={() => setFilterOptions((prev) => ({ ...prev, mode: 'custom_uid' }))}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterOptions.mode === 'custom_uid'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  UID: {filterOptions.selectedUid}
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={t('searchDialogue')}
                value={filterOptions.searchQuery}
                onChange={(e) => setFilterOptions((prev) => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full bg-[#06140d] border border-[#153a27] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Middle row: Fine-tuning controls (Smart Clean & Time Offset) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2.5 border-t border-[#113121] text-xs">
            {/* Smart Clean toggle */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setFilterOptions((prev) => ({ ...prev, smartClean: !prev.smartClean }))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  filterOptions.smartClean
                    ? 'bg-[#082215] border-emerald-600/70 text-emerald-200 shadow-sm shadow-emerald-950/40'
                    : 'bg-[#06140d] border-[#153a27] text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('smartClean')}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#0e311f] text-emerald-300 ml-1">
                  {filterOptions.smartClean ? 'ON' : 'OFF'}
                </span>
              </button>

              <span className="text-slate-400">
                {t('showingCount', {
                  filtered: filteredSubtitles.length,
                  total:
                    filterOptions.mode === 'official_subs'
                      ? officialSubItems.length
                      : rawDanmakuItems.length,
                })}
              </span>
            </div>

            {/* Time Offset adjuster */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('timeOffset')}:</span>
              </span>
              <div className="inline-flex items-center bg-[#06140d] border border-[#153a27] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setFilterOptions((prev) => ({
                      ...prev,
                      timeOffset: Number((prev.timeOffset - 1).toFixed(2)),
                    }))
                  }
                  className="px-2 py-1 text-slate-400 hover:text-emerald-300 hover:bg-[#0c2619] cursor-pointer transition-colors font-mono"
                  title="-1s"
                >
                  -1s
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterOptions((prev) => ({
                      ...prev,
                      timeOffset: Number((prev.timeOffset - 0.5).toFixed(2)),
                    }))
                  }
                  className="px-2 py-1 text-slate-400 hover:text-emerald-300 hover:bg-[#0c2619] cursor-pointer transition-colors font-mono"
                  title="-0.5s"
                >
                  -0.5s
                </button>
                <span className="px-2.5 py-1 font-mono tabular-nums font-semibold text-emerald-400 min-w-14 text-center">
                  {filterOptions.timeOffset > 0
                    ? `+${filterOptions.timeOffset}s`
                    : `${filterOptions.timeOffset}s`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFilterOptions((prev) => ({
                      ...prev,
                      timeOffset: Number((prev.timeOffset + 0.5).toFixed(2)),
                    }))
                  }
                  className="px-2 py-1 text-slate-400 hover:text-emerald-300 hover:bg-[#0c2619] cursor-pointer transition-colors font-mono"
                  title="+0.5s"
                >
                  +0.5s
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFilterOptions((prev) => ({
                      ...prev,
                      timeOffset: Number((prev.timeOffset + 1).toFixed(2)),
                    }))
                  }
                  className="px-2 py-1 text-slate-400 hover:text-emerald-300 hover:bg-[#0c2619] cursor-pointer transition-colors font-mono"
                  title="+1s"
                >
                  +1s
                </button>
                {filterOptions.timeOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterOptions((prev) => ({ ...prev, timeOffset: 0 }))}
                    className="px-2 py-1 text-slate-400 hover:text-emerald-400 border-l border-[#153a27] cursor-pointer"
                    title="Reset to 0s"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row: Top Contributor UIDs (Subbers) */}
          {filterOptions.mode !== 'official_subs' && userStats.length > 0 && (
            <div className="pt-2 border-t border-[#113121] flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span>{t('topSubbers')}</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {userStats.slice(0, 5).map((u) => {
                  const isSelected =
                    filterOptions.mode === 'custom_uid' && filterOptions.selectedUid === u.userId;
                  return (
                    <button
                      type="button"
                      key={u.userId}
                      onClick={() =>
                        setFilterOptions((prev) => ({
                          ...prev,
                          mode: isSelected ? 'all' : 'custom_uid',
                          selectedUid: isSelected ? '' : u.userId,
                        }))
                      }
                      className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-900/60 border-emerald-400 text-emerald-200 font-semibold shadow-sm'
                          : 'bg-[#06140d] border-[#153a27] text-slate-400 hover:text-white hover:border-emerald-700/60'
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
      )}

      {/* Subtitle Translation Tool - Highly Visible Command Center */}
      {selectedEpisode && (
        <SubtitleTranslationBanner
          items={filteredSubtitles}
          soundInfo={syntheticSoundInfo}
          timeOffset={filterOptions.timeOffset}
          targetLang={targetLang}
          onTargetLangChange={setTargetLang}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          translationsMap={translationsMap}
          onApplyTranslations={(newMap) => setTranslationsMap(newMap)}
          onClearTranslations={() => setTranslationsMap({})}
          platform="kilamanbo"
          onOpenModal={() => {
            if (onOpenTranslateModal) {
              onOpenTranslateModal(
                filteredSubtitles,
                syntheticSoundInfo,
                filterOptions.timeOffset,
                (newMap) => setTranslationsMap(newMap)
              );
            }
          }}
        />
      )}

      {/* Subtitle Table or Informative Empty State */}
      {selectedEpisode && filteredSubtitles.length === 0 ? (
        <div className="bg-[#040c08] border border-[#113121] rounded-2xl p-6 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">
            {language === 'vi' ? 'Chưa có phụ đề trong tập này' : 'No Subtitles Found For This Track'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {language === 'vi'
              ? 'Tập này (PV hoặc Clip ngắn) không có lời thoại kịch bản. Hãy nhấp vào các tập chính bên dưới để xem phụ đề (LRC) & đạn mạc đầy đủ!'
              : 'This track is a promotional clip without script dialogue. Click on regular episodes below to access full subtitles (LRC) and danmaku!'}
          </p>
          {dramaData?.setRespList?.some((e) => e.setLrcUrl && e.setIdStr !== selectedEpisode.setIdStr) && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {dramaData.setRespList
                .filter((e) => e.setLrcUrl && e.setIdStr !== selectedEpisode.setIdStr)
                .slice(0, 4)
                .map((ep) => (
                  <button
                    key={ep.setIdStr}
                    type="button"
                    onClick={() => handleSelectEpisode(ep, dramaData)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    👉 Chuyển sang: {ep.setTitle || ep.setName}
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : selectedEpisode && (
        <div className="bg-[#040c08] border border-[#113121] rounded-2xl overflow-hidden shadow-xl">
          <SubtitleTable
            items={filteredSubtitles}
            currentTime={currentTime}
            timeOffset={filterOptions.timeOffset}
            onJumpToTime={(t: number) => {
              if (audioRef.current) {
                audioRef.current.currentTime = t;
                setCurrentTime(t);
              }
            }}
            onUpdateNote={() => {}}
            displayMode={displayMode}
            targetLang={targetLang}
            onDisplayModeChange={setDisplayMode}
            platform="kilamanbo"
            onQuickTranslateLine={handleQuickTranslateLine}
            onUpdateTranslatedText={(id: string, newText: string) => {
              setTranslationsMap((prev) => ({
                ...prev,
                [id]: {
                  text: newText,
                  role: prev[id]?.role,
                },
              }));
            }}
          />
        </div>
      )}

      {/* Multi-Format Export Panel with Dark Green KilaManbo Theme */}
      {selectedEpisode && (
        <ExportPanel
          items={filteredSubtitles}
          soundInfo={syntheticSoundInfo}
          rawXml=""
          timeOffset={filterOptions.timeOffset}
          targetLang={targetLang}
          theme="kilamanbo"
          customBaseTitle={`KilaManbo_${sanitizeFilename(dramaData?.title || 'manbo')}_${sanitizeFilename(selectedEpisode?.setTitle || selectedEpisode?.setName || 'Ep')}`}
          onCustomDownloadAudio={handleTriggerAudioDownload}
          customAudioDownloading={isDownloadingAudio}
          customAudioProgress={downloadProgress}
          customAudioSuccess={downloadSuccessToast}
          customAudioError={downloadError}
          isVipLocked={isPaidLocked}
          onOpenVipModal={() => {
            setBatchModalInitialScope('series');
            setIsBatchOpen(true);
          }}
          onOpenBatchModal={() => {
            setBatchModalInitialScope('series');
            setIsBatchOpen(true);
          }}
          onOpenTranslateModal={() =>
            onOpenTranslateModal?.(
              filteredSubtitles,
              syntheticSoundInfo,
              filterOptions.timeOffset,
              (newMap) => setTranslationsMap(newMap)
            )
          }
        />
      )}

      {/* Cover Image Preview Modal */}
      {showCoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-lg w-full bg-[#05110a] border border-[#143d26] rounded-2xl p-4 shadow-2xl space-y-3 text-center">
            <div className="flex items-center justify-between border-b border-[#113121] pb-2">
              <span className="text-xs font-bold text-white">{dramaData?.title} - HD Poster</span>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-hidden rounded-xl bg-black">
              <img
                src={coverToPreview}
                alt={dramaData?.title}
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain mx-auto"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                className="px-4 py-2 rounded-xl bg-[#081d12] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <a
                href={coverToPreview}
                target="_blank"
                rel="noreferrer"
                download={`${dramaData?.title || 'manbo'}_cover.jpg`}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Tải Ảnh Gốc' : 'Download HD Image'}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* KilaManbo Batch Multi-Episode Download Modal with Scope & Packaging */}
      <ManboBatchDownloadModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        drama={dramaData}
        selectedEpisode={selectedEpisode}
        initialScope={batchModalInitialScope}
      />
    </div>
  );
};
