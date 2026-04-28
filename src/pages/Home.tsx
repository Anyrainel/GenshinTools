import {
  Award,
  Compass,
  Database,
  Filter,
  Sparkles,
  Sword,
  Users,
} from "lucide-react";
import { useRef } from "react";
import { FeatureCard } from "@/components/home/FeatureCard";
import { FeatureMatrix } from "@/components/home/FeatureMatrix";
import { WelcomeGuideManual } from "@/components/home/WelcomeGuideManual";
import { PageLayout } from "@/components/layout/PageLayout";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { WhatsNew } from "@/components/shared/WhatsNew";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  const guideRef = useRef<ControlHandle>(null);

  return (
    <PageLayout>
      <div className="h-full w-full overflow-y-auto">
        <div className="container mx-auto px-8 pb-4 min-h-full flex flex-col gap-6 overflow-x-hidden">
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
            <div className="pt-2">
              <Button
                variant="default"
                size="lg"
                className="gap-2.5 bg-black hover:bg-black/80 text-lg px-6"
                onClick={() => guideRef.current?.open()}
              >
                <Compass className="size-5 text-foreground" />
                <span className="animate-text-shimmer">
                  {t.ui("greeting.getStarted")}
                </span>
              </Button>
            </div>
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
              bgImage="assets/home/skirk.webp"
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
                bgImage="assets/home/columbina.webp"
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
                bgImage="assets/home/traveler.webp"
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
                bgImage="assets/home/escoffier.webp"
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
                bgImage="assets/home/ineffa.webp"
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
              bgImage="assets/home/mizuki.webp"
              bgPosition="center 32%"
              ctaText={t.ui("app.ctaJoinCommunity")}
              external
              banner
              index={5}
            />
          </WhatsNew>

          <FeatureMatrix />

          {/* Footer */}
          <footer className="mt-auto pt-6 pb-2 border-t border-border/20 text-center space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {t.ui("app.disclaimerPrefix")}
              <a
                href="https://github.com/Anyrainel/GenshinTools"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t.ui("app.disclaimerProject")}
              </a>
              {t.ui("app.disclaimerSuffix")}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.ui("app.dataAttribution")}
            </p>
          </footer>
        </div>
      </div>
      <WelcomeGuideManual ref={guideRef} />
    </PageLayout>
  );
}
