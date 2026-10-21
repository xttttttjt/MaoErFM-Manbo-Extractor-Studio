import React, { useState, useEffect } from 'react';
import { KeyRound, X, AlertCircle, Loader2, ShieldCheck, Check } from 'lucide-react';
import {
  getSavedMissEvanCookie,
  saveMissEvanCookie,
  getSavedManboCookie,
  saveManboCookie,
} from '../utils/audioDownloader';
import { useLanguage } from '../context/LanguageContext';

interface CookieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCookieSaved: () => void;
  initialPlatform?: 'missevan' | 'kilamanbo';
  soundId?: string;
  isPaidEpisode?: boolean;
}

export const CookieModal: React.FC<CookieModalProps> = ({
  isOpen,
  onClose,
  onCookieSaved,
  initialPlatform = 'missevan',
  soundId,
  isPaidEpisode,
}) => {
  const { t, language } = useLanguage();
  const [platform, setPlatform] = useState<'missevan' | 'kilamanbo'>(initialPlatform);
  const [missEvanInput, setMissEvanInput] = useState('');
  const [manboInput, setManboInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPlatform(initialPlatform);
      setMissEvanInput(getSavedMissEvanCookie());
      setManboInput(getSavedManboCookie());
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, initialPlatform]);

  if (!isOpen) return null;

  const currentInput = platform === 'missevan' ? missEvanInput : manboInput;
  const setCurrentInput = (val: string) => {
    if (platform === 'missevan') setMissEvanInput(val);
    else setManboInput(val);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (platform === 'missevan') {
        const normalized = await saveMissEvanCookie(missEvanInput);
        setMissEvanInput(normalized);
      } else {
        const normalized = await saveManboCookie(manboInput);
        setManboInput(normalized);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onCookieSaved();
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu thông tin xác thực');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (platform === 'missevan') {
      setMissEvanInput('');
      await saveMissEvanCookie('');
    } else {
      setManboInput('');
      await saveManboCookie('');
    }
    onCookieSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#060c18] border border-[#162744] rounded-2xl p-6 shadow-2xl space-y-4 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#14233c] pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-sky-400" />
            <h2 className="font-heading text-lg font-bold text-white">
              {language === 'vi' ? 'Cài Đặt Cookie / Token VIP' : 'VIP Credentials & Cookie Clearance'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#0c1628] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Switcher inside Modal */}
        <div className="flex items-center p-1 bg-[#091120] border border-[#1d2d47] rounded-xl">
          <button
            type="button"
            onClick={() => {
              setPlatform('missevan');
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              platform === 'missevan'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-950/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            MissEvan (猫耳FM)
          </button>
          <button
            type="button"
            onClick={() => {
              setPlatform('kilamanbo');
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
              platform === 'kilamanbo'
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md shadow-rose-950/60'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            KilaManbo (漫播)
          </button>
        </div>

        {isPaidEpisode && platform === 'missevan' && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs leading-relaxed">
            <p className="font-semibold text-amber-300">
              {language === 'vi'
                ? `Tập VIP có phí trên MissEvan (Sound ID ${soundId}):`
                : `Classified VIP episode on MissEvan (Sound ID ${soundId}):`}
            </p>
            <p className="mt-1 text-slate-300">{t('vipLockedNotice')}</p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-sky-200 mb-1.5">
              {platform === 'missevan'
                ? language === 'vi'
                  ? 'Cookie hoặc Token tài khoản MissEvan (Đã mua tập kịch):'
                  : 'MissEvan Account Cookie or Token:'
                : language === 'vi'
                ? 'authToken hoặc Cookie tài khoản KilaManbo (Đã mua tập kịch):'
                : 'KilaManbo authToken or Cookie:'}
            </label>
            <textarea
              rows={4}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder={
                platform === 'missevan'
                  ? 'token=xxxxxx; or paste raw token string...'
                  : 'authToken=xxxxxx; or paste raw authToken from localStorage / Cookies...'
              }
              className="w-full bg-[#091224] border border-[#1a2f52] rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div className="bg-[#091224] border border-[#14233c] rounded-xl p-3 text-[11px] text-slate-300 space-y-1.5">
            <div className="font-semibold text-sky-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {language === 'vi'
                  ? `Hướng dẫn lấy Token cho ${platform === 'missevan' ? 'MissEvan' : 'KilaManbo'}:`
                  : `Guide to retrieve Token for ${platform === 'missevan' ? 'MissEvan' : 'KilaManbo'}:`}
              </span>
            </div>
            {platform === 'missevan' ? (
              <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-300 pt-1 leading-relaxed">
                {language === 'vi' ? (
                  <>
                    <li>
                      Đăng nhập tài khoản MaoEr và mở 1 tập kịch VIP bất kỳ của bộ kịch cần tải (lưu ý: tài khoản đã phải mua bộ kịch để tải được tập VIP về).
                    </li>
                    <li>
                      Bật cho tập kịch VIP chạy. Trong lúc đang chạy, bấm <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px] text-sky-300">F12</kbd> (hoặc <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Ctrl + Shift + I</kbd> trên Windows, <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Option + Command + I</kbd> trên macOS), sau đó reload lại trang web.
                    </li>
                    <li>
                      Ở thanh chọn tab của Dev Tool, chọn <strong>"Network"</strong>. Sau đó, ở list bên dưới, kéo hết lên cho đến khi thấy 1 dòng có format <code>player?id=xxxxxxxx</code>. Nó sẽ mở ra 1 trang bên phải, kéo xuống dưới tới khi có dòng <strong>"Cookies"</strong> (hoặc Cookie trong Request Headers) thì copy hết mã đó, dán vào Tool này.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      Log in to your MaoEr account and open any VIP episode of the drama you want to download (Note: your account must have purchased the drama to download VIP episodes).
                    </li>
                    <li>
                      Start playing the VIP episode. While it is playing, press <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px] text-sky-300">F12</kbd> (or <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Ctrl + Shift + I</kbd> on Windows, <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Option + Command + I</kbd> on macOS), then reload the webpage.
                    </li>
                    <li>
                      In the DevTools tab bar, select <strong>"Network"</strong>. In the request list below, scroll all the way to the top until you see a row formatted as <code>player?id=xxxxxxxx</code>. Click it to open the details panel on the right, scroll down to the <strong>"Cookies"</strong> section (or Request Headers Cookie), copy that entire string, and paste it into this Tool.
                    </li>
                  </>
                )}
              </ol>
            ) : (
              <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-300 pt-1 leading-relaxed">
                {language === 'vi' ? (
                  <>
                    <li className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span>Copy Console Script được cung cấp từ Tool:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `(() => { const t = localStorage.getItem("authToken"); const u = localStorage.getItem("userId"); const c = document.cookie; const parts = []; if (t) parts.push("authToken=" + t); if (u) parts.push("userId=" + u); if (c) parts.push(c); copy(parts.join("; ")); console.log("%c[Success] Copied KilaManbo credentials to clipboard!", "color: #10b981; font-weight: bold;"); })()`;
                            if (navigator?.clipboard?.writeText) {
                              navigator.clipboard.writeText(snippet);
                              setCopiedScript(true);
                              setTimeout(() => setCopiedScript(false), 2500);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono cursor-pointer transition-colors inline-flex items-center gap-1 shadow-sm"
                        >
                          {copiedScript ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-300" />
                              <span>✓ Đã sao chép!</span>
                            </>
                          ) : (
                            <span>📋 Copy Console Script</span>
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono bg-[#050a14] p-1.5 rounded border border-[#162744] break-all select-all">
                        copy(document.cookie)
                      </div>
                    </li>
                    <li>
                      Đăng nhập tài khoản Manbo và mở 1 tập kịch VIP bất kỳ của bộ kịch cần tải (lưu ý: tài khoản đã phải mua bộ kịch để tải được tập VIP về).
                    </li>
                    <li>
                      Bật cho tập kịch VIP chạy. Trong lúc đang chạy, bấm <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px] text-amber-300">F12</kbd> (hoặc <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Ctrl + Shift + I</kbd> trên Windows, <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Option + Command + I</kbd> trên macOS), sau đó reload lại trang web.
                    </li>
                    <li>
                      Ở thanh chọn tab của Dev Tool, chọn <strong>"Console"</strong>. Sau đó, paste Console Script mà Tool đã cho vào tab và ấn Enter. Nếu tab báo <em>"security warning"</em>, nhập thêm dòng <code className="text-amber-300 bg-[#050a14] px-1 py-0.2 rounded">allow pasting</code>, rồi ấn Enter.
                    </li>
                    <li>
                      Sau khi làm thành công, 1 mã authToken mới sẽ được copy sẵn vào clipboard. Quay về Tool và paste mã đó vào ô nhập trên Tool.
                    </li>
                  </>
                ) : (
                  <>
                    <li className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span>Copy the Console Script provided by the Tool:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `(() => { const t = localStorage.getItem("authToken"); const u = localStorage.getItem("userId"); const c = document.cookie; const parts = []; if (t) parts.push("authToken=" + t); if (u) parts.push("userId=" + u); if (c) parts.push(c); copy(parts.join("; ")); console.log("%c[Success] Copied KilaManbo credentials to clipboard!", "color: #10b981; font-weight: bold;"); })()`;
                            if (navigator?.clipboard?.writeText) {
                              navigator.clipboard.writeText(snippet);
                              setCopiedScript(true);
                              setTimeout(() => setCopiedScript(false), 2500);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono cursor-pointer transition-colors inline-flex items-center gap-1 shadow-sm"
                        >
                          {copiedScript ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-300" />
                              <span>✓ Copied!</span>
                            </>
                          ) : (
                            <span>📋 Copy Console Script</span>
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono bg-[#050a14] p-1.5 rounded border border-[#162744] break-all select-all">
                        copy(document.cookie)
                      </div>
                    </li>
                    <li>
                      Log in to your Manbo account and open any VIP episode of the drama you want to download (Note: your account must have purchased the drama to download VIP episodes).
                    </li>
                    <li>
                      Start playing the VIP episode. While it is playing, press <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px] text-amber-300">F12</kbd> (or <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Ctrl + Shift + I</kbd> on Windows, <kbd className="px-1.5 py-0.5 bg-[#060c18] rounded border border-slate-700 font-mono text-[10px]">Option + Command + I</kbd> on macOS), then reload the webpage.
                    </li>
                    <li>
                      In the DevTools tab bar, select <strong>"Console"</strong>. Paste the Console Script provided by the Tool into the console and press Enter. If a <em>"security warning"</em> appears, type <code className="text-amber-300 bg-[#050a14] px-1 py-0.2 rounded">allow pasting</code> first and press Enter, then paste and run the script again.
                    </li>
                    <li>
                      Once executed successfully, a new authToken credential will be automatically copied to your clipboard. Return to the Tool and paste it into the input box above.
                    </li>
                  </>
                )}
              </ol>
            )}
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              {language === 'vi' ? 'Xóa xác thực' : 'Clear Token'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0e1930] hover:bg-[#152545] text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 ${
                  platform === 'kilamanbo'
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white hover:from-rose-400 hover:to-amber-400'
                    : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('savingClearance')}</span>
                  </>
                ) : success ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Đã lưu!' : 'Saved!'}</span>
                  </>
                ) : (
                  <span>{t('saveClearance')}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
