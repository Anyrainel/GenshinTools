import {
  HelpCircle,
  Settings,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { ELEMENT_KEYS, type ElementalOrPhysical } from "@/data/enums";
import { computeStateRes, formatStat } from "@/data/gameDataLoader";
import type { BossState, LeylineBossData } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { SENTIMENT_BADGE } from "../shared/colors";

function useBossTranslations(bossData: LeylineBossData) {
  const { language } = useLanguage();
  return useMemo(
    () => ({
      bossName: (id: number) => bossData.getBossDisplayName(id, language),
      bossVariantName: (id: number, tier: number) =>
        bossData.getBossVariantName(id, tier, language),
      bossDesc: (id: number) => bossData.getBossDesc(id, language),
      bossBullets: (id: number, tier: number) =>
        bossData.getBulletsForTier(id, tier, language),
      bossAdvantage: (id: number, tier: number) =>
        bossData.getAdvantageForTier(id, tier, language),
    }),
    [language, bossData]
  );
}

const BOSS_ICON_SIZES = {
  sm: { outer: "w-8 h-8 rounded", inner: "w-7 h-7" },
  md: { outer: "w-10 h-10 rounded", inner: "w-9 h-9" },
  lg: {
    outer: "w-14 h-14 rounded-lg p-0.5 shrink-0",
    inner: "w-full h-full",
  },
} as const;

export function BossIcon({
  imagePath,
  name,
  size,
}: {
  imagePath: string | null;
  name: string;
  size: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const s = BOSS_ICON_SIZES[size];
  const showFallback = !imagePath || failed;
  return (
    <div
      className={cn(
        s.outer,
        "bg-black/20 border border-border/30 flex items-center justify-center overflow-hidden"
      )}
    >
      {showFallback ? (
        <HelpCircle className={cn(s.inner, "text-muted-foreground")} />
      ) : (
        <img
          src={getAssetUrl(imagePath)}
          alt={name}
          className={cn(s.inner, "object-contain")}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const ELEMENT_COLOR: Record<ElementalOrPhysical, string> = {
  Physical: "text-gray-300",
  Pyro: "text-element-pyro",
  Hydro: "text-element-hydro",
  Electro: "text-element-electro",
  Dendro: "text-element-dendro",
  Anemo: "text-element-anemo",
  Geo: "text-element-geo",
  Cryo: "text-element-cryo",
};

function ResValue({
  value,
  muted,
  base,
}: {
  value: number;
  muted?: boolean;
  base?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-lg tabular-nums leading-none",
        muted
          ? "text-muted-foreground font-normal"
          : base
            ? "font-semibold"
            : "font-medium",
        !muted &&
          (value < 0
            ? "text-green-400"
            : value > 75
              ? "text-red-400"
              : "text-foreground")
      )}
    >
      {value}%
    </span>
  );
}

function ResGrid({
  res,
  delta,
}: {
  res: Record<ElementalOrPhysical, number>;
  delta?: Partial<Record<ElementalOrPhysical, number>>;
}) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 p-1.5">
      {ELEMENT_KEYS.map((key) => {
        const hasChange = delta
          ? delta[key] !== undefined && delta[key] !== 0
          : false;
        return (
          <div
            key={key}
            className={cn(
              "rounded-lg border border-border/30 bg-muted/30 px-1 pt-2 pb-1.5 text-center",
              delta && hasChange && "bg-muted/60 border-border/50"
            )}
          >
            <div className={cn("text-sm font-medium", ELEMENT_COLOR[key])}>
              {t.elementRes(key)}
            </div>
            <div className="mt-1">
              <ResValue
                value={res[key]}
                muted={delta != null && !hasChange}
                base={delta == null}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseColorTags(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /<color=(#[0-9A-Fa-f]{6,8})>(.*?)<\/color>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const color = match[1].length === 9 ? match[1].slice(0, 7) : match[1];
    parts.push(
      <span key={match.index} style={{ color }} className="font-medium">
        {match[2]}
      </span>
    );
    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function ColorText({ text }: { text: string }) {
  const lines = text.split("\\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {parseColorTags(line)}
        </Fragment>
      ))}
    </>
  );
}

function SectionTitle({
  icon,
  iconColor,
  children,
}: {
  icon?: ReactNode;
  iconColor?: string;
  children: ReactNode;
}) {
  return (
    <h3 className="text-base font-semibold text-muted-foreground px-1 flex items-center gap-2">
      {icon && <span className={iconColor}>{icon}</span>}
      {children}
    </h3>
  );
}

const TIER_KEYS = [
  "archive.bossTier1",
  "archive.bossTier2",
  "archive.bossTier3",
  "archive.bossTier4",
  "archive.bossTier5",
  "archive.bossTier6",
] as const;

function TierSelector({
  selectedTier,
  onSelect,
  t,
}: {
  selectedTier: number;
  onSelect: (tier: number) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-muted p-1 gap-1">
      {[1, 2, 3, 4, 5, 6].map((tier) => (
        <button
          key={tier}
          type="button"
          onClick={() => onSelect(tier)}
          className={cn(
            "py-1.5 px-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
            selectedTier === tier
              ? "bg-primary/50 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tier}.{t.ui(TIER_KEYS[tier - 1])}
        </button>
      ))}
    </div>
  );
}

export function BossDetailPanel({
  bossId,
  bossData,
}: {
  bossId: number;
  bossData: LeylineBossData;
}) {
  const { t } = useLanguage();
  const boss = useBossTranslations(bossData);
  const [selectedTier, setSelectedTier] = useState(6);
  const [showDetailedDesc, setShowDetailedDesc] = useState(true);

  const info = bossData.getBossInfo(bossId);
  const desc = boss.bossDesc(bossId);

  const leylineStates = useMemo(() => {
    if (!info?.states) return [];
    const stateMap = new Map<string, BossState>();
    for (const s of info.states) {
      const existing = stateMap.get(s.state);
      if (
        !existing ||
        s.ability.includes("LeyLineChallenge") ||
        s.ability.includes("BossRush")
      ) {
        stateMap.set(s.state, s);
      }
    }
    return Array.from(stateMap.values());
  }, [info?.states]);

  const allParams = useMemo(() => {
    if (!info?.params) return [];
    const entries: [string, number][] = [];
    for (const params of Object.values(info.params)) {
      for (const [key, value] of Object.entries(params)) {
        entries.push([key, value]);
      }
    }
    return entries;
  }, [info?.params]);

  if (!info || !desc) return null;

  const tierStats = info.tiers[String(selectedTier)];
  const variantName = boss.bossVariantName(bossId, selectedTier);
  const displayName = boss.bossName(bossId);
  const imagePath = bossData.getBossImagePath(bossId);
  const bullets = boss.bossBullets(bossId, selectedTier);
  const { advantage, disadvantage } = boss.bossAdvantage(bossId, selectedTier);

  return (
    <Card className="bg-gradient-card">
      <CardContent className="py-2 md:py-4 lg:py-6 px-2 md:px-4 lg:px-6 space-y-3 md:space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <BossIcon imagePath={imagePath} name={displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate">{variantName}</h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {advantage.map((text, i) => (
                <span
                  key={`a${i}`}
                  className={cn(
                    "inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-md border",
                    SENTIMENT_BADGE.positive
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5 shrink-0" />
                  {text}
                </span>
              ))}
              {disadvantage.map((text, i) => (
                <span
                  key={`d${i}`}
                  className={cn(
                    "inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-md border",
                    SENTIMENT_BADGE.negative
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5 shrink-0" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tier-Dependent Section */}
        <div className="space-y-2">
          <SectionTitle
            icon={<Swords className="h-4 w-4" />}
            iconColor="text-primary"
          >
            {t.ui("archive.bossTierDetails")}
          </SectionTitle>
          <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
            <div className="px-3 pt-3 pb-2">
              <TierSelector
                selectedTier={selectedTier}
                onSelect={setSelectedTier}
                t={t}
              />
            </div>

            {/* Stats */}
            <div className="px-3 pt-2 pb-3">
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: "Lv.",
                    value: String(tierStats?.level ?? "?"),
                    color: "text-primary",
                    hidden: false,
                  },
                  {
                    label: t.statShort("hp"),
                    value: formatStat(tierStats?.hp),
                    color: "text-green-400",
                    // TODO: unhide once HP data is populated in leyline_boss_info.json.
                    hidden: true,
                  },
                  {
                    label: t.statShort("atk"),
                    value: formatStat(tierStats?.atk),
                    color: "text-red-400",
                    // TODO: unhide once ATK data is populated in leyline_boss_info.json.
                    hidden: true,
                  },
                  {
                    label: t.statShort("def"),
                    value: formatStat(tierStats?.def),
                    color: "text-amber-400",
                    // TODO: unhide once DEF data is populated in leyline_boss_info.json.
                    hidden: true,
                  },
                ]
                  .filter((s) => !s.hidden)
                  .map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="flex items-baseline gap-3 rounded-lg bg-muted/40 border border-border/30 px-3 py-1.5"
                    >
                      <span className={cn("text-sm font-medium", color)}>
                        {label}
                      </span>
                      <span className="font-mono font-bold text-xl text-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Combat Mechanics */}
            {bullets.length > 0 && (
              <div className="border-t border-border/30">
                <div className="px-3 py-2 flex items-center gap-3">
                  <span className="font-semibold text-sm">
                    {t.ui("archive.bossMechanics")}
                  </span>
                  <div className="inline-flex items-center gap-2 ml-3">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !showDetailedDesc
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t.ui("archive.bossDescShort")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDetailedDesc((v) => !v)}
                      className="relative w-9 h-5 rounded-full bg-muted transition-colors"
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-primary shadow transition-transform",
                          showDetailedDesc && "translate-x-4"
                        )}
                      />
                    </button>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        showDetailedDesc
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {t.ui("archive.bossDescDetailed")}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-border/20">
                  {bullets.map((bullet, i) => {
                    const text = showDetailedDesc
                      ? (bullet.detail ?? bullet.short)
                      : (bullet.short ?? bullet.detail);
                    if (!text) return null;
                    return (
                      <div key={i} className="px-3 py-2.5 space-y-1">
                        {bullet.title && (
                          <p className="font-semibold text-sm text-primary">
                            {bullet.title}
                          </p>
                        )}
                        <p className="text-sm leading-relaxed">
                          <ColorText text={text} />
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resistance & Params */}
        {(info.res || leylineStates.length > 0 || allParams.length > 0) && (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4 md:space-y-6">
              {info.res && (
                <div className="space-y-2">
                  <SectionTitle
                    icon={<Shield className="h-4 w-4" />}
                    iconColor="text-primary"
                  >
                    {t.ui("archive.bossBaseRes")}
                  </SectionTitle>
                  <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
                    <ResGrid res={info.res!} />
                  </div>
                </div>
              )}

              {allParams.length > 0 && (
                <div className="space-y-2">
                  <SectionTitle
                    icon={<Settings className="h-4 w-4" />}
                    iconColor="text-muted-foreground"
                  >
                    {t.ui("archive.bossParams")}
                  </SectionTitle>
                  <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden p-3">
                    <div className="grid grid-cols-1 gap-y-0.5">
                      {allParams.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 py-0.5"
                        >
                          <span className="text-sm text-muted-foreground truncate">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-mono font-medium shrink-0">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {leylineStates.length > 0 && (
              <div className="space-y-2">
                <SectionTitle
                  icon={<Zap className="h-4 w-4" />}
                  iconColor="text-amber-400"
                >
                  {t.ui("archive.bossResStates")}
                </SectionTitle>
                <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden divide-y divide-border/20">
                  {leylineStates.map((state, i) => {
                    const stateName = state.state
                      .replace(/^(UNIQUE_|Monster_)/, "")
                      .replace(/_/g, " ");
                    const totalRes =
                      info.res && state.res_delta
                        ? computeStateRes(info.res, state.res_delta)
                        : null;

                    return (
                      <div key={i} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">
                            {stateName}
                          </span>
                          {state.value_delta && (
                            <Badge
                              variant="outline"
                              className="text-sm text-amber-400 border-amber-500/30"
                            >
                              {t.statShort("atk")} ×
                              {(1 + state.value_delta.atk_ratio).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        {totalRes && (
                          <ResGrid res={totalRes} delta={state.res_delta} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
