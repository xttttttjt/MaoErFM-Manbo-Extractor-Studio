import React from 'react';
import { Plane, Play, Pause, Gauge, Sparkles } from 'lucide-react';

interface MilitaryRadarDiscProps {
  coverUrl?: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  title?: string;
  className?: string;
}

export const MilitaryRadarDisc: React.FC<MilitaryRadarDiscProps> = ({
  coverUrl,
  isPlaying = false,
  onTogglePlay,
  title,
  className = '',
}) => {
  // Default tactical avatar if no cover provided
  const displayCover =
    coverUrl ||
    'https://static.missevan.com/coversmini/202008/17/99d3e5eb5121bcde219a18032ec48464161746.jpg';

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Outer Tactical Radar Instrument Chassis */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-[#030e07]/95 border-2 border-emerald-500/40 p-3 shadow-2xl shadow-emerald-950/80 backdrop-blur-md overflow-hidden flex items-center justify-center">
        {/* Subtle internal military grid */}
        <div className="absolute inset-0 military-grid opacity-40 pointer-events-none" />

        {/* Aircraft Icon at Top-Left (exactly like image) */}
        <div className="absolute top-4 left-4 z-20 text-emerald-400/80">
          <Plane className="w-4 h-4 rotate-[-45deg]" />
        </div>

        {/* Tactical Crosshairs */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Vertical axis line */}
          <div className="w-[1px] h-full bg-emerald-500/20" />
          {/* Horizontal axis line */}
          <div className="h-[1px] w-full bg-emerald-500/20 absolute" />
        </div>

        {/* Radar Range Rings */}
        <div className="absolute w-[86%] h-[86%] rounded-full border border-emerald-500/30 pointer-events-none" />
        <div className="absolute w-[68%] h-[68%] rounded-full border border-emerald-500/20 pointer-events-none" />
        <div className="absolute w-[50%] h-[50%] rounded-full border border-emerald-500/15 pointer-events-none" />

        {/* Radar Sweep Effect (smooth rotation) */}
        <div
          className={`absolute w-[86%] h-[86%] rounded-full pointer-events-none military-radar-sweep ${
            isPlaying ? 'animate-spin-turbine-fast' : 'animate-spin-turbine'
          }`}
        />

        {/* Tactical Compass Degrees (exact placements from image) */}
        {/* 360° at 12 o'clock */}
        <span className="absolute top-3 text-[11px] font-mono font-bold text-sky-400 tracking-wider z-20 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
          360°
        </span>
        {/* 090° at 3 o'clock */}
        <span className="absolute right-3 text-[11px] font-mono font-bold text-sky-400 tracking-wider z-20 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
          090°
        </span>
        {/* 180° at 6 o'clock */}
        <span className="absolute bottom-3 text-[11px] font-mono font-bold text-sky-400 tracking-wider z-20 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
          180°
        </span>
        {/* 270° at 9 o'clock */}
        <span className="absolute left-3 text-[11px] font-mono font-bold text-sky-400 tracking-wider z-20 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
          270°
        </span>

        {/* Center Spinning Radar Disc / Disc Hub */}
        <div
          onClick={onTogglePlay}
          className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-sky-400 p-0.5 cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.5)] group transition-transform active:scale-95"
          title={title || 'Radar Tactical Audio Disc'}
        >
          {/* Beacon Star Indicator at 9 o'clock */}
          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.9)] animate-pulse" />
          </div>

          {/* Rotating Artwork Disc */}
          <div
            className={`w-full h-full rounded-full overflow-hidden bg-black flex items-center justify-center relative shadow-inner ${
              isPlaying ? 'animate-spin-turbine-fast' : 'animate-spin-turbine'
            }`}
          >
            <img
              src={displayCover}
              alt={title || 'Radar audio cover'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />

            {/* Center disc aperture hole with cyan glow */}
            <div className="absolute inset-0 m-auto w-5 h-5 rounded-full bg-[#020b06] border border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#fff]" />
            </div>

            {/* Hover overlay with play/pause */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-emerald-300" />
              ) : (
                <Play className="w-6 h-6 text-emerald-300 ml-0.5" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* "Resume playback" Tactical Pill Button */}
      {onTogglePlay && (
        <button
          type="button"
          onClick={onTogglePlay}
          className="mt-3.5 px-5 py-2 rounded-full bg-[#031509] hover:bg-[#072412] border border-emerald-500/40 hover:border-emerald-400/80 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer group active:scale-95"
        >
          <Gauge className="w-4 h-4 text-emerald-400 group-hover:rotate-45 transition-transform" />
          <span>{isPlaying ? 'Pause playback' : 'Resume playback'}</span>
        </button>
      )}
    </div>
  );
};
