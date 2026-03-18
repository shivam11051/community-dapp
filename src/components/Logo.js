export default function Logo({ size = 36 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Dark bg tile */}
        <rect width="40" height="40" rx="11" fill="url(#bg3)"/>
  
        {/* Outer hex */}
        <path d="M20 5L33 12.5V27.5L20 35L7 27.5V12.5L20 5Z"
          fill="none" stroke="url(#hex_stroke)" strokeWidth="0.8" opacity="0.5"/>
  
        {/* Inner hex glow fill */}
        <path d="M20 10L30 15.8V25.8L20 31.5L10 25.8V15.8L20 10Z"
          fill="url(#inner3)" opacity="0.15"/>
  
        {/* Center orb */}
        <circle cx="20" cy="20" r="4" fill="url(#orb3)"/>
  
        {/* Spoke lines */}
        <line x1="20" y1="5"    x2="20" y2="16"   stroke="url(#spoke_t)"  strokeWidth="1"   strokeLinecap="round" opacity="0.5"/>
        <line x1="20" y1="24"   x2="20" y2="35"   stroke="url(#spoke_b)"  strokeWidth="1"   strokeLinecap="round" opacity="0.5"/>
        <line x1="7"  y1="12.5" x2="16" y2="17.5" stroke="url(#spoke_tl)" strokeWidth="1"   strokeLinecap="round" opacity="0.5"/>
        <line x1="33" y1="12.5" x2="24" y2="17.5" stroke="url(#spoke_tr)" strokeWidth="1"   strokeLinecap="round" opacity="0.5"/>
        <line x1="7"  y1="27.5" x2="16" y2="22.5" stroke="url(#spoke_bl)" strokeWidth="1"   strokeLinecap="round" opacity="0.5"/>
        <line x1="33" y1="27.5" x2="24" y2="22.5" stroke="url(#spoke_br)" strokeWidth="1"   strokeLinecap="round" opacity="0.5"/>
  
        {/* Corner nodes */}
        <circle cx="20" cy="5"    r="2" fill="#A78BFA" opacity="0.9"/>
        <circle cx="33" cy="12.5" r="2" fill="#FFB347" opacity="0.9"/>
        <circle cx="33" cy="27.5" r="2" fill="#A78BFA" opacity="0.9"/>
        <circle cx="20" cy="35"   r="2" fill="#FFB347" opacity="0.9"/>
        <circle cx="7"  cy="27.5" r="2" fill="#A78BFA" opacity="0.9"/>
        <circle cx="7"  cy="12.5" r="2" fill="#FFB347" opacity="0.9"/>
  
        <defs>
          <linearGradient id="bg3" x1="0" y1="0" x2="40" y2="40">
            <stop stopColor="#1A0A3E"/>
            <stop offset="1" stopColor="#0D0618"/>
          </linearGradient>
          <linearGradient id="hex_stroke" x1="7" y1="5" x2="33" y2="35">
            <stop stopColor="#A78BFA"/>
            <stop offset="1" stopColor="#FFB347"/>
          </linearGradient>
          <linearGradient id="inner3" x1="10" y1="10" x2="30" y2="31">
            <stop stopColor="#A78BFA"/>
            <stop offset="1" stopColor="#7C3AED"/>
          </linearGradient>
          <linearGradient id="orb3" x1="16" y1="16" x2="24" y2="24">
            <stop stopColor="#A78BFA"/>
            <stop offset="1" stopColor="#7C3AED"/>
          </linearGradient>
          <linearGradient id="spoke_t"  x1="20" y1="5"    x2="20" y2="16">   <stop stopColor="#A78BFA"/><stop offset="1" stopColor="#A78BFA" stopOpacity="0"/> </linearGradient>
          <linearGradient id="spoke_b"  x1="20" y1="24"   x2="20" y2="35">   <stop stopColor="#A78BFA" stopOpacity="0"/><stop offset="1" stopColor="#FFB347"/> </linearGradient>
          <linearGradient id="spoke_tl" x1="7"  y1="12.5" x2="16" y2="17.5"> <stop stopColor="#FFB347"/><stop offset="1" stopColor="#FFB347" stopOpacity="0"/> </linearGradient>
          <linearGradient id="spoke_tr" x1="33" y1="12.5" x2="24" y2="17.5"> <stop stopColor="#FFB347"/><stop offset="1" stopColor="#FFB347" stopOpacity="0"/> </linearGradient>
          <linearGradient id="spoke_bl" x1="7"  y1="27.5" x2="16" y2="22.5"> <stop stopColor="#A78BFA" stopOpacity="0"/><stop offset="1" stopColor="#A78BFA"/> </linearGradient>
          <linearGradient id="spoke_br" x1="33" y1="27.5" x2="24" y2="22.5"> <stop stopColor="#A78BFA" stopOpacity="0"/><stop offset="1" stopColor="#A78BFA"/> </linearGradient>
        </defs>
      </svg>
    );
  }