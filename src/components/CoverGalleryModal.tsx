import React, { useState } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  Loader2,
  Check,
  Search,
  Maximize2,
  Plane,
} from 'lucide-react';
import { MissEvanEpisode, MissEvanDrama } from '../types/missevan';
import {
  getHighResCoverUrl,
  getCoverThumbnailUrl,
  getCoverFilename,
  downloadCoverImage,
  fetchCoverBlobWithMeta,
} from '../utils/coverDownloader';
import { sanitizeFilename } from '../utils/formatter';
import { useLanguage } from '../context/LanguageContext';
import JSZip from 'jszip';

export interface GalleryCoverItem {
  id: string | number;
  name: string;
  soundstr?: string;
  front_cover?: string;
  cover_image?: string;
  subText?: string;
}

interface CoverGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  drama?: MissEvanDrama | null;
  episodes?: MissEvanEpisode[];
  customTitle?: string;
  customCovers?: GalleryCoverItem[];
}

export const CoverGalleryModal: React.FC<CoverGalleryModalProps> = ({
  isOpen,
  onClose,
  drama,
  episodes = [],
  customTitle,
  customCovers,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreviewUrl, setActivePreviewUrl] = useState<{ url: string; title: string } | null>(null);
  const [downloadingEpId, setDownloadingEpId] = useState<string | number | null>(null);
  const [isZippingAll, setIsZippingAll] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  const validEpisodes: GalleryCoverItem[] = customCovers && customCovers.length > 0
    ? customCovers.filter((c) => Boolean(c.front_cover || c.cover_image))
    : episodes.map((ep) => ({
        id: ep.sound_id || ep.id,
        name: ep.name,
        soundstr: ep.soundstr,
        front_cover: ep.front_cover || ep.cover_image || drama?.cover,
        cover_image: ep.cover_image,
      })).filter((ep) => Boolean(ep.front_cover));

  const displayEpisodes = validEpisodes.filter((ep) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      ep.name.toLowerCase().includes(q) ||
      (ep.soundstr && ep.soundstr.toLowerCase().includes(q)) ||
      String(ep.id).includes(q)
    );
  });

  const dramaName = customTitle || drama?.name || 'AudioDrama';

  const handleDownloadSingle = async (ep: GalleryCoverItem) => {
    const rawCover = ep.front_cover || ep.cover_image;
    if (!rawCover) return;
    setDownloadingEpId(ep.id);

    const filename = getCoverFilename(dramaName, ep.name || `Ep_${ep.id}`);
    await downloadCoverImage(rawCover, filename);

    setTimeout(() => {
      setDownloadingEpId(null);
    }, 1200);
  };

  const handleBatchDownloadCoversZip = async () => {
    if (validEpisodes.length === 0 || isZippingAll) return;
    setIsZippingAll(true);
    setZipProgress({ current: 0, total: validEpisodes.length });

    const zip = new JSZip();
    const folderName = `${sanitizeFilename(dramaName)}_HD_Covers`;
    const folder = zip.folder(folderName) || zip;

    try {
      for (let i = 0; i < validEpisodes.length; i++) {
        const ep = validEpisodes[i];
        setZipProgress({ current: i + 1, total: validEpisodes.length });

        const rawCover = ep.front_cover || ep.cover_image;
        if (!rawCover) continue;

        const meta = await fetchCoverBlobWithMeta(rawCover);
        if (meta && meta.blob) {
          const indexPrefix = String(i + 1).padStart(2, '0');
          const cleanEpName = sanitizeFilename(ep.name || `Ep_${ep.id}`);
          folder.file(`${indexPrefix}_${cleanEpName}.${meta.ext}`, meta.blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to create covers ZIP:', err);
    } finally {
      setIsZippingAll(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl h-[88vh] bg-[#040812] border border-[#162744] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#14233c] flex items-center justify-between bg-[#081020]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 text-slate-950 flex items-center justify-center shadow-md shadow-sky-950/60">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>{t('galleryTitle')}</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800/60 text-[11px] font-mono">
                  {validEpisodes.length} HD
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {dramaName} · {t('gallerySubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchDownloadCoversZip}
              disabled={isZippingAll || validEpisodes.length === 0}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
            >
              {isZippingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                  <span>{t('zippingCovers', { current: zipProgress.current, total: zipProgress.total })}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('downloadAllCoversZip')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#0c1628] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar row: Search & Mobile batch action */}
        <div className="p-3 sm:px-5 border-b border-[#14233c] bg-[#070e1c] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t('searchCoversPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0a1426] border border-[#1a2f52] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="sm:hidden w-full">
            <button
              type="button"
              onClick={handleBatchDownloadCoversZip}
              disabled={isZippingAll || validEpisodes.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
            >
              {isZippingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('zippingCovers', { current: zipProgress.current, total: zipProgress.total })}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('downloadAllCoversZip')}</span>
                </>
              )}
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            {t('showingCoversCount', { count: displayEpisodes.length, total: validEpisodes.length })}
          </span>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#03060c]">
          {validEpisodes.length === 0 ? (
            <div className="text-center py-20 text-slate-500 space-y-3">
              <ImageIcon className="w-14 h-14 mx-auto text-sky-600/40" />
              <p className="font-heading text-lg font-bold text-white">{t('noCoversFound')}</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {t('hangarSubtitle')}
              </p>
            </div>
          ) : displayEpisodes.length === 0 ? (
            <div className="text-center py-20 text-slate-500 space-y-2">
              <ImageIcon className="w-12 h-12 mx-auto text-slate-700" />
              <p className="font-heading text-base font-bold text-slate-400">{t('noCoversFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4.5">
              {displayEpisodes.map((ep, idx) => {
                const rawCover = ep.front_cover || ep.cover_image;
                const thumbUrl = getCoverThumbnailUrl(rawCover);
                const hdUrl = getHighResCoverUrl(rawCover);
                const isDownloading = downloadingEpId === ep.id;

                return (
                  <div
                    key={ep.id}
                    className="group relative bg-[#070e1c] border border-[#162744] hover:border-sky-500/70 rounded-2xl overflow-hidden shadow-lg transition-all hover:shadow-sky-950/40 hover:-translate-y-1 flex flex-col"
                  >
                    {/* Image Thumbnail with Aspect Ratio */}
                    <div className="relative aspect-square w-full bg-[#0a1426] overflow-hidden">
                      <img
                        src={thumbUrl}
                        alt={ep.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Zoom Lightbox Trigger */}
                      <button
                        type="button"
                        onClick={() => setActivePreviewUrl({ url: hdUrl, title: ep.soundstr || ep.name })}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                        title={t('viewCoverLarge')}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Episode badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-sky-300 font-mono text-[10px] font-semibold border border-sky-900/60">
                        {ep.name || `FLIGHT ${idx + 1}`}
                      </div>
                    </div>

                    {/* Metadata & Download Button */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <p
                        className="font-heading font-medium text-xs text-slate-200 line-clamp-2 leading-snug group-hover:text-sky-200"
                        title={ep.soundstr || ep.name}
                      >
                        {ep.soundstr || ep.name}
                      </p>

                      <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#12213a]">
                        <span className="font-mono text-[10px] text-slate-500">
                          ID: {ep.id}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(ep)}
                          disabled={isDownloading}
                          className="px-2.5 py-1 rounded-lg bg-sky-950 hover:bg-sky-500 text-sky-200 hover:text-slate-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                          title={t('downloadCover')}
                        >
                          {isDownloading ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          <span>{t('downloadHdCoverBtn')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lightbox Modal for Full HD Preview */}
        {activePreviewUrl && (
          <div
            className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setActivePreviewUrl(null)}
          >
            <div
              className="relative max-w-3xl max-h-[90vh] bg-[#070e1c] border border-sky-600/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-[#14233c] flex items-center justify-between bg-[#0a1324]">
                <span className="font-heading text-xs font-semibold text-slate-200 truncate pr-4">
                  {activePreviewUrl.title}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await downloadCoverImage(
                        activePreviewUrl.url,
                        `${sanitizeFilename(activePreviewUrl.title)}_HD.jpg`
                      );
                    }}
                    className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('downloadThisCover')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewUrl(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-2 bg-black flex items-center justify-center">
                <img
                  src={activePreviewUrl.url}
                  alt={activePreviewUrl.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
