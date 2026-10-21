import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Radio,
  ExternalLink,
  Languages,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CORRECT_PASSWORD = 'f4daxing666';
export const ACCESS_STORAGE_KEY = 'missevan_flight_access_unlocked';

interface AccessBarrierProps {
  onUnlock: () => void;
}

export const AccessBarrier: React.FC<AccessBarrierProps> = ({ onUnlock }) => {
  const { language, setLanguage } = useLanguage();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) return;

    setIsSubmitting(true);
    setError(false);

    // Validate password
    if (password.trim() === CORRECT_PASSWORD) {
      try {
        localStorage.setItem(ACCESS_STORAGE_KEY, 'true');
      } catch (err) {
        // ignore localStorage errors in incognito if restricted
      }
      setTimeout(() => {
        onUnlock();
      }, 300);
    } else {
      setTimeout(() => {
        setError(true);
        setShake(true);
        setIsSubmitting(false);
        setTimeout(() => setShake(false), 600);
      }, 250);
    }
  };

  return (
    <div className="min-h-screen bg-[#03060c] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden cockpit-grid selection:bg-sky-500 selection:text-white">
      {/* Background ambient avionics glow & radar rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-sky-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-sky-500/10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-sky-500/15 pointer-events-none" />

      {/* Top language selector */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[#081020]/90 border border-sky-500/20 px-2.5 py-1 rounded-full backdrop-blur-md shadow-lg">
        <Languages className="w-3.5 h-3.5 text-sky-400" />
        <button
          type="button"
          onClick={() => setLanguage('vi')}
          className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            language === 'vi' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          VI
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            language === 'en' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      {/* Main Glass Barrier Card */}
      <div
        className={`relative z-10 w-full max-w-[420px] bg-gradient-to-b from-[#0b1426]/95 to-[#050a14]/95 border-2 border-sky-500/35 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-sky-950/60 backdrop-blur-xl transition-transform duration-200 ${
          shake ? 'animate-wiggle' : ''
        }`}
        style={{
          boxShadow: '0 0 50px -10px rgba(56, 189, 248, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Decorative corner avionics notches */}
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-sky-400 rounded-tl-sm" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-sky-400 rounded-tr-sm" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-sky-400 rounded-bl-sm" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-sky-400 rounded-br-sm" />

        {/* Central Spinning Vinyl / Turbine Rotor */}
        <div className="flex flex-col items-center justify-center mb-5">
          <div className="relative group">
            {/* Outer cyan sound halo */}
            <div className="absolute -inset-2 bg-gradient-to-r from-sky-500/20 via-cyan-400/30 to-sky-500/20 rounded-full blur-md animate-pulse" />
            
            {/* Vinyl Record / Avionics Turbine Disc */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#050912] border-2 border-sky-400/40 p-1 flex items-center justify-center shadow-xl">
              {/* Concentric sound grooves */}
              <div className="w-full h-full rounded-full border border-sky-500/20 p-2 flex items-center justify-center animate-spin-turbine">
                <div className="w-full h-full rounded-full border border-sky-400/30 p-2 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0d1c33] via-[#040813] to-[#02050a]">
                  {/* Center Hub */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-sky-400 to-cyan-600 border border-white/60 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.8)]">
                    <div className="w-3.5 h-3.5 rounded-full bg-white shadow-inner" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="mt-4 text-xl sm:text-2xl font-extrabold text-white tracking-tight text-center font-heading drop-shadow-sm">
            MaoErFM/Manbo Extractor Studio
          </h1>
        </div>

        {/* Message Box with clickable Threads link */}
        <div className="mb-6 rounded-2xl border border-sky-400/40 bg-gradient-to-b from-sky-950/40 to-[#061224]/80 p-4 relative overflow-hidden backdrop-blur-sm shadow-inner shadow-sky-500/10">
          <div className="flex items-center gap-3">
            <div className="shrink-0 p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300">
              <Sparkles className="w-5 h-5 text-sky-400" />
            </div>
            <div className="text-xs sm:text-[13px] leading-relaxed text-slate-200">
              <span>Ai có nhu cầu ké tool thì ib tui trên threads nha </span>
              <a
                href="https://www.threads.com/@xttttttjt_"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-white bg-sky-500/20 px-2 py-0.5 rounded-lg border border-sky-400/40 hover:bg-sky-500/30 hover:border-sky-300 transition-colors ml-0.5"
              >
                <span className="underline underline-offset-2">@xttttttjt_</span>
                <ExternalLink className="w-3 h-3 text-sky-300" />
              </a>
            </div>
          </div>
        </div>

        {/* Password Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="barrier-password"
                className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-slate-300 flex items-center gap-1.5 uppercase"
              >
                <Radio className="w-3 h-3 text-sky-400" />
                <span>{language === 'vi' ? 'Mật khẩu truy cập' : 'Access Password'}</span>
              </label>
              {error && (
                <span className="text-[11px] font-mono text-rose-400 flex items-center gap-1 animate-pulse">
                  <ShieldAlert className="w-3 h-3" />
                  <span>{language === 'vi' ? 'Sai mật khẩu!' : 'Incorrect pass!'}</span>
                </span>
              )}
            </div>

            {/* Input pill */}
            <div
              className={`relative flex items-center rounded-2xl border-2 transition-all bg-[#040814]/90 ${
                error
                  ? 'border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                  : 'border-sky-500/60 focus-within:border-sky-300 focus-within:shadow-[0_0_20px_rgba(56,189,248,0.35)]'
              }`}
            >
              <div className="pl-4 pr-2 text-sky-400">
                <Lock className="w-4 h-4 text-sky-400" />
              </div>

              <input
                id="barrier-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                placeholder={language === 'vi' ? 'Nhập mật khẩu để mở khóa...' : 'Enter password to unlock...'}
                autoFocus
                autoComplete="off"
                className="w-full py-3.5 pr-11 bg-transparent text-white font-mono text-sm placeholder:text-slate-500 focus:outline-none"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1.5 text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Unlock Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !password.trim()}
            className="w-full group relative flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-heading font-bold text-slate-950 text-sm tracking-wide bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-300 hover:from-sky-300 hover:to-cyan-200 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:shadow-[0_0_25px_rgba(56,189,248,0.6)] active:scale-[0.99]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>{language === 'vi' ? 'Đang mở khóa...' : 'Unlocking...'}</span>
              </span>
            ) : (
              <>
                <span>{language === 'vi' ? 'Truy cập' : 'Unlock Access'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* Footer tagline */}
        <div className="mt-6 pt-4 border-t border-sky-500/15 flex items-center justify-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
          <span>Subtitle · Audio · Cover Art Extractor</span>
        </div>
      </div>
    </div>
  );
};
