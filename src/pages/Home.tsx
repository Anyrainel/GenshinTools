import { AppBar } from "@/components/layout/AppBar";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

import { getAssetUrl } from "@/lib/utils";
import {
  ArrowRight,
  Database,
  Filter,
  ListOrdered,
  Sword,
  Users,
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

        {/* Tools List - Split View */}
        <div className="flex flex-col gap-5 w-full pb-1">
          <FeatureRow
            icon={<Database className="w-5 h-5" />}
            title={t.ui("app.navAccountData")}
            problem={t.ui("app.accountDataProblem")}
            guideline={t.ui("app.accountDataGuideline")}
            link="/account-data"
            bgImage="assets/home/account_bg.png"
            bgPosition="center 13%"
          />

          <FeatureRow
            icon={<Filter className="w-5 h-5" />}
            title={t.ui("app.navArtifactFilter")}
            problem={t.ui("app.artifactFilterProblem")}
            guideline={t.ui("app.artifactFilterGuideline")}
            link="/artifact-filter"
            bgImage="assets/home/artifact_bg.jpeg"
            bgPosition="center 50%"
          />

          <FeatureRow
            icon={<ListOrdered className="w-5 h-5" />}
            title={t.ui("app.navTierList")}
            problem={t.ui("app.tierListProblem")}
            guideline={t.ui("app.tierListGuideline")}
            link="/tier-list"
            bgImage="assets/home/tierlist_bg.jpeg"
            bgPosition="center 55%"
          />

          <FeatureRow
            icon={<Sword className="w-5 h-5" />}
            title={t.ui("app.navWeaponTierList")}
            problem={t.ui("app.weaponTierListProblem")}
            guideline={t.ui("app.weaponTierListGuideline")}
            link="/weapon-tier-list"
            bgImage="assets/home/weapon_bg.png"
            bgPosition="center 50%"
          />

          <FeatureRow
            icon={<Users className="w-5 h-5" />}
            title={t.ui("app.navTeamBuilder")}
            problem={t.ui("app.teamBuilderProblem")}
            guideline={t.ui("app.teamBuilderGuideline")}
            link="/team-builder"
            bgImage="assets/home/team_bg.jpg"
            bgPosition="center 40%"
          />
        </div>
      </div>
    </PageLayout>
  );
}

const FeatureRow = ({
  icon,
  title,
  problem,
  guideline,
  link,
  bgImage,
  bgPosition = "center center",
}: {
  icon: React.ReactNode;
  title: string;
  problem: string;
  guideline: string;
  link: string;
  bgImage: string;
  bgPosition?: string;
}) => {
  return (
    <div className="group grid grid-cols-1 md:grid-cols-[40%_1fr] items-stretch min-h-[120px] md:h-[120px] rounded-2xl overflow-hidden transition-all duration-300 border border-border/30 hover:border-primary/40 shadow-sm hover:shadow-md bg-card/30">
      {/* Left: Problem Question with Background Image */}
      <div className="relative h-32 md:h-full flex items-center px-4 md:px-8 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover"
            style={{
              backgroundImage: `url('${getAssetUrl(bgImage)}')`,
              backgroundPosition: bgPosition,
            }}
          />
          {/* Gradient Overlay: Heavy dark shade to ensure text readability */}
          <div className="absolute inset-0 bg-black/70 transition-colors duration-300 group-hover:bg-black/40" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-left pl-2">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white group-hover:text-primary transition-colors leading-tight drop-shadow-md">
            {problem}
          </h2>
        </div>
      </div>

      {/* Right: Solution (Button + Guideline) */}
      <div className="relative h-full flex items-center p-4 md:px-8 bg-card border-t md:border-t-0 md:border-l border-white/5">
        <div className="flex flex-col md:grid md:grid-cols-[auto_1fr] items-start md:items-center gap-4 md:gap-6 w-full">
          <Link to={link} className="shrink-0 w-full md:w-auto">
            <Button
              variant="outline"
              className="h-10 w-full md:w-60 relative rounded-full border-primary/80 bg-background/50 hover:bg-background/80 hover:border-primary shadow-md text-base md:text-lg font-medium flex items-center justify-center px-10 backdrop-blur-sm"
            >
              <span className="absolute left-5 text-primary shrink-0">
                {icon}
              </span>
              <span className="truncate text-center">{title}</span>
              <ArrowRight className="absolute right-5 w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform shrink-0" />
            </Button>
          </Link>

          <div className="text-sm md:text-lg text-muted-foreground/90 leading-snug font-light line-clamp-3">
            {guideline.split(/(\d+\.)|(\[.*?\]\(.*?\))/).map((part, i) => {
              if (!part) return null;
              if (part.match(/^\d+\.$/)) {
                return (
                  <span
                    key={i}
                    className="font-semibold text-primary ml-1.5 first:ml-0"
                  >
                    {part}
                  </span>
                );
              }
              const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                return (
                  <a
                    key={i}
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline underline-offset-4 transition-colors font-medium"
                  >
                    {linkMatch[1]}
                  </a>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
