import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/ParticleBackground";
import { TokenDashboard } from "@/components/home/TokenDashboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart3, ArrowRight, Shield } from "lucide-react";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="min-h-full">
      <section className="relative overflow-hidden min-h-[420px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F0F1A] via-[#1a0f3a]/60 to-[#0F0F1A]" />
        <div className="absolute inset-0 cyber-grid" />
        <ParticleBackground />

        <div className="absolute top-1/4 left-1/4 w-64 h-64 orb bg-primary/20" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 orb bg-purple-900/15" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 orb bg-violet-500/10" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 status-dot" />
              <span className="text-xs font-semibold text-yellow-300 tracking-widest uppercase">
                {t.home.liveBadge}
              </span>
            </div>

            <h1 className="font-orbitron text-4xl md:text-6xl font-black uppercase tracking-wider mb-4 leading-tight">
              <span className="gradient-text">ChainNova</span>
              <br />
              <span className="text-foreground neon-glow-text">AI ECOSYSTEM</span>
            </h1>

            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
              BSC-native AI agent token. Real-time on-chain analytics, dividend tracking, and transparent tokenomics — all in one dashboard.
            </p>

            <button
              onClick={() => {
                const el = document.getElementById("token-dashboard");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm text-yellow-300/90 hover:text-yellow-200 border border-yellow-500/25 hover:border-yellow-400/40 rounded bg-yellow-500/5 hover:bg-yellow-500/10 transition-all tracking-wide uppercase font-semibold"
              data-testid="button-hero-dashboard"
            >
              <BarChart3 className="w-4 h-4" />
              {t.home.viewDashboard}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
              {["MetaMask", "BSC Mainnet", "Flap Portal", "GMGN"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary/60" />
                  <span className="text-xs text-muted-foreground/80 tracking-wide uppercase">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </section>

      <TokenDashboard />
    </div>
  );
}
