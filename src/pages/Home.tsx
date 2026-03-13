import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

import { cn, getAssetUrl } from "@/lib/utils";
import {
  ArrowRight,
  Award,
  Database,
  Filter,
  Sparkles,
  Sword,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { WhatsNew } from "@/components/shared/WhatsNew";

export default function Home() {
  const { t } = useLanguage();

  return (
    <PageLayout>
      <ScrollLayout className="mx-auto px-8 py-4 flex flex-col gap-6 overflow-x-hidden">
        {/* Hero Section */}
        <div className="text-center space-y-1 pb-0">
          <div className="relative flex flex-col items-center justify-center pt-6">
            {/* Arch Graphic Background */}
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
                <path
                  d="M10,38 Q50,20 75,18"
                  fill="none"
                  stroke="url(#goldGradientArch)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M125,18 Q150,20 190,38"
                  fill="none"
                  stroke="url(#goldGradientArchRev)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />{" "}
              </svg>
            </div>
            {/* Star Icon */}
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

        {/* Cards area — WhatsNew wraps cards to provide the pacman traversal boundary */}
        <WhatsNew>
          {/* Featured Card — full width */}
          <FeatureCard
            icon={<Database className="w-6 h-6" />}
            title={t.ui("app.navAccountData")}
            problem={t.ui("app.accountDataProblem")}
            guideline={t.ui("app.accountDataGuideline")}
            link="/account-data"
            bgImage="assets/home/account_bg.png"
            bgPosition="center 12%"
            ctaText={t.ui("app.ctaScoreArtifacts")}
            featured
            index={0}
          />

          {/* Core Tools — 2×2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <FeatureCard
              icon={<Filter className="w-6 h-6" />}
              title={t.ui("app.navArtifactFilter")}
              problem={t.ui("app.artifactFilterProblem")}
              guideline={t.ui("app.artifactFilterGuideline")}
              link="/artifact-filter"
              bgImage="assets/home/columbina.png"
              bgPosition="center 50%"
              ctaText={t.ui("app.ctaConfigureFilters")}
              index={1}
            />

            <FeatureCard
              icon={<Award className="w-6 h-6" />}
              title={t.ui("app.navTierList")}
              problem={t.ui("app.tierListProblem")}
              guideline={t.ui("app.tierListGuideline")}
              link="/tier-list"
              bgImage="assets/home/traveler.png"
              bgPosition="center 25%"
              ctaText={t.ui("app.ctaRankCharacters")}
              index={2}
            />

            <FeatureCard
              icon={<Sword className="w-6 h-6" />}
              title={t.ui("app.navArchive")}
              problem={t.ui("app.archiveProblem")}
              guideline={t.ui("app.archiveGuideline")}
              link="/archive"
              bgImage="assets/home/escoffier.png"
              bgPosition="center 50%"
              ctaText={t.ui("app.ctaBrowseDetails")}
              index={3}
            />

            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title={t.ui("app.navTeamComp")}
              problem={t.ui("app.teamCompProblem")}
              guideline={t.ui("app.teamCompGuideline")}
              link="/team-comp"
              bgImage="assets/home/ineffa.png"
              bgPosition="center 48%"
              ctaText={t.ui("app.ctaCalculateDamage")}
              index={4}
            />
          </div>

          {/* Community Banner */}
          <FeatureCard
            icon={<Sparkles className="w-5 h-5" />}
            title={t.ui("app.navMoreToCome")}
            problem={t.ui("app.moreProblem")}
            guideline={t.ui("app.moreGuideline")}
            link="https://discord.gg/4RNAHYBaHa"
            bgImage="assets/home/mizuki.png"
            bgPosition="center 32%"
            ctaText={t.ui("app.ctaJoinCommunity")}
            external
            banner
            index={5}
          />
        </WhatsNew>

        {/* Footer */}
        <footer className="mt-auto pt-6 pb-2 border-t border-border/20 text-center space-y-1">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {t.ui("app.disclaimer")}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.ui("app.dataAttribution")}
          </p>
        </footer>
      </ScrollLayout>
    </PageLayout>
  );
}

/**
 * Feature card with right-aligned image reveal.
 *
 * The background image only occupies the right portion of the card.
 * The left side is solid card color for guaranteed text legibility.
 * A smooth gradient at the seam blends the image into the solid area.
 * All colors use theme-derived CSS variables — safe across all 8 themes.
 */
const FeatureCard = ({
  icon,
  title,
  problem,
  guideline,
  link,
  bgImage,
  bgPosition = "center center",
  ctaText,
  className,
  external,
  featured,
  banner,
  mirror,
  index = 0,
}: {
  icon: React.ReactNode;
  title: string;
  problem: string;
  guideline: string;
  link: string;
  bgImage: string;
  bgPosition?: string;
  ctaText: string;
  className?: string;
  external?: boolean;
  featured?: boolean;
  banner?: boolean;
  mirror?: boolean;
  index?: number;
}) => {
  const cleanGuideline = guideline.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const sharedClassName = cn(
    "group relative overflow-hidden rounded-2xl bg-card",
    "transition-all duration-300 border border-border/30 hover:border-primary/40",
    "shadow-md hover:shadow-xl hover:shadow-primary/5",
    "animate-card-enter",
    banner
      ? "min-h-0"
      : featured
        ? "flex flex-col justify-end min-h-[200px] md:min-h-[260px]"
        : "flex flex-col justify-end min-h-[180px] md:min-h-[200px]",
    className
  );

  const content = (
    <>
      {/* Background image — positioned to the right side only */}
      <div
        className={cn("absolute inset-y-0 right-0 z-0 overflow-hidden w-[65%]")}
      >
        <div
          className={cn(
            "absolute inset-0 bg-cover transition-transform ease-out",
            banner
              ? "duration-500 group-hover:scale-[1.02]"
              : mirror
                ? "duration-700 -scale-x-100 group-hover:[transform:scale(-1.05,1.05)]"
                : "duration-700 group-hover:scale-105"
          )}
          style={{
            backgroundImage: `url('${getAssetUrl(bgImage)}')`,
            backgroundPosition: bgPosition,
          }}
        />

        {/* Left-edge fade: smooth blend into card color */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--card)) 0%, hsl(var(--card) / 0.7) 25%, hsl(var(--card) / 0.3) 40%, transparent 60%)",
          }}
        />
      </div>

      {banner ? (
        /* Banner variant: single-row layout on md+ */
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 p-4 md:py-4 md:px-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 rounded-lg bg-primary/20 text-primary backdrop-blur-sm border border-primary/30">
              {icon}
            </div>
            <span className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
              {title}
            </span>
          </div>

          {/* Hook + Description */}
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 flex-1 min-w-0">
            <h2 className="font-bold text-foreground text-base md:text-lg whitespace-nowrap">
              {problem}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {cleanGuideline}
            </p>
          </div>

          {/* CTA Button */}
          <Button
            className="gap-1.5 shrink-0 shadow-md shadow-primary/10 group-hover:shadow-lg group-hover:shadow-primary/20 transition-shadow self-start md:self-center"
            tabIndex={-1}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      ) : (
        <>
          {/* Content — left-aligned */}
          <div
            className={cn(
              "relative z-10 flex flex-col h-full p-5 pb-14 gap-2",
              featured ? "md:max-w-[52%]" : "md:max-w-[52%]"
            )}
          >
            {/* Icon + Title row */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary backdrop-blur-sm border border-primary/30 shadow-lg shadow-primary/10">
                {icon}
              </div>
              <span className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
                {title}
              </span>
            </div>

            {/* Hook question */}
            <h2
              className={cn(
                "font-bold text-foreground leading-tight",
                featured ? "text-xl md:text-3xl" : "text-lg md:text-2xl"
              )}
            >
              {problem}
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {cleanGuideline}
            </p>
          </div>

          {/* CTA Button — bottom-right corner */}
          <div className="absolute bottom-4 right-5 z-10">
            <Button
              className="gap-1.5 shadow-md shadow-primary/10 group-hover:shadow-lg group-hover:shadow-primary/20 transition-shadow"
              tabIndex={-1}
            >
              {ctaText}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </>
      )}
    </>
  );

  const animationStyle = { animationDelay: `${index * 80}ms` };

  if (external) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className={sharedClassName}
        style={animationStyle}
        data-wn-card
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      to={link}
      className={sharedClassName}
      style={animationStyle}
      data-wn-card
    >
      {content}
    </Link>
  );
};
