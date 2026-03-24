/**
 * LandingPage.js — 3D Animated Hero with floating particle canvas,
 * word-reveal h1, gradient shimmer, and mouse-tracked card tilt.
 */
import { useEffect, useRef, useCallback } from "react";

const FEATURES = [
  { icon: "⬡", title: "Multi-Group",    desc: "Create or join groups with custom EMI, size & tenure — public or invite-only" },
  { icon: "🗳️", title: "Vote to Borrow", desc: "Members vote democratically for who receives the loan" },
  { icon: "🚨", title: "Emergency Fund", desc: "Need urgent money? Request it — group votes yes or no" },
  { icon: "⭐", title: "Credit Score",   desc: "On-time payments build your on-chain credit reputation" },
  { icon: "📊", title: "Profit Share",   desc: "Interest earned is split proportionally among members" },
  { icon: "🔒", title: "Trustless",      desc: "Smart contracts enforce every rule — no middlemen" },
];

// ─── Particle Canvas ────────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Create floating particles
    const COUNT = 60;
    const particles = Array.from({ length: COUNT }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      r:   Math.random() * 1.8 + 0.4,
      dx:  (Math.random() - 0.5) * 0.35,
      dy:  (Math.random() - 0.5) * 0.35,
      o:   Math.random() * 0.4 + 0.1,
      hue: Math.random() > 0.5 ? 260 : 35, // purple or amber
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 82%, 72%, ${p.o})`;
        ctx.fill();
        // Move
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });
      // Draw connecting lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 90) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(167,139,250,${0.06 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="landing-particles"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// ─── 3D Tilt Card ───────────────────────────────────────────────────
function TiltCard({ icon, title, desc }) {
  const cardRef = useRef(null);

  const onMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -10;
    const rotateY = ((x - cx) / cx) *  10;
    card.style.transform =
      `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
  }, []);

  const onMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
    card.style.transition = "transform 0.5s cubic-bezier(.16,1,.3,1)";
  }, []);

  const onMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "transform 0.1s linear, box-shadow 0.3s";
  }, []);

  return (
    <div
      ref={cardRef}
      className="feature-card"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

// ─── Main LandingPage Component ──────────────────────────────────────
export default function LandingPage({ contextLoading, initializeWeb3, CONTRACT_ADDRESS }) {
  return (
    <div className="landing">
      {/* Floating particle canvas */}
      <Particles />

      {/* Hero content */}
      <div className="landing-hero">
        <div className="hero-tag">Powered by Ethereum · Sepolia Testnet</div>

        <h1>
          <span className="word word-1">Community&nbsp;</span>
          <span className="word word-2">lending,</span>
          <br />
          <span className="grad">
            <span className="word word-3">reimagined&nbsp;</span>
            <span className="word word-4">on-chain.</span>
          </span>
        </h1>

        <p>
          Create trusted circles, vote for borrowers, earn profit together
          — every rule enforced by smart contracts, zero middlemen.
        </p>

        <div className="hero-btns">
          <button
            className="btn-primary btn-lg"
            disabled={contextLoading}
            onClick={initializeWeb3}
            style={{ position: "relative", overflow: "hidden" }}
          >
            {/* Shimmer sweep */}
            <span style={{
              position: "absolute", inset: 0, borderRadius: "inherit",
              background: "linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.18) 50%,transparent 60%)",
              backgroundSize: "200% 100%",
              animation: "btnShimmer 2.4s linear infinite",
            }} />
            <span style={{ position: "relative" }}>
              {contextLoading ? "Connecting..." : "Connect MetaMask"}
            </span>
          </button>
          <button
            className="btn-ghost btn-lg"
            onClick={() =>
              window.open(
                `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`,
                "_blank"
              )
            }
          >
            View Contract ↗
          </button>
        </div>
      </div>

      {/* 3D Feature cards */}
      <div className="landing-features">
        {FEATURES.map((f, i) => (
          <TiltCard key={i} icon={f.icon} title={f.title} desc={f.desc} />
        ))}
      </div>

      {/* Keyframe for button shimmer — injected inline */}
      <style>{`
        @keyframes btnShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>
    </div>
  );
}
