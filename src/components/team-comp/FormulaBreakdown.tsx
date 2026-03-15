import type { useLanguage } from "@/contexts/LanguageContext";
import type {
  DisplayPart,
  FormulaTemplate,
  StatKey,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type React from "react";
import { fmtDamage, fmtPercent, fmtStat } from "./displayFormatters";

type HlKey = StatKey | "charLevel" | null;

type Props = {
  parts: DisplayPart[];
  highlightedStat: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
};

function MathZone({
  label,
  value,
  mathLine,
  highlight,
}: {
  label: string;
  value?: React.ReactNode;
  mathLine?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-card border rounded-md shrink-0",
        "p-1 gap-1 md:gap-2",
        highlight
          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
          : "border-border/40 hover:border-border/60"
      )}
    >
      <div className="flex items-baseline gap-1 md:gap-2">
        <span className="text-xs md:text-base font-medium text-foreground/70 tracking-wide">
          {label}
        </span>
        {value !== undefined && value !== null && (
          <span className="font-[math] text-[10px] md:text-sm font-bold text-primary/70">
            {value}
          </span>
        )}
      </div>

      {mathLine && (
        <div className="font-[math] text-[10px] md:text-base font-semibold flex items-center justify-center whitespace-nowrap pb-0.5 md:pb-1.5">
          {mathLine}
        </div>
      )}
    </div>
  );
}

function MathVar({
  val,
  label,
  highlight,
}: {
  val: React.ReactNode;
  label?: string;
  highlight?: boolean;
}) {
  if (!label) return <span className="font-[math]">{val}</span>;
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center justify-end px-0 md:px-0.5 mx-0 md:mx-0.5",
        highlight && "text-primary font-bold"
      )}
    >
      <span className="text-xs md:text-sm leading-none">{val}</span>
      <span className="text-[10px] md:text-xs text-muted-foreground opacity-80 mt-0.5 md:mt-1 font-sans leading-none tracking-tight">
        {label}
      </span>
    </span>
  );
}

function Op({ char = "×" }: { char?: string }) {
  return (
    <div className="flex h-10 md:h-16 items-center justify-center font-[math] text-muted-foreground opacity-60 text-sm md:text-lg px-0.5 md:px-1 mt-6 shrink-0">
      {char}
    </div>
  );
}

function MathOp({ char = "×" }: { char?: string }) {
  return <span className="font-[math] opacity-80 px-0.5 md:px-1">{char}</span>;
}

function Paren({ char }: { char: string }) {
  return (
    <span className="font-[math] opacity-60 px-0 md:px-0.5 text-sm md:text-lg">
      {char}
    </span>
  );
}

function ResMathLine({
  effRes,
  hl,
  t,
}: { effRes: number; hl: boolean; t: ReturnType<typeof useLanguage>["t"] }) {
  if (effRes < 0) {
    return (
      <span className="flex items-center">
        <MathVar val={1} label="" />
        <MathOp char="-" />
        <MathVar
          val={fmtPercent(effRes)}
          label={t.formula("Target")}
          highlight={hl}
        />
        <MathOp char="/" />
        <MathVar val={2} label="" />
      </span>
    );
  }
  if (effRes <= 0.75) {
    return (
      <span className="flex items-center">
        <MathVar val={1} label="" />
        <MathOp char="-" />
        <MathVar
          val={fmtPercent(effRes)}
          label={t.formula("Target")}
          highlight={hl}
        />
      </span>
    );
  }
  return (
    <span className="flex items-center">
      <MathVar val={1} label="" />
      <MathOp char="/" />
      <Paren char="(" />
      <MathVar val={1} label="" />
      <MathOp char="+" />
      <MathVar val={4} label="" />
      <MathOp char="×" />
      <MathVar
        val={fmtPercent(effRes)}
        label={t.formula("Target")}
        highlight={hl}
      />
      <Paren char=")" />
    </span>
  );
}

// ─── Computational Helpers ───

function getEmBonus(em: number, emCoeff: number): number {
  const denominator = emCoeff === 2.78 ? 1400 : emCoeff === 5 ? 1200 : 2000;
  return (emCoeff * em) / (denominator + em);
}

function computeScalingDmg(p: DisplayPart): number {
  let dmg = 0;
  for (let i = 0; i < p.scalingKeys.length; i++) {
    const k = p.scalingKeys[i];
    dmg += (p.statValues[k] || 0) * (p.scalingMulti[i] || 0);
  }
  return dmg;
}

const ELEMENTAL_KEYS = [
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
];

// ─── Zones ───

function ScalingZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (p.scalingKeys.length === 0) return null;
  const val = computeScalingDmg(p);
  const LEVEL_AFFECTED_STATS: StatKey[] = ["atk", "hp", "def"];
  const isHl =
    p.scalingKeys.some((k) => hl === k) ||
    (hl === "charLevel" &&
      p.scalingKeys.some((k) => LEVEL_AFFECTED_STATS.includes(k)));

  const mathLine = (
    <span className="flex items-center gap-0.5">
      {p.scalingKeys.map((k, i) => {
        const kHl =
          hl === k || (hl === "charLevel" && LEVEL_AFFECTED_STATS.includes(k));
        return (
          <span key={k} className="flex gap-0.5 items-center">
            <MathVar
              val={fmtDamage(p.statValues[k] || 0)}
              label={t.statShort(k)}
              highlight={kHl}
            />
            <MathOp />
            <MathVar
              val={fmtPercent(p.scalingMulti[i] ?? 0)}
              label={t.formula("Mult")}
            />
            {i < p.scalingKeys.length - 1 && <MathOp char="+" />}
          </span>
        );
      })}
    </span>
  );

  return (
    <MathZone
      label={t.formula("Base")}
      value={fmtDamage(val)}
      mathLine={mathLine}
      highlight={isHl}
    />
  );
}

function BaseBonusZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const bp = p.statValues["baseDmg%"] || 0;
  if (!bp) return null;
  return (
    <MathZone
      label={t.formula("BaseBonus")}
      highlight={hl === "baseDmg%"}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(bp)}
            label={t.formula("BaseDmgPercent")}
            highlight={hl === "baseDmg%"}
          />
        </span>
      }
    />
  );
}

function ReactionBaseDmgZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const rbp = p.statValues["reactionBaseDmg%"] || 0;
  if (!rbp) return null;
  return (
    <MathZone
      label={t.formula("RxnBaseDmgZone")}
      highlight={hl === "reactionBaseDmg%"}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(rbp)}
            label={t.formula("RxnBaseDmgPercent")}
            highlight={hl === "reactionBaseDmg%"}
          />
        </span>
      }
    />
  );
}

function FlatBonusZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const fb = p.statValues.baseDmg || 0;
  if (!fb) return null;
  return (
    <>
      <Op char="+" />
      <MathZone
        label={t.formula("Flat")}
        highlight={hl === "baseDmg"}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={fmtDamage(fb)}
              label={t.formula("Add")}
              highlight={hl === "baseDmg"}
            />
          </span>
        }
      />
    </>
  );
}

function CatalyzeAdditiveZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const em = p.statValues.em || 0;
  const emCoeff = p.params.emCoeff || 2.78;
  const emBonus = getEmBonus(em, emCoeff);
  const reactDmg = p.statValues["reactionDmg%"] || 0;
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;

  const val = levelMult * reactBase * (1 + emBonus + reactDmg);

  return (
    <MathZone
      label={t.formula("Additive")}
      highlight={hl === "em" || hl === "reactionDmg%" || hl === "charLevel"}
      value={fmtDamage(val)}
      mathLine={
        <span className="flex items-center">
          <MathVar
            val={fmtDamage(levelMult)}
            label={t.formula("LvMult")}
            highlight={hl === "charLevel"}
          />
          <MathOp />
          <MathVar val={reactBase} label={t.formula("RxnBase")} />
          <MathOp />
          <Paren char="(" />
          <MathVar val={1} label="" />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(emBonus)}
            label={t.formula("EMBonus")}
            highlight={hl === "em"}
          />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(reactDmg)}
            label={t.formula("RxnPercent")}
            highlight={hl === "reactionDmg%"}
          />
          <Paren char=")" />
        </span>
      }
    />
  );
}

function ParenGroup({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  if (!enabled) return children;
  return (
    <div className="flex h-[48px] md:h-[72px] items-center bg-card/5 border border-border/20 rounded-md">
      <span className="mt-6">
        <Paren char="(" />
      </span>
      {children}
      <span className="mt-6">
        <Paren char=")" />
      </span>
    </div>
  );
}

function BaseGroup({
  p,
  hl,
  t,
  isCatalyze = false,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
  isCatalyze?: boolean;
}) {
  const hasBaseBonus = !!p.statValues["baseDmg%"];
  const hasFlatBonus = !!p.statValues.baseDmg;
  const needsGrouping = hasBaseBonus || hasFlatBonus || isCatalyze;

  return (
    <ParenGroup enabled={needsGrouping}>
      <ScalingZone p={p} hl={hl} t={t} />
      <Op />
      {hasBaseBonus && <BaseBonusZone p={p} hl={hl} t={t} />}
      {isCatalyze && (
        <>
          <Op char="+" />
          <CatalyzeAdditiveZone p={p} hl={hl} t={t} />
        </>
      )}
      {hasFlatBonus && <FlatBonusZone p={p} hl={hl} t={t} />}
    </ParenGroup>
  );
}

function CoeffZone({
  coeff,
  label,
  t,
}: {
  coeff: number;
  label?: string;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (!label && coeff === 1) return null;
  return (
    <MathZone
      label={t.formula("Coeff")}
      mathLine={
        <span className="flex items-center">
          <MathVar val={coeff} label={label || t.formula("Coeff")} />
        </span>
      }
    />
  );
}

function ReactionBonusZone({
  p,
  hl,
  t,
  labelKey = "rxnZone",
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
  labelKey?: string;
}) {
  const em = p.statValues.em || 0;
  const emCoeff = p.params.emCoeff || 0;
  const emBonus = getEmBonus(em, emCoeff);
  const reactDmg = p.statValues["reactionDmg%"] || 0;

  return (
    <MathZone
      label={t.formula(labelKey)}
      highlight={hl === "em" || hl === "reactionDmg%"}
      value={fmtPercent(1 + emBonus + reactDmg)}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(emBonus)}
            label={t.formula("EMBonus")}
            highlight={hl === "em"}
          />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(reactDmg)}
            label={t.formula("RxnPercent")}
            highlight={hl === "reactionDmg%"}
          />
        </span>
      }
    />
  );
}

function DmgBonusZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  let elementDmg = 0;
  for (const k of ELEMENTAL_KEYS) {
    if (p.statValues[k as StatKey]) {
      elementDmg += p.statValues[k as StatKey] || 0;
    }
  }
  const dmgBonus = p.statValues["dmg%"] || 0;
  const total = 1 + elementDmg + dmgBonus;

  const isHl =
    hl === "dmg%" || (hl != null && ELEMENTAL_KEYS.includes(hl as string));
  return (
    <MathZone
      label={t.formula("DmgBonus")}
      highlight={isHl}
      value={total === 1 ? undefined : fmtPercent(total)}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(elementDmg + dmgBonus)}
            label={t.formula("DmgPercent")}
            highlight={
              hl === "dmg%" || (typeof hl === "string" && hl.includes("%"))
            }
          />
        </span>
      }
    />
  );
}

function CommonMultipliers({
  p,
  hl,
  t,
  showDef = true,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
  showDef?: boolean;
}) {
  const charLevel = p.params.charLevel || 90;
  const enemyLevel = p.params.enemyLevel || 110;
  const defReduc = p.statValues["defReduction%"] || 0;
  const defIgnore = p.statValues["defIgnore%"] || 0;

  const resReduc = p.statValues["resReduction%"] || 0;
  const enemyRes = p.params.enemyRes || 0.1;
  const effRes = enemyRes - resReduc;

  let resMult = 1;
  if (effRes < 0) resMult = 1 - effRes / 2;
  else if (effRes <= 0.75) resMult = 1 - effRes;
  else resMult = 1 / (1 + 4 * effRes);

  const defMult =
    (charLevel + 100) /
    (charLevel + 100 + (enemyLevel + 100) * (1 - defReduc) * (1 - defIgnore));

  const elv = p.statValues["elevated%"] || 0;

  const cr =
    p.template === "transform"
      ? p.statValues.reactionCr || 0
      : p.statValues.cr || 0;
  const cd =
    p.template === "transform"
      ? p.statValues.reactionCd || 0
      : p.statValues.cd || 0;

  const assumeCrit = p.params.assumeCrit === 1;
  const critMult =
    cr > 0 || cd > 0
      ? assumeCrit
        ? 1 + cd
        : 1 + Math.max(0, Math.min(cr, 1)) * cd
      : 1;

  const hasCrit = critMult !== 1;

  return (
    <>
      {hasCrit && (
        <>
          <MathZone
            label={t.formula("Crit")}
            highlight={
              hl === "cr" ||
              hl === "cd" ||
              hl === "reactionCr" ||
              hl === "reactionCd"
            }
            value={fmtPercent(critMult)}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" />
                <MathOp char="+" />
                {!assumeCrit && (
                  <>
                    <Paren char="(" />
                    <MathVar
                      val={fmtPercent(Math.max(0, Math.min(cr, 1)))}
                      label={t.statShort("cr")}
                      highlight={hl === "cr" || hl === "reactionCr"}
                    />
                    <MathOp />
                  </>
                )}
                <MathVar
                  val={fmtPercent(cd)}
                  label={t.statShort("cd")}
                  highlight={hl === "cd" || hl === "reactionCd"}
                />
                {!assumeCrit && <Paren char=")" />}
              </span>
            }
          />
          <Op />
        </>
      )}
      <MathZone
        label={t.formula("Res")}
        value={fmtPercent(resMult)}
        highlight={hl === "resReduction%"}
        mathLine={
          <ResMathLine effRes={effRes} hl={hl === "resReduction%"} t={t} />
        }
      />
      {showDef && (
        <>
          <Op />
          <MathZone
            label={t.formula("Def")}
            value={fmtPercent(defMult)}
            highlight={
              hl === "defReduction%" ||
              hl === "defIgnore%" ||
              hl === "charLevel"
            }
            mathLine={
              <span className="flex items-center">
                <MathVar
                  val={charLevel + 100}
                  label={t.formula("Char")}
                  highlight={hl === "charLevel"}
                />
                <MathOp char="/" />
                <Paren char="(" />
                <MathVar
                  val={charLevel + 100}
                  label={t.formula("Char")}
                  highlight={hl === "charLevel"}
                />
                <MathOp char="+" />
                <MathVar val={enemyLevel + 100} label={t.formula("Enemy")} />
                {defReduc === 0 && defIgnore === 0 ? null : (
                  <>
                    <MathOp char="×" />
                    <MathVar
                      val={fmtPercent((1 - defReduc) * (1 - defIgnore))}
                      label={t.formula("DefFactor")}
                      highlight={hl === "defReduction%" || hl === "defIgnore%"}
                    />
                  </>
                )}
                <Paren char=")" />
              </span>
            }
          />
        </>
      )}
      {elv ? (
        <>
          <Op />
          <MathZone
            label={t.statShort("elevated%")}
            highlight={hl === "elevated%"}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" />
                <MathOp char="+" />
                <MathVar
                  val={fmtPercent(elv)}
                  label={t.statShort("elevated%")}
                  highlight={hl === "elevated%"}
                />
              </span>
            }
          />
        </>
      ) : null}
    </>
  );
}

// ─── Renderers by Template ───

function DirectEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <>
      <BaseGroup p={p} hl={hl} t={t} />
      <Op />
      <DmgBonusZone p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} />
    </>
  );
}

function AmplifyEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const reactBase = p.params.reactionCoeff || 1;
  return (
    <>
      <CoeffZone
        coeff={reactBase}
        label={p.tag?.reaction ? t.reaction(p.tag.reaction) : undefined}
        t={t}
      />
      <Op />
      <BaseGroup p={p} hl={hl} t={t} />
      <Op />
      <ReactionBonusZone p={p} hl={hl} t={t} />
      <Op />
      <DmgBonusZone p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} />
    </>
  );
}

function CatalyzeEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <>
      <BaseGroup p={p} hl={hl} t={t} isCatalyze />
      <Op />
      <DmgBonusZone p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} />
    </>
  );
}

function TransformEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;

  return (
    <>
      <CoeffZone
        coeff={reactBase}
        label={p.tag?.reaction ? t.reaction(p.tag.reaction) : undefined}
        t={t}
      />
      <Op />
      <MathVar val={fmtDamage(levelMult)} label={t.formula("LvMult")} />
      <Op />
      <ReactionBonusZone p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} showDef={false} />
    </>
  );
}

function LunarEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;
  const baseDmg = levelMult * reactBase;
  const rbdp = p.statValues["reactionBaseDmg%"] || 0;
  const bdp = p.statValues["baseDmg%"] || 0;

  return (
    <>
      <CoeffZone
        coeff={reactBase}
        label={p.tag?.reaction ? t.reaction(p.tag.reaction) : undefined}
        t={t}
      />
      <Op />
      <MathVar val={fmtDamage(levelMult)} label={t.formula("LvMult")} />
      {bdp ? (
        <>
          <Op />
          <MathZone
            label={t.formula("BaseDmgPercent")}
            highlight={hl === "baseDmg%"}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" />
                <MathOp char="+" />
                <MathVar
                  val={fmtPercent(bdp)}
                  label={t.formula("DmgPercent")}
                  highlight={hl === "baseDmg%"}
                />
              </span>
            }
          />
        </>
      ) : null}
      {rbdp ? (
        <>
          <Op />
          <ReactionBaseDmgZone p={p} hl={hl} t={t} />
        </>
      ) : null}
      <Op />
      <ReactionBonusZone p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} showDef={false} />
    </>
  );
}

function LunarDirectGroup({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const hasReactionBaseBonus = !!p.statValues["reactionBaseDmg%"];
  const hasBaseBonus = !!p.statValues["baseDmg%"];
  const hasFlatBonus = !!p.statValues.baseDmg;

  const directCoeff = p.params.directCoeff ?? 1;

  return (
    <ParenGroup>
      <CoeffZone
        coeff={directCoeff}
        label={p.tag?.reaction ? t.reaction(p.tag.reaction) : undefined}
        t={t}
      />
      <Op />
      <ScalingZone p={p} hl={hl} t={t} />
      {hasBaseBonus && (
        <>
          <Op />
          <BaseBonusZone p={p} hl={hl} t={t} />
        </>
      )}
      {hasReactionBaseBonus && (
        <>
          <Op />
          <ReactionBaseDmgZone p={p} hl={hl} t={t} />
        </>
      )}
      <Op />
      <ReactionBonusZone p={p} hl={hl} t={t} labelKey="lunarRxn" />
      {hasFlatBonus && <FlatBonusZone p={p} hl={hl} t={t} />}
    </ParenGroup>
  );
}

function LunarDirectEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: HlKey;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <>
      <LunarDirectGroup p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} showDef={false} />
    </>
  );
}

const RENDERERS: Record<
  FormulaTemplate,
  React.FC<{
    p: DisplayPart;
    hl: HlKey;
    t: ReturnType<typeof useLanguage>["t"];
  }>
> = {
  direct: DirectEq,
  amplify: AmplifyEq,
  catalyze: CatalyzeEq,
  transform: TransformEq,
  lunar: LunarEq,
  lunarDirect: LunarDirectEq,
};

const TEMPLATE_KEYS: Record<FormulaTemplate, string> = {
  direct: "DirectDamage",
  amplify: "AmplifyingReaction",
  catalyze: "AdditiveReaction",
  transform: "TransformativeReaction",
  lunar: "LunarReaction",
  lunarDirect: "LunarDirect",
};

// ─── Main Component ───

function getTemplateName(
  p: DisplayPart,
  t: ReturnType<typeof useLanguage>["t"]
) {
  const abilityPrefix = p.tag?.ability ? `${t.ability(p.tag.ability)}: ` : "";
  const elName = p.tag?.element ? `${t.element(p.tag.element)} ` : "";
  if (p.template === "direct")
    return abilityPrefix + elName + t.formula("DirectDamage");
  if (p.tag?.reaction && p.tag.reaction !== "none") {
    const rxn = t.reaction(p.tag.reaction);
    if (p.template === "lunarDirect")
      return abilityPrefix + elName + rxn + t.formula("DirectSuffix");
    return abilityPrefix + elName + rxn + t.formula("ReactionSuffix");
  }
  return abilityPrefix + elName + t.formula(TEMPLATE_KEYS[p.template]);
}

export function FormulaBreakdown({ parts, highlightedStat, t }: Props) {
  return (
    <div className="w-full overflow-x-auto pt-3 px-1">
      <div className="w-max mx-auto flex flex-col items-center gap-2 md:gap-4">
        {parts.map((p, idx) => {
          const Renderer = RENDERERS[p.template];
          return (
            <div key={idx} className="flex items-center pt-2">
              <Renderer p={p} hl={highlightedStat} t={t} />
              <div className="flex px-1 md:px-2 shrink-0 h-10 md:h-16 items-center">
                <Op char="=" />
              </div>
              <div className="flex flex-col items-center justify-between gap-1 md:gap-2 bg-primary/5 border border-primary/20 px-2 md:px-4 py-1.5 md:py-2 rounded-lg">
                <span className="text-[10px] md:text-sm text-primary tracking-wide leading-none whitespace-nowrap">
                  {getTemplateName(p, t)}
                </span>
                <span className="font-[math] text-base md:text-xl font-black text-foreground flex items-center justify-center gap-x-1">
                  {p.hits && p.hits !== 1 ? (
                    <>
                      <span>{fmtDamage(p.damage)}</span>
                      <span className="text-primary bg-primary/10 rounded-full px-2 text-xs font-semibold ml-1 tracking-wider">
                        × {p.hits}
                      </span>
                    </>
                  ) : (
                    <span>{fmtDamage(p.damage)}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
