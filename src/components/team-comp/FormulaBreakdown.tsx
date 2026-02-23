import type { useLanguage } from "@/contexts/LanguageContext";
import type {
  DisplayPart,
  FormulaTemplate,
  StatKey,
} from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import type React from "react";
import { fmtDamage, fmtPercent, fmtStat } from "./displayFormatters";

type Props = {
  parts: DisplayPart[];
  highlightedStat: StatKey | null;
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
        "flex flex-col items-center justify-center bg-card/40 border p-2 rounded-md min-w-[90px] shrink-0 gap-2",
        highlight
          ? "border-primary/60 bg-primary/10 shadow-[0_0_8px_rgba(var(--primary),0.3)] ring-1 ring-primary/40"
          : "border-border/40 hover:border-border/60"
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-base font-medium text-foreground/70 tracking-wide">
          {label}
        </span>
        {value !== undefined && value !== null && (
          <span className="font-[math] text-sm font-bold text-primary/70">
            {value}
          </span>
        )}
      </div>

      {mathLine && (
        <div className="font-[math] text-xs md:text-base font-semibold flex items-center justify-center whitespace-nowrap pb-1.5">
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
        "inline-flex flex-col items-center justify-end px-0.5 mx-0.5 relative top-[3px]",
        highlight && "text-primary font-bold"
      )}
    >
      <span className="text-sm leading-none">{val}</span>
      <span className="text-xs text-muted-foreground opacity-80 mt-1 font-sans leading-none tracking-tight">
        {label}
      </span>
    </span>
  );
}

function Op({ char = "×" }: { char?: string }) {
  return (
    <div className="flex h-16 items-center justify-center font-[math] text-muted-foreground opacity-60 text-lg px-1 shrink-0">
      {char}
    </div>
  );
}

function MathOp({ char = "×" }: { char?: string }) {
  return <span className="font-[math] opacity-80 px-1">{char}</span>;
}

function Paren({ char }: { char: string }) {
  return <span className="font-[math] opacity-60 px-0.5 text-lg">{char}</span>;
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
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (p.scalingKeys.length === 0) return null;
  const val = computeScalingDmg(p);
  const isHl = p.scalingKeys.some((k) => hl === k);

  const mathLine = (
    <span className="flex items-center gap-0.5">
      {p.scalingKeys.map((k, i) => {
        const kHl = hl === k;
        return (
          <span key={k} className="flex gap-0.5 items-center">
            <MathVar
              val={Math.round(p.statValues[k] || 0).toLocaleString()}
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
      value={Math.round(val).toLocaleString()}
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
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const bp = p.statValues["baseDmg%"] || 0;
  if (!bp) return null;
  return (
    <>
      <Op />
      <MathZone
        label={t.formula("BaseBonus")}
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
    </>
  );
}

function FlatBonusZone({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const fb = p.statValues.baseDmg || 0;
  if (!fb) return null;
  return (
    <>
      <Op char="+" />
      <MathZone
        label={t.formula("Flat")}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={Math.round(fb).toLocaleString()}
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
  hl: StatKey | null;
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
      value={Math.round(val).toLocaleString()}
      mathLine={
        <span className="flex items-center">
          <MathVar
            val={Math.round(levelMult).toLocaleString()}
            label={t.formula("LvMult")}
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

function BaseGroup({
  p,
  hl,
  t,
  isCatalyze = false,
}: {
  p: DisplayPart;
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
  isCatalyze?: boolean;
}) {
  const hasBaseBonus = !!p.statValues["baseDmg%"];
  const hasFlatBonus = !!p.statValues.baseDmg;
  const needsGrouping = hasBaseBonus || hasFlatBonus || isCatalyze;

  const content = (
    <>
      <ScalingZone p={p} hl={hl} t={t} />
      {hasBaseBonus && <BaseBonusZone p={p} hl={hl} t={t} />}
      {isCatalyze && (
        <>
          <Op char="+" />
          <CatalyzeAdditiveZone p={p} hl={hl} t={t} />
        </>
      )}
      {hasFlatBonus && <FlatBonusZone p={p} hl={hl} t={t} />}
    </>
  );

  if (!needsGrouping) return content;

  return (
    <div className="flex h-[72px] items-center mx-1 bg-black/5 border border-border/20 px-1 rounded-md">
      <Paren char="(" />
      {content}
      <Paren char=")" />
    </div>
  );
}

function ReactionBonusZone({
  p,
  hl,
  t,
  labelKey = "EmOrRxn",
}: {
  p: DisplayPart;
  hl: StatKey | null;
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
  hl: StatKey | null;
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

  return (
    <MathZone
      label={t.formula("DmgBonus")}
      value={total === 1 ? undefined : fmtPercent(total)}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(elementDmg + dmgBonus)}
            label={t.formula("DmgPercent")}
            highlight={hl === "dmg%" || hl?.includes("%")}
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
  hl: StatKey | null;
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
            mathLine={
              <span className="flex items-center">
                <MathVar val={charLevel + 100} label={t.formula("Char")} />
                <MathOp char="/" />
                <Paren char="(" />
                <MathVar val={charLevel + 100} label={t.formula("Char")} />
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
  hl: StatKey | null;
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
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <>
      <BaseGroup p={p} hl={hl} t={t} />
      <Op />
      <DmgBonusZone p={p} hl={hl} t={t} />
      <Op />
      <CommonMultipliers p={p} hl={hl} t={t} />
      <Op />
      <MathZone
        label={t.formula("Amp")}
        value={fmtPercent(
          (p.params.reactionCoeff || 1) *
            (1 +
              getEmBonus(p.statValues.em || 0, p.params.emCoeff || 2.78) +
              (p.statValues["reactionDmg%"] || 0))
        )}
        mathLine={
          <span className="flex items-center">
            <MathVar val={p.params.reactionCoeff} label={t.formula("Base")} />
            <MathOp />
            <Paren char="(" />
            <MathVar val={1} label="" />
            <MathOp char="+" />
            <MathVar
              val={fmtPercent(
                getEmBonus(p.statValues.em || 0, p.params.emCoeff || 2.78)
              )}
              label={t.formula("EMBonus")}
              highlight={hl === "em"}
            />
            <MathOp char="+" />
            <MathVar
              val={fmtPercent(p.statValues["reactionDmg%"] || 0)}
              label={t.formula("RxnPercent")}
              highlight={hl === "reactionDmg%"}
            />
            <Paren char=")" />
          </span>
        }
      />
    </>
  );
}

function CatalyzeEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: StatKey | null;
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
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;
  const baseDmg = levelMult * reactBase;

  return (
    <>
      <MathZone
        label={t.formula("BaseRxn")}
        value={Math.round(baseDmg).toLocaleString()}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={Math.round(levelMult).toLocaleString()}
              label={t.formula("LvMult")}
            />{" "}
            <MathOp /> <MathVar val={reactBase} label={t.formula("RxnBase")} />
          </span>
        }
      />
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
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;
  const baseDmg = levelMult * reactBase;
  const bdp = p.statValues["baseDmg%"] || 0;

  return (
    <>
      <MathZone
        label={t.formula("BaseRxn")}
        value={Math.round(baseDmg).toLocaleString()}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={Math.round(levelMult).toLocaleString()}
              label={t.formula("LvMult")}
            />
            <MathOp />
            <MathVar val={reactBase} label={t.formula("RxnBase")} />
          </span>
        }
      />
      <Op />
      <ReactionBonusZone p={p} hl={hl} t={t} />
      {bdp ? (
        <>
          <Op />
          <MathZone
            label={t.formula("BaseDmgPercent")}
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
  hl: StatKey | null;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const hasBaseBonus = !!p.statValues["baseDmg%"];
  const hasFlatBonus = !!p.statValues.baseDmg;

  const directCoeff = p.params.directCoeff ?? 1;

  const content = (
    <>
      <ScalingZone p={p} hl={hl} t={t} />
      {directCoeff !== 1 && (
        <>
          <Op />
          <MathZone
            label={t.formula("DirectCoeff")}
            mathLine={
              <span className="flex items-center">
                <MathVar val={directCoeff} label={t.formula("DirectCoeff")} />
              </span>
            }
          />
        </>
      )}
      {hasBaseBonus && <BaseBonusZone p={p} hl={hl} t={t} />}
      <Op />
      <ReactionBonusZone p={p} hl={hl} t={t} labelKey="Lunar DMG%" />
      {hasFlatBonus && <FlatBonusZone p={p} hl={hl} t={t} />}
    </>
  );

  return (
    <div className="flex h-[72px] items-center mx-1 bg-black/5 border border-border/20 px-1 rounded-md">
      <Paren char="(" />
      {content}
      <Paren char=")" />
    </div>
  );
}

function LunarDirectEq({
  p,
  hl,
  t,
}: {
  p: DisplayPart;
  hl: StatKey | null;
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
    hl: StatKey | null;
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
  if (p.template === "direct") return t.formula("DirectDamage");
  if (p.tag?.reaction && p.tag.reaction !== "none") {
    const rxn = t.reaction(p.tag.reaction);
    if (p.template === "lunarDirect") return rxn + t.formula("DirectSuffix");
    return rxn + t.formula("ReactionSuffix");
  }
  return t.formula(TEMPLATE_KEYS[p.template]);
}

export function FormulaBreakdown({ parts, highlightedStat, t }: Props) {
  return (
    <div className="w-full overflow-x-auto pt-3 px-1">
      <div className="w-max mx-auto flex flex-col items-center gap-4">
        {parts.map((p, idx) => {
          const Renderer = RENDERERS[p.template];
          return (
            <div key={idx} className="flex items-center pt-2">
              <Renderer p={p} hl={highlightedStat} t={t} />
              <div className="flex px-2 shrink-0 h-16 items-center">
                <Op char="=" />
              </div>
              <div className="flex flex-col items-center justify-between gap-2 bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg">
                <span className="text-sm text-primary/70 tracking-wide leading-none opacity-80 whitespace-nowrap">
                  {getTemplateName(p, t)}
                </span>
                <span className="font-[math] text-lg md:text-xl font-black text-foreground flex flex-wrap items-baseline justify-center gap-x-1.5 h-full">
                  {p.hits && p.hits !== 1 ? (
                    <>
                      <span>{fmtDamage(p.damage)}</span>
                      <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-xs font-semibold ml-1 tracking-wider">
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
