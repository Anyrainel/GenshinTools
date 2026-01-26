import { useLanguage } from "@/contexts/LanguageContext";

import { cn, getAssetUrl } from "@/lib/utils";
import {
  ArrowRight,
  Award,
  Database,
  Filter,
  Sparkles,
  Sword,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageLayout } from "@/components/layout/PageLayout";

export default function Home() {
  const { t } = useLanguage();

  return (
    <PageLayout>
      <div className="flex-1 container mx-auto p-4 flex flex-col gap-8">
        {/* Hero Section - Genshin Style */}
        <div className="text-center space-y-1 pb-0">
          <div className="relative flex flex-col items-center justify-center pt-6">
            {/* Arch Graphic Background - Flatter and physically broken by the star */}
            <div className="absolute top-6 w-80 h-10 opacity-80 pointer-events-none select-none z-0">
              <svg
                viewBox="0 0 200 40"
                className="w-full h-full drop-shadow-[0_0_5px_rgba(255,215,0,0.2)]"
              >
                <defs>
                  <linearGradient
                    id="goldGradientArch"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="hsl(45, 70%, 85%, 0)" />
                    <stop offset="100%" stopColor="hsl(45, 70%, 85%)" />
                  </linearGradient>
                  <linearGradient
                    id="goldGradientArchRev"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="hsl(45, 70%, 85%)" />
                    <stop offset="100%" stopColor="hsl(45, 70%, 85%, 0)" />
                  </linearGradient>
                </defs>
                {/* Left Wing - Rising continuously with a wider gap */}
                <path
                  d="M10,38 Q50,20 75,18"
                  fill="none"
                  stroke="url(#goldGradientArch)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Right Wing - Falling continuously with a wider gap */}
                <path
                  d="M125,18 Q150,20 190,38"
                  fill="none"
                  stroke="url(#goldGradientArchRev)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />{" "}
              </svg>
            </div>
            {/* Crown/Star Icon */}
            <div className="mb-[-14px] -translate-y-2 z-10 drop-shadow-[0_0_10px_rgba(255,220,100,0.3)]">
              {" "}
              <svg
                width="48"
                height="48"
                viewBox="0 0 100 100"
                className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
              >
                <defs>
                  <linearGradient
                    id="goldGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="hsl(45 70% 85%)" />
                    <stop offset="100%" stopColor="hsl(35 70% 75%)" />
                  </linearGradient>
                </defs>
                {/* 4-Pointed Star Shape */}
                <path
                  d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z"
                  fill="url(#goldGradient)"
                />
              </svg>
            </div>

            {/* Main Title */}
            <h1
              className="text-4xl md:text-6xl font-serif font-bold tracking-wide drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] relative z-0 text-transparent bg-clip-text pb-1"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom right, hsl(45 70% 85%), hsl(35 70% 75%))",
              }}
            >
              {t.ui("app.title")}
            </h1>
          </div>{" "}
          <p className="text-xl text-foreground/70 font-light max-w-2xl mx-auto">
            {t.ui("app.heroDescription")}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pb-4">
          <FeatureCard
            icon={<Database className="w-6 h-6" />}
            decorIcon={<Sparkles className="w-16 h-16" />}
            title={t.ui("app.navAccountData")}
            problem={t.ui("app.accountDataProblem")}
            guideline={t.ui("app.accountDataGuideline")}
            link="/account-data"
            bgImage="assets/home/account_bg.png"
            bgPosition="center 13%"
            accentColor="from-amber-500/20 to-orange-500/10"
            exploreText={t.ui("app.explore")}
          />

          <FeatureCard
            icon={<Filter className="w-6 h-6" />}
            decorIcon={<Target className="w-16 h-16" />}
            title={t.ui("app.navArtifactFilter")}
            problem={t.ui("app.artifactFilterProblem")}
            guideline={t.ui("app.artifactFilterGuideline")}
            link="/artifact-filter"
            bgImage="assets/home/artifact_bg.jpeg"
            bgPosition="center 50%"
            accentColor="from-purple-500/20 to-indigo-500/10"
            exploreText={t.ui("app.explore")}
          />

          <FeatureCard
            icon={<Award className="w-6 h-6" />}
            decorIcon={<Award className="w-16 h-16" />}
            title={t.ui("app.navTierList")}
            problem={t.ui("app.tierListProblem")}
            guideline={t.ui("app.tierListGuideline")}
            link="/tier-list"
            bgImage="assets/home/tierlist_bg.jpeg"
            bgPosition="center 55%"
            accentColor="from-emerald-500/20 to-teal-500/10"
            exploreText={t.ui("app.explore")}
          />

          <FeatureCard
            icon={<Sword className="w-6 h-6" />}
            decorIcon={<Sword className="w-16 h-16" />}
            title={t.ui("app.navWeaponBrowser")}
            problem={t.ui("app.weaponBrowserProblem")}
            guideline={t.ui("app.weaponBrowserGuideline")}
            link="/weapon-browser"
            bgImage="assets/home/team_bg.jpg"
            bgPosition="center 40%"
            accentColor="from-rose-500/20 to-pink-500/10"
            exploreText={t.ui("app.explore")}
          />

          {/* TODO: Re-enable when Team Builder is more polished
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            decorIcon={<Users className="w-16 h-16" />}
            title={t.ui("app.navTeamBuilder")}
            problem={t.ui("app.teamBuilderProblem")}
            guideline={t.ui("app.teamBuilderGuideline")}
            link="/team-builder"
            bgImage="assets/home/weapon_bg.png"
            bgPosition="center 50%"
            accentColor="from-cyan-500/20 to-blue-500/10"
            exploreText={t.ui("app.explore")}
          />
          */}
        </div>
      </div>
    </PageLayout>
  );
}

/**
 * Immersive feature card with rich visual hierarchy.
 * Shows tool name prominently, value proposition as hook, and guideline as preview.
 */
const FeatureCard = ({
  icon,
  decorIcon,
  title,
  problem,
  guideline,
  link,
  bgImage,
  bgPosition = "center center",
  accentColor,
  className,
  exploreText,
}: {
  icon: React.ReactNode;
  decorIcon: React.ReactNode;
  title: string;
  problem: string;
  guideline: string;
  link: string;
  bgImage: string;
  bgPosition?: string;
  accentColor: string;
  className?: string;
  exploreText: string;
}) => {
  // Strip markdown links from guideline for display (e.g., "[text](url)" -> "text")
  const cleanGuideline = guideline.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  return (
    <Link
      to={link}
      className={cn(
        "group relative flex flex-col justify-between min-h-[180px] md:min-h-[200px] rounded-2xl overflow-hidden transition-all duration-300 border border-border/30 hover:border-primary/50 shadow-md hover:shadow-xl hover:shadow-primary/5 bg-card/30",
        className
      )}
    >
      {/* Background Image with Animated Overlay */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover transition-transform duration-500 group-hover:scale-105"
          style={{
            backgroundImage: `url('${getAssetUrl(bgImage)}')`,
            backgroundPosition: bgPosition,
          }}
        />
        {/* Multi-layer gradient for depth and readability */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-80",
            accentColor
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/55 transition-opacity duration-300 group-hover:from-black/85 group-hover:via-black/55 group-hover:to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
      </div>

      {/* Decorative Icon - Large, faded in background */}
      <div className="absolute top-4 right-4 text-white/10 group-hover:text-white/20 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
        {decorIcon}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-5 gap-3">
        {/* Header: Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary backdrop-blur-sm border border-primary/30 shadow-lg shadow-primary/10">
            {icon}
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white/90 tracking-wide transition-all group-hover:text-primary group-hover:[text-shadow:_0_0_8px_rgb(0_0_0),_0_0_16px_rgb(0_0_0),_0_2px_4px_rgb(0_0_0)]">
            {title}
          </h3>
        </div>

        {/* Problem Statement - The Hook */}
        <h2 className="text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-md">
          {problem}
        </h2>

        {/* Guideline Preview - Truncated */}
        <p className="text-sm text-white/60 line-clamp-2 leading-relaxed flex-1">
          {cleanGuideline}
        </p>

        {/* CTA Bar */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
          <span className="text-xs text-white/40 uppercase tracking-wider font-medium">
            {title}
          </span>
          <div className="flex items-center gap-2 text-primary group-hover:gap-3 transition-all duration-300">
            <span className="text-sm font-medium hidden sm:inline">
              {exploreText}
            </span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
};
