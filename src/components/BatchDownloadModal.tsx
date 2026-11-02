import React, { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Layers, Image as ImageIcon, Music, FileText, Plane } from 'lucide-react';
import JSZip from 'jszip';
import { parseMissEvanXml } from '../utils/parser';
import { generateSRT, generateLRC, generateVTT, generateTXT, downloadFile, sanitizeFilename } from '../utils/formatter';
import { safeTriggerAudioDownload, fetchAudioBlob, fetchAudioInfo } from '../utils/audioDownloader';
import { fetchCoverBlobWithMeta } from '../utils/coverDownloader';
import { useLanguage } from '../context/LanguageContext';

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const [inputLines, setInputLines] = useState('');
  const [downloadType, setDownloadType] = useState<'subtitles' | 'audio' | 'covers' | 'both'>('subtitles');
  const [isRunning, setIsRunning] = useState(false);
  const [statusLog, setStatusLog] = useState<{ id: string; name: string; count: number; error?: string; isAudio?: boolean }[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  const extractSoundIds = (text: string): string[] => {
    const lines = text.split(/[\n,; ]+/).filter((s) => s.trim().length > 0);
    const ids: string[] = [];

    for (const line of lines) {
      const urlMatch = line.match(/id=(\d+)/) || line.match(/sound\/(\d+)/);
      if (urlMatch && urlMatch[1]) {
        ids.push(urlMatch[1]);
      } else if (/^\d+$/.test(line)) {
        ids.push(line);
      }
    }

    return Array.from(new Set(ids));
  };

  const handleStartBatch = async () => {
    const ids = extractSoundIds(inputLines);
    if (ids.length === 0) return;

    setIsRunning(true);
    setStatusLog([]);
    setProgress({ current: 0, total: ids.length });

    // If downloading audio directly (for 1 to 4 tracks without zipping overhead)
    if (downloadType === 'audio' && ids.length <= 4) {
      for (let i = 0; i < ids.length; i++) {
        const soundId = ids[i];
        try {
          const soundRes = await fetch(`/api/missevan/sound/${soundId}`).catch(() => null);
          let soundTitle = `Flight_${soundId}`;
          if (soundRes && soundRes.ok) {
            const soundData = await soundRes.json().catch(() => null);
            if (soundData?.info?.sound?.soundstr) {
              soundTitle = soundData.info.sound.soundstr;
            }
          }
          const dlRes = await safeTriggerAudioDownload(soundId, soundTitle);
          if (!dlRes.ok) {
            setStatusLog((prev) => [
              ...prev,
              { id: soundId, name: soundTitle, count: 0, error: dlRes.error || t('vipLockedNotice'), isAudio: true },
            ]);
          } else {
            setStatusLog((prev) => [
              ...prev,
              { id: soundId, name: soundTitle, count: 1, isAudio: true },
            ]);
          }
        } catch (err: any) {
          setStatusLog((prev) => [
            ...prev,
            { id: soundId, name: `Flight ${soundId}`, count: 0, error: err.message },
          ]);
        }
        setProgress({ current: i + 1, total: ids.length });
        if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 600));
      }
      setIsRunning(false);
      return;
    }

    const zip = new JSZip();

    for (let i = 0; i < ids.length; i++) {
      const soundId = ids[i];
      try {
        const shouldFetchSubs = downloadType === 'subtitles' || downloadType === 'both';
        const shouldFetchAudio = downloadType === 'audio' || downloadType === 'both';
        const shouldFetchCover = downloadType === 'covers' || downloadType === 'both';

        const [soundRes, dmRes] = await Promise.all([
          fetch(`/api/missevan/sound/${soundId}`).catch(() => null),
          shouldFetchSubs ? fetch(`/api/missevan/danmaku/${soundId}`) : Promise.resolve(null),
        ]);

        let soundTitle = `Flight_${soundId}`;
        let coverUrl: string | undefined = undefined;

        if (soundRes && soundRes.ok) {
          const soundData = await soundRes.json().catch(() => null);
          if (soundData?.info?.sound) {
            if (soundData.info.sound.soundstr) {
              soundTitle = soundData.info.sound.soundstr;
            }
            coverUrl = soundData.info.sound.front_cover || soundData.info.sound.cover_image;
          }
        }

        const safeTitle = sanitizeFilename(soundTitle);
        const folder = ids.length === 1 ? zip : (zip.folder(`Ep_${i + 1}_ID_${soundId}`) || zip);

        let subCount = 0;
        if (dmRes && dmRes.ok) {
          const xml = await dmRes.text();
          const allItems = parseMissEvanXml(xml);
          let subItems = allItems.filter((item) => item.mode === 4);
          if (subItems.length === 0) {
            subItems = allItems;
          }
          subCount = subItems.length;

          folder.file(`${safeTitle}.srt`, generateSRT(subItems));
          folder.file(`${safeTitle}.lrc`, generateLRC(subItems, null));
          folder.file(`${safeTitle}.vtt`, generateVTT(subItems));
          folder.file(`${safeTitle}.txt`, generateTXT(subItems, true));
        }

        // Fetch audio file if requested
        if (shouldFetchAudio) {
          const info = await fetchAudioInfo(soundId);
          if (info.success && !info.isPaid) {
            try {
              const { blob, filename } = await fetchAudioBlob(soundId, undefined, undefined, info);
              folder.file(filename, blob);
            } catch {
              // ignore
            }
          }
        }

        // Fetch cover art if requested
        if (shouldFetchCover && coverUrl) {
          try {
            const meta = await fetchCoverBlobWithMeta(coverUrl);
            if (meta && meta.blob) {
              folder.file(`${safeTitle}_cover.${meta.ext}`, meta.blob);
            }
          } catch {
            // ignore
          }
        }

        setStatusLog((prev) => [
          ...prev,
          {
            id: soundId,
            name: soundTitle,
            count: subCount,
            isAudio: shouldFetchAudio,
          },
        ]);
      } catch (err: any) {
        setStatusLog((prev) => [
          ...prev,
          { id: soundId, name: `Flight ${soundId}`, count: 0, error: err.message },
        ]);
      }

      setProgress({ current: i + 1, total: ids.length });
    }

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const pkgType =
        downloadType === 'both'
          ? 'Full_Flight_Package'
          : downloadType === 'audio'
          ? 'Audio_Tracks'
          : downloadType === 'covers'
          ? 'HD_Covers'
          : 'Subtitles';
      downloadFile(blob, `MissEvan_Batch_${ids.length}_${pkgType}.zip`, 'application/zip');
    } catch (err) {
      console.error('Error generating batch zip:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const detectedCount = extractSoundIds(inputLines).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#050a14] border border-[#162744] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="p-5 border-b border-[#14233c] flex items-center justify-between bg-[#081020]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 flex items-center justify-center shadow-md shadow-sky-950/60">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-white">{t('batchModalTitle')}</h3>
              <p className="text-xs text-slate-400">
                {t('batchModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="text-slate-400 hover:text-sky-400 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs text-slate-300">
          {/* Download Type Selector */}
          <div>
            <label className="font-medium text-sky-200 block mb-1.5">
              {t('selectDownloadType')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setDownloadType('subtitles')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  downloadType === 'subtitles'
                    ? 'bg-[#0e2142] border-sky-400 text-white font-bold shadow-md'
                    : 'bg-[#081020] border-[#162744] text-slate-400 hover:text-white hover:bg-[#0c1628]'
                }`}
              >
                <div className="text-xs font-heading font-bold">{t('typeSubtitlesOnly')}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t('typeSubtitlesDesc')}</div>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setDownloadType('audio')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  downloadType === 'audio'
                    ? 'bg-[#0e2142] border-sky-400 text-white font-bold shadow-md'
                    : 'bg-[#081020] border-[#162744] text-slate-400 hover:text-white hover:bg-[#0c1628]'
                }`}
              >
                <div className="text-xs font-heading font-bold text-sky-300">{t('typeAudioOnly')}</div>
                <div className="text-[10px] text-sky-400/80 mt-0.5">{t('typeAudioDesc')}</div>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setDownloadType('covers')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  downloadType === 'covers'
                    ? 'bg-[#0e2142] border-cyan-400 text-white font-bold shadow-md'
                    : 'bg-[#081020] border-[#162744] text-slate-400 hover:text-cyan-200 hover:bg-[#0c1628]'
                }`}
              >
                <div className="text-xs font-heading font-bold text-cyan-300">{t('typeCoversOnly')}</div>
                <div className="text-[10px] text-cyan-400/80 mt-0.5">{t('typeCoversDesc')}</div>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setDownloadType('both')}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  downloadType === 'both'
                    ? 'bg-[#0e2142] border-sky-400 text-white font-bold shadow-md'
                    : 'bg-[#081020] border-[#162744] text-slate-400 hover:text-white hover:bg-[#0c1628]'
                }`}
              >
                <div className="text-xs font-heading font-bold text-white">{t('typeFullPackage')}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t('typeFullPackageDesc')}</div>
              </button>
            </div>
          </div>

          <div>
            <label className="font-medium text-sky-200 block mb-1.5">
              {t('batchInputLabel')}
            </label>
            <textarea
              rows={6}
              disabled={isRunning}
              placeholder={`https://www.missevan.com/sound/player?id=221710\nhttps://www.missevan.com/sound/player?id=13768262\n221710\n13768262`}
              value={inputLines}
              onChange={(e) => setInputLines(e.target.value)}
              className="w-full bg-[#081020] border border-[#162744] rounded-xl p-3.5 text-white font-mono text-xs focus:outline-none focus:border-sky-400 transition-colors shadow-inner"
            />
          </div>

          {/* Progress bar */}
          {isRunning && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>{t('processingBatch', { current: progress.current, total: progress.total })}</span>
                <span className="text-sky-400 font-bold">
                  {Math.round((progress.current / (progress.total || 1)) * 100)}%
                </span>
              </div>
              <div className="w-full bg-[#0d1627] rounded-full h-2 overflow-hidden border border-[#182a47]">
                <div
                  className="bg-gradient-to-r from-sky-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.current / (progress.total || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Status logs */}
          {statusLog.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto border border-[#162744] rounded-xl p-3 bg-[#081020]">
              <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                Telemetry Extraction Log
              </span>
              {statusLog.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-[11px] py-1 border-b border-[#121f35] last:border-0"
                >
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    {log.error ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="font-mono text-slate-400 shrink-0">{log.id}</span>
                    <span className="truncate text-slate-200">{log.name}</span>
                  </div>
                  <span className="font-mono text-[10px] shrink-0 text-slate-400">
                    {log.error ? (
                      <span className="text-amber-400">{log.error}</span>
                    ) : (
                      `${log.count} lines`
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#14233c] bg-[#081020] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {t('detectedCountLabel', { count: detectedCount })}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isRunning}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartBatch}
              disabled={isRunning || detectedCount === 0}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all shadow-md shadow-sky-950/60 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isRunning ? t('loading') : t('startBatchBtn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
