import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Layers,
  Image as ImageIcon,
  FileText,
  Download,
  Copy,
  Check,
  Compass,
} from 'lucide-react';
import JSZip from 'jszip';
import { KilaManboDramaDetail, KilaManboEpisode } from '../types/kilamanbo';
import { generateSRT, generateVTT, sanitizeFilename, downloadFile } from '../utils/formatter';
import { parseKilaManboLrcString } from '../utils/parser';
import { useLanguage } from '../context/LanguageContext';

interface ManboBatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  drama: KilaManboDramaDetail | null;
  selectedEpisode?: KilaManboEpisode | null;
  initialScope?: 'single' | 'series';
}

export const ManboBatchDownloadModal: React.FC<ManboBatchDownloadModalProps> = ({
  isOpen,
  onClose,
  drama,
  selectedEpisode,
  initialScope = 'series',
}) => {
  const { language } = useLanguage();
  const [scope, setScope] = useState<'single' | 'series'>(initialScope);
  const [singleSelectedEpId, setSingleSelectedEpId] = useState<string>('');
  const [downloadType, setDownloadType] = useState<'subtitles' | 'covers' | 'audio' | 'all'>('all');
  const [selectedEpIds, setSelectedEpIds] = useState<Record<string, boolean>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [copiedId, setCopiedId] = useState(false);
  const [statusLog, setStatusLog] = useState<
    { id: string; name: string; count: number; error?: string }[]
  >([]);

  useEffect(() => {
    if (isOpen) {
      if (initialScope) {
        setScope(initialScope);
      }
      if (selectedEpisode?.setIdStr) {
        setSingleSelectedEpId(selectedEpisode.setIdStr);
      } else if (drama?.setRespList?.[0]?.setIdStr) {
        setSingleSelectedEpId(drama.setRespList[0].setIdStr);
      }
    }
  }, [isOpen, initialScope, selectedEpisode?.setIdStr, drama?.setRespList]);

  if (!isOpen || !drama) return null;

  const episodes = drama.setRespList || [];
  const dramaId = String(drama.radioDramaIdStr || drama.radioDramaId || '');

  // Initialize selected state if empty
  const allSelected =
    episodes.length > 0 && episodes.every((e) => selectedEpIds[e.setIdStr] !== false);

  const toggleSelectAll = () => {
    const nextState: Record<string, boolean> = {};
    const targetVal = !allSelected;
    for (const ep of episodes) {
      nextState[ep.setIdStr] = targetVal;
    }
    setSelectedEpIds(nextState);
  };

  const toggleSelectOne = (idStr: string) => {
    setSelectedEpIds((prev) => ({
      ...prev,
      [idStr]: prev[idStr] === false ? true : false,
    }));
  };

  const handleCopyDramaId = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(dramaId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleStartBatch = async () => {
    let chosenEps: KilaManboEpisode[] = [];
    if (scope === 'single') {
      const target = episodes.find((e) => e.setIdStr === singleSelectedEpId) || selectedEpisode || episodes[0];
      if (target) chosenEps = [target];
    } else {
      chosenEps = episodes.filter((e) => selectedEpIds[e.setIdStr] !== false);
    }
    if (chosenEps.length === 0) return;

    setIsRunning(true);
    setStatusLog([]);
    setProgress({ current: 0, total: chosenEps.length });

    const zip = new JSZip();
    const dramaFolder = zip.folder(
      scope === 'single'
        ? `[KilaManbo]_${sanitizeFilename(drama.title)}_${sanitizeFilename(chosenEps[0]?.setTitle || chosenEps[0]?.setName || 'Single')}`
        : `[KilaManbo]_${sanitizeFilename(drama.title)}_[${dramaId}]`
    ) || zip;

    // Create a comprehensive Manifest & Metadata file in the root
    const manifestLines: string[] = [
      `============================================================`,
      `KILAMANBO (漫播) DRAMA ARCHIVE MANIFEST`,
      `============================================================`,
      `Drama Title : ${drama.title}`,
      `Drama ID    : ${dramaId}`,
      `Direct Link : https://www.kilamanbo.world/manbo/pc/detail?id=${dramaId}`,
      `Episodes    : ${episodes.length} episodes (${chosenEps.length} selected for export)`,
      `Extracted At: ${new Date().toISOString()}`,
      `============================================================\n`,
      `DESCRIPTION / 剧集简介:`,
      `${drama.desc || 'No description provided.'}\n`,
      `CV CAST / 参演声优:`,
      Array.isArray(drama.cvRespList) && drama.cvRespList.length > 0
        ? drama.cvRespList.map((c) => `- ${c.roleName ? `${c.roleName}: ` : ''}${c.cvName}`).join('\n')
        : 'N/A',
      `\n============================================================`,
      `TRACKLIST / 剧集列表:`,
    ];

    episodes.forEach((e) => {
      manifestLines.push(
        `#${String(e.setNo || 0).padStart(2, '0')} [ID: ${e.setIdStr}] ${e.setTitle || e.setName} - ${Math.floor((e.duration || 0) / 60000)}m${Math.floor(((e.duration || 0) % 60000) / 1000)}s ${e.payType === 1 ? '[VIP]' : '[FREE]'} ${e.setLrcUrl ? '[Official LRC]' : ''}`
      );
    });
    manifestLines.push(`============================================================\n`);

    dramaFolder.file(`00_Drama_Manifest_[ID_${dramaId}].txt`, manifestLines.join('\n'));

    for (let i = 0; i < chosenEps.length; i++) {
      const ep = chosenEps[i];
      const epTitle = sanitizeFilename(ep.setTitle || ep.setName || `Tap_${ep.setNo}`);
      const epPrefix = `${String(ep.setNo || i + 1).padStart(2, '0')}_${epTitle}`;

      try {
        let subCount = 0;

        // 1. Fetch Official Subtitles (.LRC, .SRT, .VTT)
        if (downloadType === 'subtitles' || downloadType === 'all') {
          let lrcText = '';

          // Prefer direct LRC URL from episode metadata
          if (ep.setLrcUrl) {
            try {
              const cleanUrl = ep.setLrcUrl.startsWith('//')
                ? `https:${ep.setLrcUrl}`
                : ep.setLrcUrl;
              const res = await fetch(cleanUrl);
              if (res.ok) lrcText = await res.text();
            } catch (err) {
              console.warn('Direct LRC fetch failed, falling back to API:', err);
            }
          }

          // Fallback to backend API with dramaId
          if (!lrcText) {
            try {
              const res = await fetch(
                `/api/manbo/subtitles?dramaSetId=${encodeURIComponent(
                  ep.setIdStr
                )}&dramaId=${encodeURIComponent(dramaId)}`
              );
              if (res.ok) {
                const json = await res.json();
                if (json.rawLrc) lrcText = json.rawLrc;
              }
            } catch (err) {
              console.warn('API subtitles fetch error:', err);
            }
          }

          if (lrcText) {
            dramaFolder.file(`${epPrefix}.lrc`, lrcText);

            const parsedItems = parseKilaManboLrcString(lrcText);
            subCount = parsedItems.length;
            if (parsedItems.length > 0) {
              const srtContent = generateSRT(parsedItems);
              const vttContent = generateVTT(parsedItems);
              dramaFolder.file(`${epPrefix}.srt`, srtContent);
              dramaFolder.file(`${epPrefix}.vtt`, vttContent);
            }
          }
        }

        // 2. Fetch Episode Poster Cover (.JPG)
        if (downloadType === 'covers' || downloadType === 'all') {
          const coverUrl = ep.setPic || drama.coverPic;
          if (coverUrl) {
            try {
              const cleanPic = coverUrl.startsWith('//') ? `https:${coverUrl}` : coverUrl;
              const picRes = await fetch(cleanPic);
              if (picRes.ok) {
                const picBlob = await picRes.blob();
                dramaFolder.file(`${epPrefix}_Cover.jpg`, picBlob);
              }
            } catch (picErr) {
              console.warn('Cover fetch error:', picErr);
            }
          }
        }

        // 3. Fetch Audio Stream for episodes that have audio available
        if (downloadType === 'audio' || downloadType === 'all') {
          let streamUrl = '';
          const resp = ep.setAudioResp;
          if (resp) {
            streamUrl =
              resp.superQualityResp?.decryptedAudioUrl ||
              resp.highQualityResp?.decryptedAudioUrl ||
              resp.normalQualityResp?.decryptedAudioUrl ||
              '';
          }

          if (!streamUrl) {
            try {
              const epRes = await fetch(
                `/api/manbo/episode?dramaSetId=${encodeURIComponent(
                  ep.setIdStr
                )}&dramaId=${encodeURIComponent(dramaId)}`
              );
              if (epRes.ok) {
                const epJson = await epRes.json();
                if (epJson.audioUrl) {
                  streamUrl = epJson.audioUrl;
                }
              }
            } catch (err) {
              console.warn('Failed to query episode audio stream:', err);
            }
          }

          if (streamUrl) {
            try {
              const audioProxyUrl = `/api/manbo/audio-proxy?url=${encodeURIComponent(
                streamUrl
              )}&title=${encodeURIComponent(epPrefix)}&download=1`;
              const audioRes = await fetch(audioProxyUrl);
              if (audioRes.ok) {
                const audioBlob = await audioRes.blob();
                dramaFolder.file(`${epPrefix}.mp4`, audioBlob);
              }
            } catch (audioErr) {
              console.warn('Failed to package episode audio stream:', audioErr);
            }
          }
        }

        setStatusLog((prev) => [
          ...prev,
          {
            id: ep.setIdStr,
            name: ep.setTitle || ep.setName || `Tập ${ep.setNo}`,
            count: subCount,
          },
        ]);
      } catch (err: any) {
        setStatusLog((prev) => [
          ...prev,
          {
            id: ep.setIdStr,
            name: ep.setTitle || ep.setName || `Tập ${ep.setNo}`,
            count: 0,
            error: err.message || 'Lỗi',
          },
        ]);
      }

      setProgress({ current: i + 1, total: chosenEps.length });
    }

    // Include Main Drama Poster Cover in root of zip
    if (drama.coverPic || drama.largePic) {
      try {
        const mainCover = drama.largePic || drama.coverPic;
        const mainRes = await fetch(mainCover.startsWith('//') ? `https:${mainCover}` : mainCover);
        if (mainRes.ok) {
          const mainBlob = await mainRes.blob();
          dramaFolder.file(`00_Main_Drama_Poster.jpg`, mainBlob);
        }
      } catch {}
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const filename = scope === 'single'
        ? `[KilaManbo]_${sanitizeFilename(drama.title)}_${sanitizeFilename(chosenEps[0]?.setTitle || chosenEps[0]?.setName || 'Single')}_${
            downloadType === 'covers'
              ? 'Cover'
              : downloadType === 'subtitles'
              ? 'Subtitles'
              : downloadType === 'audio'
              ? 'Audio'
              : 'Complete_Payload'
          }.zip`
        : `[KilaManbo]_${sanitizeFilename(drama.title)}_[DramaID_${dramaId}]_${
            downloadType === 'covers'
              ? 'Covers'
              : downloadType === 'subtitles'
              ? 'Subtitles'
              : downloadType === 'audio'
              ? 'Audio'
              : 'Complete_Bundle'
          }.zip`;
      downloadFile(zipBlob, filename);
    } catch (zipErr) {
      console.error('Failed to generate zip:', zipErr);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#040e09] border border-[#143a25] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#113121] bg-[#06150d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-600/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-white flex items-center gap-2">
                <span>{language === 'vi' ? 'Xuất Hàng Loạt Kịch KilaManbo' : 'KilaManbo Batch Exporter'}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-bold">
                  {drama.title}
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-mono">
                  Drama ID: <strong className="text-emerald-300">{dramaId}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleCopyDramaId}
                  className="text-[11px] text-slate-400 hover:text-emerald-300 flex items-center gap-0.5 cursor-pointer"
                  title="Sao chép Drama ID"
                >
                  {copiedId ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedId ? 'Đã chép' : 'Chép ID'}</span>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Scope Toggle: Single Track vs Whole Series */}
          <div className="p-1 rounded-xl bg-[#06160e] border border-[#143a25] flex items-center gap-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setScope('single')}
              disabled={isRunning}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                scope === 'single'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-[#0a2417]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Tập Lẻ (1 Single Track)' : '1 Single Track'}</span>
            </button>

            <button
              type="button"
              onClick={() => setScope('series')}
              disabled={isRunning}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                scope === 'series'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-[#0a2417]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Toàn Bộ Kịch (Whole Series)' : 'Whole Drama Series'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono border ${
                scope === 'series'
                  ? 'bg-slate-950/40 text-slate-950 border-slate-900/30'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
              }`}>
                {episodes.length}
              </span>
            </button>
          </div>

          {/* If Single Track mode: Show single episode picker */}
          {scope === 'single' && (
            <div className="p-3.5 rounded-xl bg-[#030d07] border border-[#143a25] space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>{language === 'vi' ? 'Chọn tập cần xuất trọn gói:' : 'Select episode to package:'}</span>
                {episodes.find((e) => e.setIdStr === singleSelectedEpId)?.setLrcUrl && (
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    ✓ Có phụ đề chính thức (.LRC)
                  </span>
                )}
              </div>

              <select
                value={singleSelectedEpId}
                onChange={(e) => setSingleSelectedEpId(e.target.value)}
                disabled={isRunning}
                className="w-full bg-[#05140c] border border-[#18422b] rounded-lg px-3 py-2 text-xs font-medium text-emerald-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {episodes.map((ep) => (
                  <option key={ep.setIdStr} value={ep.setIdStr} className="bg-[#05140c] text-slate-200">
                    #{String(ep.setNo).padStart(2, '0')} - {ep.setTitle || ep.setName} {ep.payType === 1 ? '[VIP]' : '[FREE]'} {ep.setLrcUrl ? '[LRC]' : ''}
                  </option>
                ))}
              </select>

              <div className="text-[11px] text-slate-400 pt-1 font-mono">
                {language === 'vi'
                  ? 'Gói tải tập lẻ sẽ bao gồm file âm thanh gốc (~500kbps), đầy đủ phụ đề (.LRC, .SRT, .VTT) và ảnh bìa chất lượng cao.'
                  : 'Single track package includes decrypted audio (~500kbps), all subtitle formats (.LRC, .SRT, .VTT), and HD cover artwork.'}
              </div>
            </div>
          )}

          {/* Format selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              {scope === 'single'
                ? (language === 'vi' ? 'Chọn định dạng nội dung tập lẻ:' : 'Payload type for single track:')
                : (language === 'vi' ? 'Gói tải về từ Drama ID:' : 'Export Package from Drama ID:')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setDownloadType('all')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                  downloadType === 'all'
                    ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/50'
                    : 'bg-[#06140d] border-[#153a27] text-slate-400 hover:border-emerald-800'
                }`}
              >
                <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">
                    {language === 'vi' ? (scope === 'single' ? 'Trọn Bộ Tập Này' : 'Trọn Gói Kịch') : (scope === 'single' ? 'Full Track Bundle' : 'Full Drama Bundle')}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Subs + Covers + Audio</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDownloadType('subtitles')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                  downloadType === 'subtitles'
                    ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/50'
                    : 'bg-[#06140d] border-[#153a27] text-slate-400 hover:border-emerald-800'
                }`}
              >
                <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">
                    {language === 'vi' ? 'Toàn Bộ Phụ Đề' : 'All Subtitles'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">.LRC, .SRT, .VTT</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDownloadType('covers')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                  downloadType === 'covers'
                    ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/50'
                    : 'bg-[#06140d] border-[#153a27] text-slate-400 hover:border-emerald-800'
                }`}
              >
                <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">
                    {language === 'vi' ? 'Kho Bìa Kịch HD' : 'HD Posters'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Original .JPG</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDownloadType('audio')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
                  downloadType === 'audio'
                    ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/50'
                    : 'bg-[#06140d] border-[#153a27] text-slate-400 hover:border-emerald-800'
                }`}
              >
                <Download className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">
                    {language === 'vi' ? 'Luồng Âm Thanh' : 'Audio Streams'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">.MP4 (~500kbps)</div>
                </div>
              </button>
            </div>
          </div>

          {/* Episode selection list - only in Whole Series mode */}
          {scope === 'series' && (
            <div className="space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span>{language === 'vi' ? 'Chọn tập phim cần tải' : 'Select episodes:'}</span>
                  <span className="text-[11px] font-mono text-emerald-400">
                    ({episodes.filter((e) => selectedEpIds[e.setIdStr] !== false).length}/{episodes.length})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={isRunning}
                  className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer font-bold"
                >
                  {allSelected ? (language === 'vi' ? 'Bỏ chọn tất cả' : 'Deselect all') : (language === 'vi' ? 'Chọn tất cả' : 'Select all')}
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto border border-[#143a25] bg-[#030906] rounded-xl p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-emerald-950">
                {episodes.map((ep) => {
                  const isChecked = selectedEpIds[ep.setIdStr] !== false;
                  return (
                    <label
                      key={ep.setIdStr}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked ? 'bg-[#081a10] text-white' : 'text-slate-400 hover:bg-[#06140c]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(ep.setIdStr)}
                          disabled={isRunning}
                          className="rounded accent-emerald-500 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">
                          #{String(ep.setNo).padStart(2, '0')}
                        </span>
                        <span className="font-semibold truncate">
                          {ep.setTitle || ep.setName}
                        </span>
                        {ep.setLrcUrl && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 shrink-0">
                            LRC
                          </span>
                        )}
                        {ep.payType === 1 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-600/40 shrink-0">
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0 pl-2">
                        {Math.floor((ep.duration || 0) / 60000)}m{Math.floor(((ep.duration || 0) % 60000) / 1000)}s
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isRunning && (
            <div className="space-y-2 p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === 'vi' ? 'Đang trích xuất và đóng gói ZIP...' : 'Extracting & packing ZIP...'}</span>
                </span>
                <span className="text-slate-400 font-mono">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Status logs */}
          {statusLog.length > 0 && (
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-slate-300">
                {language === 'vi' ? 'Nhật ký tiến trình:' : 'Progress Log:'}
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-[#020604] border border-[#113121] rounded-lg font-mono text-[11px]">
                {statusLog.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-slate-300 truncate max-w-[280px]">{log.name}</span>
                    {log.error ? (
                      <span className="text-rose-400">{log.error}</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>{log.count > 0 ? `${log.count} câu phụ đề` : 'OK'}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#113121] bg-[#06150d]">
          <div className="text-xs text-slate-400">
            {language === 'vi' ? (
              <span>Sử dụng Drama ID để trích xuất miễn phí toàn bộ phụ đề và ảnh bìa.</span>
            ) : (
              <span>Utilizing Drama ID to extract all subtitles & posters.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isRunning}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              {language === 'vi' ? 'Đóng' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={
                isRunning ||
                (scope === 'series' && episodes.filter((e) => selectedEpIds[e.setIdStr] !== false).length === 0) ||
                (scope === 'single' && !singleSelectedEpId && !selectedEpisode)
              }
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{language === 'vi' ? 'Đang xuất...' : 'Exporting...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {scope === 'single'
                      ? (language === 'vi' ? 'Tải Trọn Gói Tập Này (.ZIP)' : 'Download Single Track (.ZIP)')
                      : (language === 'vi' ? 'Tải Toàn Bộ Kịch (.ZIP)' : 'Download Whole Series (.ZIP)')}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
