// mygf/src/components/home/BackgroundWaves.tsx
import React from "react";

/** Recreates CadetBlue base, blurred blobs, and 3 drifting wave layers */
export default function BackgroundWaves() {
  return (
    <div className="absolute inset-0 -z-10">
      {/* CadetBlue base */}
      <div className="absolute inset-0 bg-[--cadet]">
        {/* subtle animated blobs */}
        <div
          className="absolute h-72 w-72 rounded-full bg-white/10 blur-3xl left-[-40px] top-10"
          style={{ animation: "floaty 8s ease-in-out infinite" }}
        />
        <div
          className="absolute h-96 w-96 rounded-full bg-black/10 blur-3xl right-[-60px] top-28"
          style={{ animation: "floaty 9s ease-in-out 1.2s infinite" }}
        />
      </div>

      {/* layered wavy SVGs */}
      <Wave layer={1} className="opacity-70" />
      <Wave layer={2} className="opacity-60" />
      <Wave layer={3} className="opacity-50" />

      {/* long soft vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

      {/* Local CSS vars + keyframes */}
      <style>{`
        :root { --cadet: #5F9EA0; } /* CadetBlue */
        @keyframes floaty { 0%,100% { transform: translateY(0px) } 50% { transform: translateY(-8px) } }
        @keyframes drift { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
      `}</style>
    </div>
  );
}

function Wave({ layer, className = "" }: { layer: 1 | 2 | 3; className?: string }) {
  const fill =
    layer === 1 ? "rgba(255,255,255,0.20)" : layer === 2 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const top = layer === 1 ? 0 : layer === 2 ? 40 : 80;
  const speed = layer === 1 ? 50 : layer === 2 ? 60 : 75;

  return (
    <div className={`absolute inset-x-0`} style={{ top }}>
      <div className="relative w-[200%]" style={{ animation: `drift ${speed}s linear infinite` }}>
        <svg viewBox="0 0 1440 320" className={`w-[200%] h-56 ${className}`} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path
            fill={fill}
            d="M0,96L60,128C120,160,240,224,360,224C480,224,600,160,720,149.3C840,139,960,181,1080,186.7C1200,192,1320,160,1380,144L1440,128L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z"
          />
        </svg>
      </div>
    </div>
  );
}
