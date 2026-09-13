import React from "react";

export function HeroSkyAtmosphere() {
  return (
    <div
      className="absolute inset-0 pointer-events-none select-none overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes cloudFloatLeft {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-7px) scale(1.015); }
        }
        @keyframes cloudFloatRight {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-9px) scale(1.012); }
        }
        @keyframes sunGlowPulse {
          0%, 100% { opacity: 0.92; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -6px) scale(1.03); }
        }
      `}</style>

      {/* ── Base Atmospheric Sky Gradient (Matching Reference Soft Sky Blue) ── */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          background: `
            linear-gradient(
              180deg,
              #8cb6e2 0%,
              #9ec3ea 14%,
              #b4d5f4 30%,
              #cce3fa 50%,
              #dfeffd 70%,
              #f8ebe0 88%,
              #ffffff 100%
            )
          `,
        }}
      />

      {/* ── Ambient Central Sunlight Bloom (Soft Radiant Glow Behind Nav & Headline) ── */}
      <div
        className="absolute top-0 left-1/2 w-[140vw] max-w-[1600px] h-[640px] pointer-events-none"
        style={{
          animation: "sunGlowPulse 16s ease-in-out infinite",
          background: `
            radial-gradient(
              ellipse 80% 65% at 50% 18%,
              rgba(255, 255, 255, 0.96) 0%,
              rgba(255, 255, 255, 0.78) 26%,
              rgba(224, 241, 255, 0.45) 52%,
              rgba(180, 215, 248, 0.12) 76%,
              transparent 100%
            )
          `,
        }}
      />

      {/* ── Warm Horizon Apricot/Peach Ambient Glow at Base ── */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[450px] opacity-85 pointer-events-none"
        style={{
          background: `
            radial-gradient(
              ellipse 90% 55% at 50% 92%,
              rgba(250, 226, 206, 0.75) 0%,
              rgba(248, 235, 224, 0.45) 45%,
              rgba(238, 246, 255, 0.15) 80%,
              transparent 100%
            )
          `,
        }}
      />

      {/* ── SVG Atmospheric Cumulus Clouds ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 1000"
      >
        <defs>
          {/* Deep blur for diffuse cloud shadows */}
          <filter id="cloud-deep" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="36" />
          </filter>

          {/* Medium blur for volumetric billows */}
          <filter id="cloud-mid" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" />
          </filter>

          {/* Soft blur for top sunlit highlights */}
          <filter id="cloud-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>

          {/* Subtle wisp blur */}
          <filter id="cloud-wisp" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="24" />
          </filter>

          {/* Left Cloud Gradient (Sun on top-right, soft sky shadow on lower-left) */}
          <linearGradient id="cloud-grad-left" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="45%" stopColor="#f4f9ff" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#bdd9f5" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#96bfeb" stopOpacity="0.25" />
          </linearGradient>

          {/* Right Cloud Gradient */}
          <linearGradient id="cloud-grad-right" x1="85%" y1="10%" x2="15%" y2="90%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="48%" stopColor="#f5faff" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#c2ddf7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#a0c5ee" stopOpacity="0.2" />
          </linearGradient>

          {/* Radial Highlight for Sunlit Cloud Tops */}
          <radialGradient id="cloud-sun-highlight" cx="42%" cy="32%" r="58%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="55%" stopColor="#f9fcff" stopOpacity="0.92" />
            <stop offset="85%" stopColor="#d4e8fc" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#b5d6f6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── LEFT CLOUD BANK (Fluffy Cumulus Clouds, Flanking Left) ── */}
        <g style={{ animation: "cloudFloatLeft 22s ease-in-out infinite" }}>
          {/* Ambient Base Shadow & Ambient Glow */}
          <g filter="url(#cloud-deep)">
            <ellipse cx="60" cy="380" rx="240" ry="150" fill="#a0c6ef" opacity="0.65" />
            <ellipse cx="160" cy="330" rx="200" ry="130" fill="#b6d7f6" opacity="0.6" />
            <ellipse cx="-20" cy="460" rx="220" ry="160" fill="#95bfea" opacity="0.55" />
            <ellipse cx="260" cy="370" rx="140" ry="100" fill="#bedaf7" opacity="0.45" />
          </g>

          {/* Volumetric Mid-Level Cumulus Billows */}
          <g filter="url(#cloud-mid)">
            {/* Lower lobes */}
            <circle cx="50" cy="420" r="150" fill="url(#cloud-grad-left)" />
            <circle cx="170" cy="380" r="130" fill="url(#cloud-grad-left)" />
            <circle cx="260" cy="350" r="105" fill="url(#cloud-grad-left)" />
            <circle cx="320" cy="390" r="85" fill="url(#cloud-grad-left)" />

            {/* Upper fluffy puffs */}
            <circle cx="100" cy="290" r="125" fill="url(#cloud-sun-highlight)" />
            <circle cx="190" cy="260" r="110" fill="url(#cloud-sun-highlight)" />
            <circle cx="35" cy="230" r="105" fill="url(#cloud-sun-highlight)" />
            <circle cx="-50" cy="320" r="160" fill="url(#cloud-sun-highlight)" />
          </g>

          {/* Bright Sunlit Crown Highlights */}
          <g filter="url(#cloud-soft)">
            <ellipse cx="185" cy="250" rx="80" ry="52" fill="#ffffff" opacity="0.95" />
            <ellipse cx="110" cy="275" rx="85" ry="58" fill="#ffffff" opacity="0.9" />
            <ellipse cx="250" cy="330" rx="65" ry="42" fill="#ffffff" opacity="0.85" />
            <ellipse cx="305" cy="380" rx="48" ry="32" fill="#ffffff" opacity="0.75" />
            <ellipse cx="35" cy="225" rx="75" ry="48" fill="#ffffff" opacity="0.92" />
          </g>

          {/* Soft Ethereal Wisps Extending into Center */}
          <g filter="url(#cloud-wisp)">
            <ellipse cx="380" cy="380" rx="90" ry="40" fill="#ffffff" opacity="0.6" />
            <ellipse cx="280" cy="290" rx="70" ry="35" fill="#ffffff" opacity="0.55" />
          </g>
        </g>

        {/* ── RIGHT CLOUD BANK (Fluffy Cumulus Clouds, Flanking Right) ── */}
        <g style={{ animation: "cloudFloatRight 26s ease-in-out infinite" }}>
          {/* Ambient Base Shadow & Ambient Glow */}
          <g filter="url(#cloud-deep)">
            <ellipse cx="1540" cy="390" rx="250" ry="155" fill="#a0c6ef" opacity="0.65" />
            <ellipse cx="1440" cy="330" rx="210" ry="130" fill="#b6d7f6" opacity="0.6" />
            <ellipse cx="1620" cy="460" rx="230" ry="160" fill="#95bfea" opacity="0.55" />
            <ellipse cx="1340" cy="370" rx="150" ry="100" fill="#bedaf7" opacity="0.45" />
          </g>

          {/* Volumetric Mid-Level Cumulus Billows */}
          <g filter="url(#cloud-mid)">
            {/* Base lobes */}
            <circle cx="1550" cy="420" r="150" fill="url(#cloud-grad-right)" />
            <circle cx="1430" cy="380" r="130" fill="url(#cloud-grad-right)" />
            <circle cx="1340" cy="350" r="105" fill="url(#cloud-grad-right)" />
            <circle cx="1270" cy="385" r="85" fill="url(#cloud-grad-right)" />

            {/* Upper fluffy puffs */}
            <circle cx="1500" cy="285" r="120" fill="url(#cloud-sun-highlight)" />
            <circle cx="1410" cy="260" r="105" fill="url(#cloud-sun-highlight)" />
            <circle cx="1570" cy="230" r="110" fill="url(#cloud-sun-highlight)" />
            <circle cx="1650" cy="320" r="150" fill="url(#cloud-sun-highlight)" />
          </g>

          {/* Bright Sunlit Crown Highlights */}
          <g filter="url(#cloud-soft)">
            <ellipse cx="1415" cy="250" rx="75" ry="50" fill="#ffffff" opacity="0.95" />
            <ellipse cx="1490" cy="275" rx="85" ry="58" fill="#ffffff" opacity="0.9" />
            <ellipse cx="1350" cy="330" rx="65" ry="42" fill="#ffffff" opacity="0.85" />
            <ellipse cx="1285" cy="380" rx="48" ry="32" fill="#ffffff" opacity="0.75" />
            <ellipse cx="1565" cy="225" rx="75" ry="48" fill="#ffffff" opacity="0.92" />
          </g>

          {/* Soft Ethereal Wisps Extending into Center */}
          <g filter="url(#cloud-wisp)">
            <ellipse cx="1210" cy="380" rx="90" ry="40" fill="#ffffff" opacity="0.6" />
            <ellipse cx="1310" cy="290" rx="70" ry="35" fill="#ffffff" opacity="0.55" />
          </g>
        </g>

        {/* ── HORIZON CLOUD BED & WARM MIST (Grounding the Dashboard Card) ── */}
        <g>
          {/* Warm Apricot-Peach Horizon Fog Base */}
          <g filter="url(#cloud-deep)">
            <ellipse cx="800" cy="940" rx="850" ry="170" fill="#fdeee2" opacity="0.85" />
            <ellipse cx="320" cy="920" rx="400" ry="130" fill="#fae0cf" opacity="0.65" />
            <ellipse cx="1280" cy="920" rx="400" ry="130" fill="#fae0cf" opacity="0.65" />
          </g>

          {/* Soft Billowy Low Cloud Cushions */}
          <g filter="url(#cloud-mid)">
            <ellipse cx="200" cy="880" rx="300" ry="100" fill="#ffffff" opacity="0.92" />
            <ellipse cx="480" cy="900" rx="320" ry="105" fill="#ffffff" opacity="0.88" />
            <ellipse cx="800" cy="915" rx="380" ry="95" fill="#ffffff" opacity="0.96" />
            <ellipse cx="1120" cy="900" rx="320" ry="105" fill="#ffffff" opacity="0.88" />
            <ellipse cx="1400" cy="880" rx="300" ry="100" fill="#ffffff" opacity="0.92" />
          </g>
        </g>
      </svg>

      {/* ── Floating Atmospheric Blur Wisps (Left & Right Mid-Sky) ── */}
      <div
        className="absolute top-[22%] -left-16 w-[420px] h-[220px] rounded-full opacity-65 filter blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.92) 0%, rgba(220,238,255,0.45) 60%, transparent 100%)",
        }}
      />
      <div
        className="absolute top-[20%] -right-16 w-[420px] h-[220px] rounded-full opacity-65 filter blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.92) 0%, rgba(220,238,255,0.45) 60%, transparent 100%)",
        }}
      />

      {/* ── Soft Grounding Mist Layer at Base (Blending Seamlessly into White Content Below) ── */}
      <div
        className="absolute bottom-0 inset-x-0 h-44 sm:h-56 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
