import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  ArrowRight,
  AlertCircle,
  Loader2,
  FolderArchive,
  Sparkles,
  Lock,
  KeyRound,
  Upload,
  Plane,
  Compass,
  Radio,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Languages,
} from 'lucide-react';
import { Header } from './components/Header';
import { SoundHeaderBanner } from './components/SoundHeaderBanner';
import { FilterToolbar } from './components/FilterToolbar';
import { SubtitleTable, SubtitleDisplayMode } from './components/SubtitleTable';
import { SubtitleTranslationBanner } from './components/SubtitleTranslationBanner';
import { ExportPanel } from './components/ExportPanel';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { HelpModal } from './components/HelpModal';
import { DramaSeriesSection } from './components/DramaSeriesSection';
import { CookieModal } from './components/CookieModal';
import { ImportSubtitleModal } from './components/ImportSubtitleModal';
import { CoverGalleryModal, GalleryCoverItem } from './components/CoverGalleryModal';
import { CreditsBadge } from './components/CreditsBadge';
import { SubtitleTranslationModal, SubtitleTargetLanguage } from './components/SubtitleTranslationModal';
import { KilaManboWorkspace, KilaManboActiveState } from './components/KilaManboWorkspace';
import { AccessBarrier, ACCESS_STORAGE_KEY } from './components/AccessBarrier';
import {
  MissEvanDanmakuItem,
  MissEvanSoundInfo,
  FilterOptions,
  MissEvanDramaData,
} from './types/missevan';
import {
  parseMissEvanXml,
  isSpamOrBarrage,
  analyzeUserContributions,
  parseMaoErOfficialSubtitles,
} from './utils/parser';
import { getSavedMissEvanCookie } from './utils/audioDownloader';
import { useLanguage } from './context/LanguageContext';

export default function App() {
  const { t, language } = useLanguage();
  
  // Access Barrier authentication
  const [isAccessGranted, setIsAccessGranted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ACCESS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleLockApp = () => {
    try {
      localStorage.removeItem(ACCESS_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsAccessGranted(false);
  };

  const [activePlatform, setActivePlatform] = useState<'missevan' | 'kilamanbo'>('missevan');
  const [activeTabMode, setActiveTabMode] = useState<'single' | 'drama'>('single');
  const [inputUrl, setInputUrl] = useState('');
  const [activeSoundId, setActiveSoundId] = useState('');
  const [soundInfo, setSoundInfo] = useState<MissEvanSoundInfo | null>(null);
  const [rawItems, setRawItems] = useState<MissEvanDanmakuItem[]>([]);
  const [officialSubItems, setOfficialSubItems] = useState<MissEvanDanmakuItem[]>([]);
  const [rawXml, setRawXml] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // VIP & Official Subtitle status
  const [isPaidEpisode, setIsPaidEpisode] = useState(false);
  const [hasOfficialSubNotice, setHasOfficialSubNotice] = useState(false);
  const [paidEpisodePrice, setPaidEpisodePrice] = useState(0);

  // Modals
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCoverGalleryOpen, setIsCoverGalleryOpen] = useState(false);
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);

  // KilaManbo synced state & active modal props
  const [manboState, setManboState] = useState<KilaManboActiveState | null>(null);
  const [activeGalleryProps, setActiveGalleryProps] = useState<{
    dramaTitle?: string;
    customCovers?: GalleryCoverItem[];
  } | null>(null);
  const [activeTranslateProps, setActiveTranslateProps] = useState<{
    items: MissEvanDanmakuItem[];
    soundInfo: MissEvanSoundInfo | null;
    timeOffset: number;
    onApply: (map: Record<string, { text: string; role?: string }>) => void;
  } | null>(null);

  // Subtitle Translation state
  const [targetLang, setTargetLang] = useState<SubtitleTargetLanguage>('vi');
  const [displayMode, setDisplayMode] = useState<SubtitleDisplayMode>('bilingual');
  const [translationsMap, setTranslationsMap] = useState<Record<string, { text: string; role?: string }>>({});

  // Drama series state
  const [dramaData, setDramaData] = useState<MissEvanDramaData | null>(null);
  const [isLoadingDrama, setIsLoadingDrama] = useState(false);

  // Audio sync
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    mode: 'official_subs',
    selectedUid: '',
    smartClean: true,
    minDuration: 1.5,
    maxDuration: 6.0,
    timeOffset: 0,
    searchQuery: '',
  });

  // Parse sound ID from input
  const extractSoundId = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const urlMatch = trimmed.match(/id=(\d+)/) || trimmed.match(/sound\/(\d+)/);
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
    return null;
  };

  // Fetch sound & danmaku & official subtitles
  const fetchSoundData = async (targetId: string) => {
    if (!targetId || !/^\d+$/.test(targetId)) {
      setErrorMessage(t('invalidInputError'));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setIsPaidEpisode(false);
    setHasOfficialSubNotice(false);

    const cookie = getSavedMissEvanCookie();
    const headers: Record<string, string> = {};
    if (cookie) {
      headers['x-missevan-cookie'] = cookie;
    }

    try {
      // Fetch Sound info, Official Subtitles, and Danmaku XML concurrently
      const [soundRes, subRes, dmRes] = await Promise.all([
        fetch(`/api/missevan/sound/${targetId}`, { headers }).catch(() => null),
        fetch(`/api/missevan/subtitle/${targetId}`, { headers }).catch(() => null),
        fetch(`/api/missevan/danmaku/${targetId}`, { headers }),
      ]);

      let infoData: MissEvanSoundInfo | null = null;
      if (soundRes && soundRes.ok) {
        const json = await soundRes.json().catch(() => null);
        if (json && json.success && json.info && json.info.sound) {
          infoData = json.info.sound;
        }
      }

      if (!dmRes.ok) {
        const errorJson = await dmRes.json().catch(() => ({}));
        throw new Error(errorJson.error || `${t('failedToLoadSound')} (HTTP ${dmRes.status})`);
      }

      const xmlText = await dmRes.text();
      setRawXml(xmlText);

      // Parse XML items
      const items = parseMissEvanXml(xmlText);
      setRawItems(items);
      setSoundInfo(infoData);
      setActiveSoundId(targetId);

      // Check Official Subtitles response
      let parsedOfficial: MissEvanDanmakuItem[] = [];
      if (subRes && subRes.ok) {
        const subJson = await subRes.json().catch(() => null);
        if (subJson && subJson.success && Array.isArray(subJson.data) && subJson.data.length > 0) {
          parsedOfficial = parseMaoErOfficialSubtitles(subJson.data);
          setOfficialSubItems(parsedOfficial);
          setIsPaidEpisode(Boolean(subJson.isPaid));
        } else {
          setOfficialSubItems([]);
          setIsPaidEpisode(Boolean(subJson?.isPaid || subJson?.needPay || infoData?.need_pay === 1));
          setHasOfficialSubNotice(Boolean(subJson?.hasOfficialSubNotice || infoData?.intro?.includes('字幕')));
          setPaidEpisodePrice(subJson?.price || infoData?.price || 0);
        }
      } else {
        setOfficialSubItems([]);
      }

      // Auto select appropriate filter mode:
      if (parsedOfficial.length > 0) {
        setFilterOptions((prev) => ({
          ...prev,
          mode: 'official_subs',
          selectedUid: '',
        }));
      } else {
        const hasMode4 = items.some((i) => i.mode === 4);
        setFilterOptions((prev) => ({
          ...prev,
          mode: hasMode4 ? 'subtitles_only' : 'all',
          selectedUid: '',
        }));
      }

      // Query if this episode belongs to a drama in the background
      fetch(`/api/missevan/drama/by-sound/${targetId}`, { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((dJson) => {
          if (dJson && dJson.success && dJson.info && dJson.info.drama) {
            setDramaData(dJson.info);
          }
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Fetch error:', err);
      setErrorMessage(err.message || t('failedToLoadSound'));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch complete Drama / Series data
  const fetchDramaData = async (targetDramaId: string, autoLoadFirstEpisode = true) => {
    if (!targetDramaId || !/^\d+$/.test(targetDramaId)) {
      setErrorMessage(t('invalidInputError'));
      return;
    }

    setIsLoadingDrama(true);
    setErrorMessage(null);

    const cookie = getSavedMissEvanCookie();
    const headers: Record<string, string> = {};
    if (cookie) {
      headers['x-missevan-cookie'] = cookie;
    }

    try {
      const res = await fetch(`/api/missevan/drama/${targetDramaId}`, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch drama series (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (!json.success || !json.info) {
        throw new Error(json.error || t('failedToLoadDrama'));
      }

      setDramaData(json.info);
      setActiveTabMode('drama');

      // Auto load first episode into console
      const firstEp =
        json.info.episodes?.episode?.[0] ||
        json.info.episodes?.ft?.[0] ||
        json.info.episodes?.music?.[0];

      if (autoLoadFirstEpisode && firstEp?.sound_id) {
        fetchSoundData(String(firstEp.sound_id));
      }
    } catch (err: any) {
      console.error('Fetch drama error:', err);
      setErrorMessage(err.message || t('failedToLoadDrama'));
    } finally {
      setIsLoadingDrama(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dramaMatch = inputUrl.match(/drama\/(\d+)/) || inputUrl.match(/drama_id=(\d+)/);
    if (dramaMatch && dramaMatch[1]) {
      fetchDramaData(dramaMatch[1]);
      return;
    }

    const id = extractSoundId(inputUrl);
    if (!id) {
      setErrorMessage(t('invalidInputError'));
      return;
    }
    fetchSoundData(id);
  };

  const handleQuickDemo = (demoId: string) => {
    setInputUrl(demoId);
    fetchSoundData(demoId);
  };

  // User statistics
  const userStats = useMemo(() => {
    if (filterOptions.mode === 'official_subs') {
      return [];
    }
    return analyzeUserContributions(rawItems);
  }, [rawItems, filterOptions.mode]);

  // Filtered items based on options & merged translations
  const filteredItems = useMemo(() => {
    let result = rawItems;

    if (filterOptions.mode === 'official_subs') {
      result = officialSubItems;
    } else if (filterOptions.mode === 'subtitles_only') {
      result = rawItems.filter((i) => i.mode === 4);
    } else if (filterOptions.mode === 'static_only') {
      result = rawItems.filter((i) => i.mode === 4 || i.mode === 5);
    } else if (filterOptions.mode === 'custom_uid' && filterOptions.selectedUid) {
      result = rawItems.filter((i) => i.userId === filterOptions.selectedUid);
    }

    // Smart clean spam
    if (filterOptions.smartClean && filterOptions.mode !== 'official_subs') {
      result = result.filter((i) => !isSpamOrBarrage(i.text));
    }

    // Search query: checks both original Chinese text and translated text
    if (filterOptions.searchQuery.trim()) {
      const q = filterOptions.searchQuery.toLowerCase().trim();
      result = result.filter((i) => {
        const matchOrig = i.text.toLowerCase().includes(q);
        const tr = translationsMap[i.id]?.text || i.translatedText;
        const matchTrans = tr ? tr.toLowerCase().includes(q) : false;
        return matchOrig || matchTrans;
      });
    }

    // Merge active translations map into items
    return result.map((item) => {
      const tr = translationsMap[item.id];
      if (tr) {
        return {
          ...item,
          translatedText: tr.text,
          translatedRole: tr.role,
          translationLang: targetLang,
        };
      }
      return item;
    });
  }, [rawItems, officialSubItems, filterOptions, translationsMap, targetLang]);

  // Jump to specific time in audio
  const handleJumpToTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {});
    }
    setCurrentTime(seconds);
  };

  // Inline edit single subtitle note
  const handleUpdateNote = (id: string, text: string) => {
    if (filterOptions.mode === 'official_subs') {
      setOfficialSubItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, userNote: text } : item))
      );
    } else {
      setRawItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, userNote: text } : item))
      );
    }
  };

  // Inline edit single translated subtitle text
  const handleUpdateTranslatedText = (id: string, text: string) => {
    setTranslationsMap((prev) => ({
      ...prev,
      [id]: {
        text,
        role: prev[id]?.role,
      },
    }));
  };

  // Bulk apply translations from translation tool
  const handleApplyTranslations = (
    translatedMap: Record<string, { text: string; role?: string }>,
    lang: SubtitleTargetLanguage
  ) => {
    setTranslationsMap((prev) => ({ ...prev, ...translatedMap }));
    setTargetLang(lang);
    setDisplayMode('bilingual');
  };

  // Quick single-line translation on demand
  const handleQuickTranslateLine = async (item: MissEvanDanmakuItem) => {
    const res = await fetch('/api/subtitles/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: item.id, text: item.text, role: item.role }],
        targetLang,
        dramaContext: soundInfo?.soundstr,
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

  const handleImportSuccess = (imported: MissEvanDanmakuItem[]) => {
    setOfficialSubItems(imported);
    setFilterOptions((prev) => ({
      ...prev,
      mode: 'official_subs',
      selectedUid: '',
    }));
  };

  const handleOpenCoverGallery = () => {
    if (activePlatform === 'kilamanbo') {
      if (manboState) {
        manboState.openCoverGallery();
      }
    } else {
      setActiveGalleryProps(null);
      setIsCoverGalleryOpen(true);
    }
  };

  const handleOpenHeaderTranslate = () => {
    if (activePlatform === 'kilamanbo') {
      if (manboState) {
        manboState.openTranslateModal();
      }
    } else {
      setActiveTranslateProps(null);
      setIsTranslateModalOpen(true);
    }
  };

  const handleOpenManboCoverGallery = (title: string, covers: GalleryCoverItem[]) => {
    setActiveGalleryProps({ dramaTitle: title, customCovers: covers });
    setIsCoverGalleryOpen(true);
  };

  const handleOpenManboTranslateModal = (
    items: MissEvanDanmakuItem[],
    soundInfo: MissEvanSoundInfo | null,
    timeOffset: number,
    onApply: (map: Record<string, { text: string; role?: string }>) => void
  ) => {
    setActiveTranslateProps({ items, soundInfo, timeOffset, onApply });
    setIsTranslateModalOpen(true);
  };

  if (!isAccessGranted) {
    return <AccessBarrier onUnlock={() => setIsAccessGranted(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#03060c] text-[#e2e8f0] flex flex-col selection:bg-sky-500 selection:text-slate-950">
      <Header
        activePlatform={activePlatform}
        onPlatformChange={setActivePlatform}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenBatch={() => setIsBatchOpen(true)}
        onOpenDramaMode={() => setActiveTabMode('drama')}
        onOpenCoverGallery={handleOpenCoverGallery}
        onOpenTranslate={handleOpenHeaderTranslate}
        onOpenCookieModal={() => setIsCookieModalOpen(true)}
        onLockApp={handleLockApp}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* KilaManbo Workspace (Dedicated Tab - Preserves State) */}
        <div className={activePlatform === 'kilamanbo' ? 'block' : 'hidden'}>
          <KilaManboWorkspace
            onOpenCookieModal={() => setIsCookieModalOpen(true)}
            onOpenTranslateModal={handleOpenManboTranslateModal}
            onOpenCoverGallery={handleOpenManboCoverGallery}
            onRegisterWorkspace={setManboState}
          />
        </div>

        {/* MissEvan Workspace (Dedicated Tab - Preserves State) */}
        <div className={activePlatform === 'missevan' ? 'block space-y-7' : 'hidden'}>
          {/* Hero Section: Aviation Flight Deck Console */}
          <section id="extractor" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 text-xs font-mono font-semibold text-sky-400">
                  <Plane className="w-3.5 h-3.5" />
                  <span>{t('flightControlCenter')}</span>
                </div>
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  MissEvan <span className="text-sky-400">Extractor</span>
                </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {t('appCredits')}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#081020] border border-[#162744] rounded-xl text-xs w-fit">
              <button
                type="button"
                onClick={() => setActiveTabMode('single')}
                className={`px-3.5 py-1.5 rounded-lg font-heading font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTabMode === 'single'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/60 font-bold'
                    : 'text-slate-400 hover:text-sky-300'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-slate-950" />
                <span>{t('singleTrackTab')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTabMode('drama')}
                className={`px-3.5 py-1.5 rounded-lg font-heading font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTabMode === 'drama'
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/60 font-bold'
                    : 'text-slate-400 hover:text-sky-300'
                }`}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>{t('seriesDramaTab')}</span>
                {dramaData && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-950 text-sky-300 text-[10px] font-mono border border-sky-800/60">
                    {dramaData.episodes?.episode?.length ?? 0}
                  </span>
                )}
              </button>
            </div>
          </div>

          {activeTabMode === 'single' ? (
            <>
              {/* Input Bar */}
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row items-stretch gap-2.5 max-w-4xl"
              >
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-sky-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t('inputPlaceholder')}
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full bg-[#070e1b] border border-[#1a2d4c] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition-all font-mono shadow-xl shadow-black/80"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 hover:from-sky-400 hover:to-cyan-300 text-slate-950 font-heading font-bold text-base transition-all shadow-xl shadow-sky-950/60 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('loadPayload')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Presets & Tips */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-1">
                <span className="text-slate-500 text-[11px]">{t('demoLabel')}</span>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('13768262')}
                  className="px-2.5 py-1 rounded-lg bg-[#081224] hover:bg-[#0e1d38] border border-amber-600/60 text-amber-300 font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>13768262 (Ep 51 VIP)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('13528185')}
                  className="px-2.5 py-1 rounded-lg bg-[#081224] hover:bg-[#0e1d38] border border-sky-600/60 text-sky-200 font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span>13528185 (Ep 1 Official Sub)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('13495322')}
                  className="px-2.5 py-1 rounded-lg bg-[#081224] hover:bg-[#0e1d38] border border-[#162744] hover:border-sky-500/50 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
                >
                  13495322 (Trailer)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('221710')}
                  className="px-2.5 py-1 rounded-lg bg-[#081224] hover:bg-[#0e1d38] border border-[#162744] hover:border-sky-500/50 text-slate-400 font-mono text-[11px] transition-colors cursor-pointer"
                >
                  221710 (Tutorial)
                </button>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <button
                  type="button"
                  onClick={() => setIsCookieModalOpen(true)}
                  className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t('configVipCookieBtn')}</span>
                </button>
              </div>

              {/* Secondary Utility Ribbon (relocated from header) */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                <button
                  type="button"
                  onClick={handleOpenCoverGallery}
                  className="px-3 py-1 rounded-lg bg-[#081224] hover:bg-[#0e1d38] border border-sky-500/30 hover:border-sky-400/60 text-sky-300 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title={t('navCovers')}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('navCovers')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBatchOpen(true)}
                  className="px-3 py-1 rounded-lg bg-[#081224] hover:bg-[#0e1d38] border border-sky-500/30 hover:border-sky-400/60 text-sky-300 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title={t('navBatch')}
                >
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('navBatch')}</span>
                </button>

                {(rawItems.length > 0 || officialSubItems.length > 0) && (
                  <button
                    type="button"
                    onClick={handleOpenHeaderTranslate}
                    className="px-3 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/50 text-sky-200 font-semibold text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    title={t('navTranslate')}
                  >
                    <Languages className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('navTranslate')}</span>
                  </button>
                )}
              </div>

              {/* Series Notice Banner if this track belongs to a series */}
              {dramaData && dramaData.drama && (
                <div className="p-3.5 rounded-xl bg-[#060c18] border border-[#162744] flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                  <div className="flex items-center gap-2.5">
                    <FolderArchive className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-slate-300">
                      {t('belongsToSeries')}{' '}
                      <strong className="text-sky-300">{dramaData.drama.name}</strong>{' '}
                      ({dramaData.episodes?.episode?.length ?? 0} eps)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('drama')}
                    className="px-3 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-200 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {t('viewAllEpisodes')} &rarr;
                  </button>
                </div>
              )}
            </>
          ) : (
            <DramaSeriesSection
              dramaData={dramaData}
              isLoadingDrama={isLoadingDrama}
              activeSoundId={activeSoundId}
              onSelectEpisode={(soundId) => fetchSoundData(soundId)}
              onFetchDrama={(dramaId) => fetchDramaData(dramaId, true)}
              onOpenCoverGallery={() => setIsCoverGalleryOpen(true)}
            />
          )}
        </section>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-[#180a12] border border-rose-800/80 text-rose-200 text-xs flex items-start justify-between gap-3 animate-in fade-in shadow-lg">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-heading font-bold text-rose-100 text-sm">{t('failedLoadTitle')}</p>
                <p className="mt-0.5 text-rose-300/90">{errorMessage}</p>
                <p className="mt-1 text-slate-400">
                  {t('tipValidId')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* VIP Episode Explanation & Action Banner */}
        {isPaidEpisode && officialSubItems.length === 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#120e06] via-[#0d1424] to-[#070e1c] border border-amber-600/50 shadow-xl space-y-3 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-white text-base flex flex-wrap items-center gap-2">
                    <span>{t('vipEpisodeTitle', { id: activeSoundId })}</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {paidEpisodePrice ? t('vipDiamonds', { price: paidEpisodePrice }) : 'VIP'}
                    </span>
                    {hasOfficialSubNotice && (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        SRT字幕：官方
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {t('vipDesc')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
                <button
                  type="button"
                  onClick={() => setIsCookieModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-950/50 transition-transform active:scale-95"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{t('enterCookieBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#091326] hover:bg-[#0f1f3a] border border-[#1b3154] text-sky-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('uploadSubtitleBtn')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standby Flight Deck when no track is loaded yet */}
        {!activeSoundId && !soundInfo && !isLoading && !errorMessage && (
          <section className="bg-gradient-to-b from-[#060e1d]/90 to-[#030710]/90 border border-sky-500/25 rounded-3xl p-8 sm:p-12 shadow-2xl cockpit-grid flex flex-col items-center justify-center text-center space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono font-bold tracking-widest">
              <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span>AVIONIC RADAR STANDBY // AWAITING MISSEVAN SOUND</span>
            </div>

            <div className="w-20 h-20 rounded-full bg-[#050c18] border-2 border-sky-500/40 p-2 flex items-center justify-center shadow-lg shadow-sky-950/60 animate-spin-turbine">
              <Compass className="w-10 h-10 text-sky-400" />
            </div>

            <div className="max-w-md space-y-2">
              <h3 className="font-heading text-lg sm:text-xl font-extrabold text-white">
                {language === 'vi' ? 'Sẵn Sàng Tiếp Nhận Dữ Liệu Âm Thanh' : 'Flight Deck Ready for Sound Input'}
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-400 font-mono leading-relaxed">
                {language === 'vi'
                  ? 'Thanh tìm kiếm đã được để trống. Dán liên kết âm thanh MissEvan (missevan.com/sound/...) hoặc nhập ID âm thanh vào thanh tìm kiếm phía trên để bắt đầu trích xuất.'
                  : 'Search box is clear. Paste any MissEvan sound link (missevan.com/sound/...) or enter a sound ID above to begin extracting.'}
              </p>
            </div>
          </section>
        )}

        {/* Sound Header & Cockpit Instrument Banner */}
        {activeSoundId && (
          <SoundHeaderBanner
            soundInfo={soundInfo}
            soundId={activeSoundId}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            audioRef={audioRef}
            onOpenCookieModal={() => setIsCookieModalOpen(true)}
          />
        )}

        {/* Filters and Search Toolbar */}
        {(rawItems.length > 0 || officialSubItems.length > 0) && (
          <FilterToolbar
            options={filterOptions}
            onChange={setFilterOptions}
            userStats={userStats}
            totalRawCount={rawItems.length}
            filteredCount={filteredItems.length}
            officialCount={officialSubItems.length}
            isPaidEpisode={isPaidEpisode}
            hasOfficialSubNotice={hasOfficialSubNotice}
            onOpenCookieModal={() => setIsCookieModalOpen(true)}
            onImportSubtitles={() => setIsImportModalOpen(true)}
          />
        )}

        {/* Subtitle Translation Tool - Highly Visible Command Center */}
        {!isLoading && (filteredItems.length > 0 || officialSubItems.length > 0 || rawItems.length > 0) && (
          <SubtitleTranslationBanner
            items={filteredItems.length > 0 ? filteredItems : (officialSubItems.length > 0 ? officialSubItems : rawItems)}
            soundInfo={soundInfo}
            timeOffset={filterOptions.timeOffset}
            targetLang={targetLang}
            onTargetLangChange={setTargetLang}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            translationsMap={translationsMap}
            onApplyTranslations={handleApplyTranslations}
            onClearTranslations={() => setTranslationsMap({})}
            onOpenModal={() => setIsTranslateModalOpen(true)}
          />
        )}

        {/* Subtitle Table */}
        {isLoading ? (
          <div className="bg-[#060c18] border border-[#162744] rounded-2xl p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 shadow-2xl">
            <Compass className="w-10 h-10 animate-spin-turbine text-sky-400" />
            <p className="font-heading text-lg font-bold text-white">{t('spinningDeck')}</p>
            <p className="text-xs text-slate-500">{t('synchronizingDialogue')}</p>
          </div>
        ) : (
          (rawItems.length > 0 || officialSubItems.length > 0 || isPaidEpisode) && (
            <SubtitleTable
              items={filteredItems}
              currentTime={currentTime}
              timeOffset={filterOptions.timeOffset}
              onJumpToTime={handleJumpToTime}
              onUpdateNote={handleUpdateNote}
              onUpdateTranslatedText={handleUpdateTranslatedText}
              isPaidEpisode={isPaidEpisode && officialSubItems.length === 0}
              onOpenCookieModal={() => setIsCookieModalOpen(true)}
              onImportSubtitles={() => setIsImportModalOpen(true)}
              onOpenTranslateModal={() => setIsTranslateModalOpen(true)}
              onQuickTranslateLine={handleQuickTranslateLine}
              targetLang={targetLang}
              displayMode={displayMode}
              onDisplayModeChange={setDisplayMode}
            />
          )
        )}

        {/* Export and Action Panel */}
        {filteredItems.length > 0 && (
          <ExportPanel
            items={filteredItems}
            soundInfo={soundInfo}
            rawXml={rawXml}
            timeOffset={filterOptions.timeOffset}
            onOpenTranslateModal={() => setIsTranslateModalOpen(true)}
            targetLang={targetLang}
          />
        )}
        </div>
      </main>

      {/* Flight Operations Footer */}
      <footer className="border-t border-[#131d30] bg-[#03060c] py-7 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-slate-400 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Compass className={`w-3.5 h-3.5 ${activePlatform === 'kilamanbo' ? 'text-rose-400' : 'text-sky-400'} shrink-0`} />
              <span className="font-semibold text-slate-300">
                {activePlatform === 'kilamanbo'
                  ? 'KilaManbo 漫播 Extractor: Audio, Subtitles, Cover Photos...'
                  : 'MissEvan Extractor: Audio, Subtitles, Cover Photos...'}
              </span>
            </div>
            <span className="hidden sm:inline text-slate-700">·</span>
            <CreditsBadge className="text-[11px]" showIcon={true} />
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="hover:text-sky-300 transition-colors cursor-pointer"
            >
              {t('flightManual')}
            </button>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <button
              onClick={() => setIsCookieModalOpen(true)}
              className="hover:text-sky-300 transition-colors cursor-pointer text-sky-400/90"
            >
              {t('vipClearance')}
            </button>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <a
              href={activePlatform === 'kilamanbo' ? 'https://www.kilamanbo.world' : 'https://www.missevan.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-300 transition-colors"
            >
              {activePlatform === 'kilamanbo' ? 'kilamanbo.world' : 'MissEvan.com'}
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onOpenCookieModal={() => setIsCookieModalOpen(true)}
        initialPlatform={activePlatform}
      />
      <BatchDownloadModal isOpen={isBatchOpen} onClose={() => setIsBatchOpen(false)} />
      <CookieModal
        isOpen={isCookieModalOpen}
        onClose={() => setIsCookieModalOpen(false)}
        onCookieSaved={() => {
          if (activeSoundId) fetchSoundData(activeSoundId);
        }}
        soundId={activeSoundId}
        isPaidEpisode={isPaidEpisode}
        initialPlatform={activePlatform}
      />
      <ImportSubtitleModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
      <CoverGalleryModal
        isOpen={isCoverGalleryOpen}
        onClose={() => {
          setIsCoverGalleryOpen(false);
          setActiveGalleryProps(null);
        }}
        customTitle={activeGalleryProps?.dramaTitle}
        customCovers={activeGalleryProps?.customCovers}
        drama={dramaData?.drama || null}
        episodes={[
          ...(dramaData?.episodes?.episode || []),
          ...(dramaData?.episodes?.ft || []),
          ...(dramaData?.episodes?.music || []),
        ]}
      />
      <SubtitleTranslationModal
        isOpen={isTranslateModalOpen}
        onClose={() => {
          setIsTranslateModalOpen(false);
          setActiveTranslateProps(null);
        }}
        platform={activePlatform}
        items={
          activeTranslateProps?.items ??
          (filteredItems.length > 0 ? filteredItems : (officialSubItems.length > 0 ? officialSubItems : rawItems))
        }
        soundInfo={activeTranslateProps?.soundInfo ?? soundInfo}
        timeOffset={activeTranslateProps?.timeOffset ?? filterOptions.timeOffset}
        onApplyTranslations={(map, lang) => {
          if (activeTranslateProps) {
            activeTranslateProps.onApply(map);
          } else {
            handleApplyTranslations(map, lang);
          }
        }}
      />
    </div>
  );
}
