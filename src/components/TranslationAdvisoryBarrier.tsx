import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Globe,
  Check,
  ChevronRight,
  Clock,
  Unlock,
  AlertTriangle,
  Lock,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export type SubtitleTranslationEngine = 'gemini' | 'google';

export const UNLOCKED_STORAGE_KEY = 'subtitle_translation_tool_unlocked';
export const ADVISORY_STORAGE_KEY = 'subtitle_translation_advisory_dismissed';
export const ENGINE_STORAGE_KEY = 'subtitle_translation_engine';

export const isTranslationUnlocked = (): boolean => {
  try {
    return localStorage.getItem(UNLOCKED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const lockTranslationTool = (): void => {
  try {
    localStorage.removeItem(UNLOCKED_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('subtitle-translation-locked'));
  } catch {
    // ignore
  }
};

interface TranslationAdvisoryBarrierProps {
  platform?: 'missevan' | 'kilamanbo';
  currentEngine: SubtitleTranslationEngine;
  onSelectEngine: (engine: SubtitleTranslationEngine) => void;
  onDismiss: (remember: boolean) => void;
  onClose?: () => void;
  isInlineOverlay?: boolean;
}

export const TranslationAdvisoryBarrier: React.FC<TranslationAdvisoryBarrierProps> = ({
  platform = 'missevan',
  currentEngine,
  onSelectEngine,
  onDismiss,
  onClose,
  isInlineOverlay = false,
}) => {
  const { language } = useLanguage();
  const isGreen = platform === 'kilamanbo';
  const isVi = language === 'vi';

  // 3-second mandatory reading countdown to ensure user has actually read the notice
  const [readCountdown, setReadCountdown] = useState<number>(3);
  const [hasReadConfirmed, setHasReadConfirmed] = useState<boolean>(false);
  const [rememberChoice, setRememberChoice] = useState<boolean>(true);

  useEffect(() => {
    if (readCountdown <= 0) return;
    const timer = setInterval(() => {
      setReadCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [readCountdown]);

  const canUnlock = readCountdown === 0 && hasReadConfirmed;

  const handleUnlock = () => {
    if (!canUnlock) return;
    try {
      localStorage.setItem(UNLOCKED_STORAGE_KEY, 'true');
      if (rememberChoice) {
        localStorage.setItem(ADVISORY_STORAGE_KEY, 'true');
      }
      localStorage.setItem(ENGINE_STORAGE_KEY, currentEngine);
      window.dispatchEvent(
        new CustomEvent('subtitle-translation-unlocked', { detail: { engine: currentEngine } })
      );
    } catch {
      // ignore
    }
    onDismiss(rememberChoice);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 transition-all duration-300 ${
        isInlineOverlay ? 'absolute rounded-2xl' : 'fixed'
      } bg-slate-950/90 backdrop-blur-xl overflow-y-auto`}
    >
      {/* Decorative ambient background radar glows */}
      <div
        className={`pointer-events-none absolute w-[480px] h-[480px] rounded-full blur-3xl opacity-25 animate-pulse ${
          isGreen ? 'bg-emerald-500' : 'bg-sky-500'
        }`}
      />

      <div
        className={`relative z-10 w-full max-w-2xl rounded-2xl border-2 p-5 sm:p-7 shadow-2xl overflow-hidden my-auto transition-all ${
          isGreen
            ? 'bg-[#030d07]/95 border-emerald-500/60 shadow-emerald-950/90 military-grid'
            : 'bg-[#040a17]/95 border-sky-500/50 shadow-sky-950/80 cockpit-grid'
        }`}
        style={{
          boxShadow: isGreen
            ? '0 0 60px -10px rgba(16, 185, 129, 0.35), 0 25px 35px -5px rgba(0, 0, 0, 0.8)'
            : '0 0 60px -10px rgba(56, 189, 248, 0.35), 0 25px 35px -5px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Corner Avionics Accents */}
        <div
          className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${
            isGreen ? 'border-emerald-400' : 'border-sky-400'
          }`}
        />
        <div
          className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${
            isGreen ? 'border-emerald-400' : 'border-sky-400'
          }`}
        />
        <div
          className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${
            isGreen ? 'border-emerald-400' : 'border-sky-400'
          }`}
        />
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${
            isGreen ? 'border-emerald-400' : 'border-sky-400'
          }`}
        />

        {/* Top Header Badge */}
        <div className="flex items-start justify-between gap-3 mb-4 border-b pb-4 border-slate-800/80">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl border shrink-0 ${
                isGreen
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-950/60'
                  : 'bg-amber-950/50 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-950/60'
              }`}
            >
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border uppercase ${
                    isGreen
                      ? 'bg-emerald-950 border-emerald-600/70 text-emerald-300'
                      : 'bg-amber-950 border-amber-600/70 text-amber-300'
                  }`}
                >
                  {isVi ? 'KHÓA BẢO VỆ CHUẨN XÁC NỘI DUNG PHỤ ĐỀ' : 'TRANSLATION ACCURACY SECURITY BARRIER'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {isGreen ? 'KilaManbo 漫播' : 'MissEvan 猫耳FM'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-heading font-extrabold text-white leading-tight">
                {isVi
                  ? 'Lưu Ý Quan Trọng Về AI (Gemini) & Tùy Chọn Google Translate'
                  : 'Important Advisory: Gemini AI Nuance & Google Translate Option'}
              </h3>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Đóng / Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Advisory Body Copy (Rewritten & Polished) */}
        <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
          {/* Main Warning Box */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              isGreen
                ? 'bg-[#06190f]/90 border-emerald-500/40 text-emerald-100'
                : 'bg-[#121626]/90 border-amber-500/40 text-slate-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 leading-relaxed">
              {isVi ? (
                <>
                  <p className="font-semibold text-white">
                    Công cụ dịch phụ đề có tích hợp <strong>Trí Tuệ Nhân Tạo (Gemini AI)</strong>.
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    Trong quá trình dịch kịch truyền thanh, AI có thể <em>tự do biến tấu, phóng tác hoặc tự suy diễn nghĩa mới</em> ngoài ý đồ của tác giả, tiềm ẩn nguy cơ làm sai lệch câu thoại nguyên tác tiếng Trung. Quý người dùng vui lòng cẩn trọng và luôn đối chiếu lại câu thoại gốc.
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    Hệ thống đã trang bị thêm tùy chọn <strong>Google Translate (Dịch sát nghĩa nguyên văn)</strong> để bảo đảm độ chính xác tuyệt đối từng từ theo từ điển, không bị biến tấu.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-white">
                    This translation tool integrates <strong>Artificial Intelligence (Gemini AI)</strong>.
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    While translating audio drama dialogues, AI models may <em>creatively rephrase, infer nuances, or invent new meanings</em> beyond the original author's intent, leading to subtitle distortion. Please review translations carefully.
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    We also provide a <strong>Google Translate (Strict Literal)</strong> engine option for verbatim dictionary accuracy without creative liberties.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-300 font-heading font-semibold text-xs">
              {isVi ? 'LỰA CHỌN ĐỘNG CƠ DỊCH CỦA BẠN:' : 'CHOOSE YOUR TRANSLATION ENGINE:'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {isVi ? '(Có thể đổi bất kỳ lúc nào)' : '(Can switch anytime)'}
            </span>
          </div>

          {/* Engine Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Google Translate Engine Card */}
            <button
              type="button"
              onClick={() => onSelectEngine('google')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-2.5 ${
                currentEngine === 'google'
                  ? isGreen
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-lg shadow-emerald-950/70 ring-2 ring-emerald-400/50'
                    : 'bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-950/60 ring-2 ring-sky-400/50'
                  : 'bg-[#06101e] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#0a182d]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg border ${
                      currentEngine === 'google'
                        ? isGreen
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                          : 'bg-sky-500/30 border-sky-400 text-sky-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white flex items-center gap-1.5">
                      <span>Google Translate</span>
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {isVi ? 'SÁT NGHĨA TUYỆT ĐỐI' : 'STRICT LITERAL'}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    currentEngine === 'google'
                      ? isGreen
                        ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                        : 'bg-sky-400 border-sky-400 text-slate-950'
                      : 'border-slate-600'
                  }`}
                >
                  {currentEngine === 'google' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-normal">
                {isVi
                  ? 'Dịch bám sát từng từ ngữ theo từ điển, không phóng tác hay chế nghĩa, bảo đảm nguyên vẹn 100% nội dung gốc.'
                  : 'Verbatim literal dictionary translation without creative liberty. Ensures 100% faithful meaning.'}
              </p>
            </button>

            {/* Gemini AI Engine Card */}
            <button
              type="button"
              onClick={() => onSelectEngine('gemini')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between gap-2.5 ${
                currentEngine === 'gemini'
                  ? isGreen
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-lg shadow-emerald-950/70 ring-2 ring-emerald-400/50'
                    : 'bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-950/60 ring-2 ring-sky-400/50'
                  : 'bg-[#06101e] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#0a182d]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg border ${
                      currentEngine === 'gemini'
                        ? isGreen
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                          : 'bg-sky-500/30 border-sky-400 text-sky-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white flex items-center gap-1.5">
                      <span>Gemini AI</span>
                    </h4>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold">
                      {isVi ? 'VĂN PHONG KỊCH NÓI' : 'DRAMA CONTEXT'}
                    </span>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    currentEngine === 'gemini'
                      ? isGreen
                        ? 'bg-emerald-400 border-emerald-400 text-slate-950'
                        : 'bg-sky-400 border-sky-400 text-slate-950'
                      : 'border-slate-600'
                  }`}
                >
                  {currentEngine === 'gemini' && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-normal">
                {isVi
                  ? 'Dịch biểu cảm, trau chuốt đại từ xưng hô và âm Hán Việt mượt mà. Lưu ý: Cần đối soát lại các phân cảnh quan trọng.'
                  : 'Expressive audio drama dialogue and fluid honorifics. Note: Requires manual review of nuance.'}
              </p>
            </button>
          </div>

          {/* Mandatory Read Confirmation Checkbox */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              hasReadConfirmed
                ? isGreen
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                  : 'bg-sky-950/40 border-sky-500/60 text-sky-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}
          >
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasReadConfirmed}
                onChange={(e) => setHasReadConfirmed(e.target.checked)}
                disabled={readCountdown > 0}
                className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-0 w-4 h-4 mt-0.5 cursor-pointer disabled:opacity-40"
              />
              <span className="text-[11px] font-medium leading-relaxed">
                {isVi ? (
                  <>
                    <strong className="text-white">Tôi xác nhận ĐÃ ĐỌC VÀ HIỂU RÕ LƯU Ý:</strong>{' '}
                    Biết rằng Gemini AI có thể tự suy diễn làm sai lệch ngữ nghĩa câu thoại tiếng Trung, và tôi đã nắm rõ cách chuyển sang Google Translate khi cần bản dịch sát nghĩa nguyên tác.
                  </>
                ) : (
                  <>
                    <strong className="text-white">I confirm I HAVE READ AND UNDERSTOOD:</strong>{' '}
                    Gemini AI may infer nuances that alter original meanings, and I know how to switch to Google Translate for verbatim literal accuracy.
                  </>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions & Unlock Button */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none hover:text-slate-300">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span>
              {isVi
                ? 'Ghi nhớ trạng thái mở khóa trên thiết bị này'
                : 'Remember unlock status on this device'}
            </span>
          </label>

          <button
            type="button"
            onClick={handleUnlock}
            disabled={!canUnlock}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              canUnlock
                ? isGreen
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 text-slate-950 shadow-emerald-950/80 ring-2 ring-emerald-300/80 animate-pulse'
                  : 'bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 shadow-sky-950/80 ring-2 ring-sky-300/80 animate-pulse'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}
          >
            {readCountdown > 0 ? (
              <>
                <Clock className="w-4 h-4 animate-spin text-amber-400" />
                <span>
                  {isVi
                    ? `Vui lòng đọc kỹ lưu ý (${readCountdown}s)...`
                    : `Please read notice carefully (${readCountdown}s)...`}
                </span>
              </>
            ) : !hasReadConfirmed ? (
              <>
                <Lock className="w-4 h-4 text-slate-400" />
                <span>
                  {isVi
                    ? 'Tích chọn ô xác nhận để mở khóa'
                    : 'Check confirmation box to unlock'}
                </span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-slate-950" />
                <span>
                  {isVi
                    ? 'ĐÃ ĐỌC & MỞ KHÓA TRÌNH DỊCH'
                    : 'I HAVE READ & UNLOCK TRANSLATOR'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
