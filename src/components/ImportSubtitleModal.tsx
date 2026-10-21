import React, { useState } from 'react';
import { Upload, X, FileText, Link2, Check, AlertCircle, Loader2, Plane, Compass } from 'lucide-react';
import { MissEvanDanmakuItem } from '../types/missevan';
import { parseSrtOrLrc } from '../utils/parser';
import { useLanguage } from '../context/LanguageContext';

interface ImportSubtitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (items: MissEvanDanmakuItem[], sourceName: string) => void;
}

export const ImportSubtitleModal: React.FC<ImportSubtitleModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'url'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const items = parseSrtOrLrc(text);
        if (items.length === 0) {
          throw new Error(t('invalidFileError'));
        }
        onImportSuccess(items, file.name);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || t('invalidFileError'));
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage(t('invalidFileError'));
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) {
      setErrorMessage(t('emptyPasteError'));
      return;
    }
    setErrorMessage(null);
    const items = parseSrtOrLrc(pasteText);
    if (items.length === 0) {
      setErrorMessage(t('invalidFileError'));
      return;
    }
    onImportSuccess(items, 'Pasted Subtitles');
    onClose();
  };

  const handleUrlSubmit = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setErrorMessage(t('emptyUrlError'));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/missevan/subtitle/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Failed to load from URL (HTTP ${res.status})`);
      }

      const json = await res.json();
      let items: MissEvanDanmakuItem[] = [];
      if (json.success && Array.isArray(json.data)) {
        items = parseSrtOrLrc(JSON.stringify(json.data));
      } else if (typeof json === 'string') {
        items = parseSrtOrLrc(json);
      }

      if (items.length === 0) {
        throw new Error(t('invalidFileError'));
      }

      onImportSuccess(items, 'MaoEr CDN Subtitle');
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error downloading subtitle');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#060c18] border border-[#162744] rounded-2xl p-6 shadow-2xl text-left space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#14233c] pb-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-400" />
            <h2 className="font-heading text-lg font-bold text-white">
              {t('importModalTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#0c1628] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-[#091224] rounded-xl border border-[#1a2f52] text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab('upload'); setErrorMessage(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center ${
              activeTab === 'upload'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            {t('importModalUploadTab')}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('paste'); setErrorMessage(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center ${
              activeTab === 'paste'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            {t('importModalPasteTab')}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('url'); setErrorMessage(null); }}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center ${
              activeTab === 'url'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            {t('importModalUrlTab')}
          </button>
        </div>

        {/* Tab 1: Upload */}
        {activeTab === 'upload' && (
          <div className="border-2 border-dashed border-[#1e3458] hover:border-sky-400/70 rounded-2xl p-8 text-center transition-colors bg-[#081122]/60">
            <FileText className="w-10 h-10 text-sky-400/60 mx-auto mb-3" />
            <p className="font-heading text-sm text-slate-200 font-semibold mb-1">
              {t('dragDropText')}
            </p>
            <p className="text-xs text-slate-500 mb-4 font-mono">
              {t('supportedFormats')}
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors shadow-md">
              <Upload className="w-4 h-4" />
              <span>{t('browseComputer')}</span>
              <input
                type="file"
                accept=".srt,.lrc,.json,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Tab 2: Paste */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <textarea
              rows={8}
              placeholder={t('pastePlaceholder')}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full bg-[#091224] border border-[#1a2f52] rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-400"
            />
            <button
              type="button"
              onClick={handlePasteSubmit}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
            >
              {t('parseApplyBtn')}
            </button>
          </div>
        )}

        {/* Tab 3: URL */}
        {activeTab === 'url' && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder={t('urlPlaceholder')}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-[#091224] border border-[#1a2f52] rounded-xl px-3 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-400"
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={handleUrlSubmit}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{t('fetchingFromServer')}</span>
                </>
              ) : (
                <span>{t('fetchFromLinkBtn')}</span>
              )}
            </button>
          </div>
        )}

        {/* Error notice */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-[#1c0c16] border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
