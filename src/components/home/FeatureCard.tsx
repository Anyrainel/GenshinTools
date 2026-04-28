import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn, getAssetUrl } from "@/lib/utils";

interface FeatureCardProps {
  icon: ReactNode;
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
}

/**
 * Home-page visual launcher card with a right-side image reveal.
 */
export function FeatureCard({
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
}: FeatureCardProps) {
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

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--card)) 0%, hsl(var(--card) / 0.7) 25%, hsl(var(--card) / 0.3) 40%, transparent 60%)",
          }}
        />
      </div>

      {banner ? (
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 p-4 md:py-4 md:px-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 rounded-lg bg-primary/20 text-primary backdrop-blur-sm border border-primary/30">
              {icon}
            </div>
            <span className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
              {title}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 flex-1 min-w-0">
            <h2 className="font-bold text-foreground text-base md:text-lg whitespace-nowrap">
              {problem}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {cleanGuideline}
            </p>
          </div>

          <Button
            className="gap-1.5 shrink-0 shadow-lg shadow-primary self-start md:self-center"
            tabIndex={-1}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative z-10 flex flex-col h-full p-5 pb-14 gap-2 md:max-w-[52%]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary backdrop-blur-sm border border-primary/30 shadow-lg shadow-primary/10">
                {icon}
              </div>
              <span className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
                {title}
              </span>
            </div>

            <h2
              className={cn(
                "font-bold text-foreground leading-tight",
                featured ? "text-xl md:text-3xl" : "text-lg md:text-2xl"
              )}
            >
              {problem}
            </h2>

            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {cleanGuideline}
            </p>
          </div>

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
}
