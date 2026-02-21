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
  value: React.ReactNode;
  mathLine?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-black/10 border p-2.5 rounded-md transition-all duration-200 min-w-[90px] shrink-0 gap-1.5",
        highlight
          ? "border-primary/60 bg-primary/10 shadow-[0_0_8px_rgba(var(--primary),0.3)] ring-1 ring-primary/40"
          : "border-border/40 hover:border-border/60"
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-base font-medium text-foreground/70 tracking-wide">
          {label}
        </span>
        <span className="font-[math] text-sm font-bold text-primary/70">
          {value}
        </span>
      </div>

      {mathLine && (
        <div className="font-[math] text-sm md:text-base font-semibold flex items-center justify-center whitespace-nowrap pt-0.5">
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
  if (!label) return <span className="px-0.5 mx-0.5">{val}</span>;
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center justify-end px-0.5 mx-0.5 relative top-[3px]",
        highlight && "text-primary font-bold"
      )}
    >
      <span className="text-base leading-none">{val}</span>
      <span className="text-xs text-muted-foreground opacity-80 mt-1 font-sans leading-none tracking-tight">
        {label}
      </span>
    </span>
  );
}

function Op({ char = "×" }: { char?: string }) {
  return (
    <div className="flex h-16 items-center justify-center font-[math] text-muted-foreground opacity-60 text-lg px-2 shrink-0">
      {char}
    </div>
  );
}

function MathOp({ char = "×" }: { char?: string }) {
  return <span className="font-[math] px-0.5 mx-0.5">{char}</span>;
}

// ─── Computational Helpers ───

function getEmBonus(em: number, emCoeff: number): number {
  const denominator = emCoeff === 2.78 ? 1400 : 2000;
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
            <MathVar val={fmtPercent(p.scalingMulti[i] ?? 0)} label="Mult" />
            {i < p.scalingKeys.length - 1 && <MathOp char="+" />}
          </span>
        );
      })}
    </span>
  );

  return (
    <MathZone
      label="Base"
      value={Math.round(val).toLocaleString()}
      mathLine={mathLine}
      highlight={isHl}
    />
  );
}

function BaseBonusZone({ p, hl }: { p: DisplayPart; hl: StatKey | null }) {
  const bp = p.statValues["baseDmg%"] || 0;
  if (!bp) return null;
  return (
    <>
      <Op />
      <MathZone
        label="BaseBonus"
        value={fmtPercent(1 + bp)}
        mathLine={
          <span className="flex items-center">
            <MathVar val={1} label="" /> <MathOp char="+" />
            <MathVar
              val={fmtPercent(bp)}
              label="DMG%"
              highlight={hl === "baseDmg%"}
            />
          </span>
        }
      />
    </>
  );
}

function FlatBonusZone({ p, hl }: { p: DisplayPart; hl: StatKey | null }) {
  const fb = p.statValues.baseDmg || 0;
  if (!fb) return null;
  return (
    <>
      <Op char="+" />
      <MathZone
        label="Flat"
        value={Math.round(fb).toLocaleString()}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={Math.round(fb).toLocaleString()}
              label="Add"
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
}: {
  p: DisplayPart;
  hl: StatKey | null;
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
      label="Additive"
      value={Math.round(val).toLocaleString()}
      mathLine={
        <span className="flex items-center">
          <MathVar
            val={Math.round(levelMult).toLocaleString()}
            label="LvMult"
          />
          <MathOp />
          <MathVar val={reactBase} label="RxnBase" />
          <MathOp /> (
          <MathVar val={1} label="" /> <MathOp char="+" />
          <MathVar
            val={fmtPercent(emBonus)}
            label="EMBonus"
            highlight={hl === "em"}
          />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(reactDmg)}
            label="Rxn%"
            highlight={hl === "reactionDmg%"}
          />
          )
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
      {hasBaseBonus && <BaseBonusZone p={p} hl={hl} />}
      {isCatalyze && (
        <>
          <Op char="+" />
          <CatalyzeAdditiveZone p={p} hl={hl} />
        </>
      )}
      {hasFlatBonus && <FlatBonusZone p={p} hl={hl} />}
    </>
  );

  if (!needsGrouping) return content;

  return (
    <div className="flex h-[72px] items-center mx-1 bg-black/5 border border-border/20 px-1 rounded-md">
      <span className="font-[math] text-muted-foreground mr-1 opacity-60 text-xl font-light">
        (
      </span>
      {content}
      <span className="font-[math] text-muted-foreground ml-1 opacity-60 text-xl font-light">
        )
      </span>
    </div>
  );
}

function ReactionBonusZone({
  p,
  hl,
  label = "EM / Rxn%",
}: {
  p: DisplayPart;
  hl: StatKey | null;
  label?: string;
}) {
  const em = p.statValues.em || 0;
  const emCoeff = p.params.emCoeff || 0;
  const emBonus = getEmBonus(em, emCoeff);
  const reactDmg = p.statValues["reactionDmg%"] || 0;

  return (
    <MathZone
      label={label}
      value={fmtPercent(1 + emBonus + reactDmg)}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" /> <MathOp char="+" />
          <MathVar
            val={fmtPercent(emBonus)}
            label="EMBonus"
            highlight={hl === "em"}
          />
          <MathOp char="+" />
          <MathVar
            val={fmtPercent(reactDmg)}
            label="Rxn%"
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
}: {
  p: DisplayPart;
  hl: StatKey | null;
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
      label="DMG Bonus"
      value={fmtPercent(total, true)}
      mathLine={
        <span className="flex items-center">
          <MathVar val={1} label="" /> <MathOp char="+" />
          <MathVar
            val={fmtPercent(elementDmg + dmgBonus)}
            label="DMG%"
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
}: {
  p: DisplayPart;
  hl: StatKey | null;
}) {
  const charLevel = p.params.charLevel || 90;
  const enemyLevel = p.params.enemyLevel || 90;
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
    cr > 0 || cd > 0 ? (assumeCrit ? 1 + cd : 1 + Math.min(cr, 1) * cd) : 1;

  return (
    <>
      <MathZone
        label="DEF"
        value={fmtPercent(defMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar val={charLevel + 100} label="Char" />
            <MathOp char="/" />
            (
            <MathVar val={charLevel + 100} label="Char" />
            <MathOp char="+" />
            <MathVar val={enemyLevel + 100} label="Enemy" />
            <MathOp char="×" />
            <MathVar
              val={fmtPercent((1 - defReduc) * (1 - defIgnore))}
              label="DefFactor"
              highlight={hl === "defReduction%" || hl === "defIgnore%"}
            />
            )
          </span>
        }
      />
      <Op />
      <MathZone
        label="RES"
        value={fmtPercent(resMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={fmtPercent(effRes)}
              label="Target"
              highlight={hl === "resReduction%"}
            />
          </span>
        }
      />
      <Op />
      <MathZone
        label="CRIT"
        value={fmtPercent(critMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar val={1} label="" /> <MathOp char="+" /> (
            <MathVar
              val={fmtPercent(Math.min(cr, 1))}
              label="CR"
              highlight={hl === "cr" || hl === "reactionCr"}
            />{" "}
            <MathOp />{" "}
            <MathVar
              val={fmtPercent(cd)}
              label="CD"
              highlight={hl === "cd" || hl === "reactionCd"}
            />
            )
          </span>
        }
      />
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
      <DmgBonusZone p={p} hl={hl} />
      <Op />
      <CommonMultipliers p={p} hl={hl} />
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
      <DmgBonusZone p={p} hl={hl} />
      <Op />
      <CommonMultipliers p={p} hl={hl} />
      <Op />
      <MathZone
        label="AMP"
        value={fmtPercent(
          (p.params.reactionCoeff || 1) *
            (1 +
              getEmBonus(p.statValues.em || 0, p.params.emCoeff || 2.78) +
              (p.statValues["reactionDmg%"] || 0))
        )}
        mathLine={
          <span className="flex items-center">
            <MathVar val={p.params.reactionCoeff} label="Base" /> <MathOp /> (
            <MathVar val={1} label="" /> <MathOp char="+" />{" "}
            <MathVar
              val={fmtPercent(
                getEmBonus(p.statValues.em || 0, p.params.emCoeff || 2.78)
              )}
              label="EMBonus"
              highlight={hl === "em"}
            />{" "}
            <MathOp char="+" />{" "}
            <MathVar
              val={fmtPercent(p.statValues["reactionDmg%"] || 0)}
              label="Rxn%"
              highlight={hl === "reactionDmg%"}
            />
            )
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
      <DmgBonusZone p={p} hl={hl} />
      <Op />
      <CommonMultipliers p={p} hl={hl} />
    </>
  );
}

function TransformEq({ p, hl }: { p: DisplayPart; hl: StatKey | null }) {
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;
  const baseDmg = levelMult * reactBase;

  const resReduc = p.statValues["resReduction%"] || 0;
  const enemyRes = p.params.enemyRes || 0.1;
  const effRes = enemyRes - resReduc;
  let resMult = 1;
  if (effRes < 0) resMult = 1 - effRes / 2;
  else if (effRes <= 0.75) resMult = 1 - effRes;
  else resMult = 1 / (1 + 4 * effRes);

  const cr = p.statValues.reactionCr || 0;
  const cd = p.statValues.reactionCd || 0;
  const assumeCrit = p.params.assumeCrit === 1;
  const critMult =
    cr > 0 || cd > 0 ? (assumeCrit ? 1 + cd : 1 + Math.min(cr, 1) * cd) : 1;

  return (
    <>
      <MathZone
        label="BaseRxn"
        value={Math.round(baseDmg).toLocaleString()}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={Math.round(levelMult).toLocaleString()}
              label="LvMult"
            />{" "}
            <MathOp /> <MathVar val={reactBase} label="RxnBase" />
          </span>
        }
      />
      <Op />
      <ReactionBonusZone p={p} hl={hl} />
      <Op />
      <MathZone
        label="RES"
        value={fmtPercent(resMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={fmtPercent(effRes)}
              label="Target"
              highlight={hl === "resReduction%"}
            />
          </span>
        }
      />
      {(cr > 0 || cd > 0) && (
        <>
          <Op />
          <MathZone
            label="CRIT"
            value={fmtPercent(critMult)}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" /> <MathOp char="+" /> (
                <MathVar
                  val={fmtPercent(Math.min(cr, 1))}
                  label="CR"
                  highlight={hl === "reactionCr"}
                />{" "}
                <MathOp />{" "}
                <MathVar
                  val={fmtPercent(cd)}
                  label="CD"
                  highlight={hl === "reactionCd"}
                />
                )
              </span>
            }
          />
        </>
      )}
    </>
  );
}

function LunarEq({ p, hl }: { p: DisplayPart; hl: StatKey | null }) {
  const levelMult = p.params.levelCoeff || 0;
  const reactBase = p.params.reactionCoeff || 0;
  const baseDmg = levelMult * reactBase;

  const resReduc = p.statValues["resReduction%"] || 0;
  const enemyRes = p.params.enemyRes || 0.1;
  const effRes = enemyRes - resReduc;
  let resMult = 1;
  if (effRes < 0) resMult = 1 - effRes / 2;
  else if (effRes <= 0.75) resMult = 1 - effRes;
  else resMult = 1 / (1 + 4 * effRes);

  const cr = p.statValues.cr || 0;
  const cd = p.statValues.cd || 0;
  const assumeCrit = p.params.assumeCrit === 1;
  const critMult =
    cr > 0 || cd > 0 ? (assumeCrit ? 1 + cd : 1 + Math.min(cr, 1) * cd) : 1;

  const bdp = p.statValues["baseDmg%"] || 0;
  const elv = p.statValues["elevated%"] || 0;

  return (
    <>
      <MathZone
        label="BaseRxn"
        value={Math.round(baseDmg).toLocaleString()}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={Math.round(levelMult).toLocaleString()}
              label="LvMult"
            />{" "}
            <MathOp /> <MathVar val={reactBase} label="RxnBase" />
          </span>
        }
      />
      <Op />
      <ReactionBonusZone p={p} hl={hl} />
      <Op />
      {bdp ? (
        <>
          <MathZone
            label="BaseDMG%"
            value={fmtPercent(1 + bdp)}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" /> <MathOp char="+" />{" "}
                <MathVar
                  val={fmtPercent(bdp)}
                  label="DMG%"
                  highlight={hl === "baseDmg%"}
                />
              </span>
            }
          />
          <Op />
        </>
      ) : null}
      {elv ? (
        <>
          <MathZone
            label="Elevated"
            value={fmtPercent(1 + elv)}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" /> <MathOp char="+" />{" "}
                <MathVar
                  val={fmtPercent(elv)}
                  label="Elevated"
                  highlight={hl === "elevated%"}
                />
              </span>
            }
          />
          <Op />
        </>
      ) : null}
      <MathZone
        label="RES"
        value={fmtPercent(resMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={fmtPercent(effRes)}
              label="Target"
              highlight={hl === "resReduction%"}
            />
          </span>
        }
      />
      <Op />
      <MathZone
        label="CRIT"
        value={fmtPercent(critMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar val={1} label="" /> <MathOp char="+" /> (
            <MathVar
              val={fmtPercent(Math.min(cr, 1))}
              label="CR"
              highlight={hl === "cr"}
            />{" "}
            <MathOp />{" "}
            <MathVar val={fmtPercent(cd)} label="CD" highlight={hl === "cd"} />)
          </span>
        }
      />
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

  const content = (
    <>
      <ScalingZone p={p} hl={hl} t={t} />
      <Op />
      <MathZone label="DirectCoeff" value={p.params.directCoeff} />
      {hasBaseBonus && <BaseBonusZone p={p} hl={hl} />}
      <Op />
      <ReactionBonusZone p={p} hl={hl} label="Lunar Dmg%" />
      {hasFlatBonus && <FlatBonusZone p={p} hl={hl} />}
    </>
  );

  return (
    <div className="flex h-[72px] items-center mx-1 bg-black/5 border border-border/20 px-1 rounded-md">
      <span className="font-[math] text-muted-foreground mr-1 opacity-60 text-xl font-light">
        (
      </span>
      {content}
      <span className="font-[math] text-muted-foreground ml-1 opacity-60 text-xl font-light">
        )
      </span>
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
  const elv = p.statValues["elevated%"] || 0;

  const resReduc = p.statValues["resReduction%"] || 0;
  const enemyRes = p.params.enemyRes || 0.1;
  const effRes = enemyRes - resReduc;
  let resMult = 1;
  if (effRes < 0) resMult = 1 - effRes / 2;
  else if (effRes <= 0.75) resMult = 1 - effRes;
  else resMult = 1 / (1 + 4 * effRes);

  const cr = p.statValues.cr || 0;
  const cd = p.statValues.cd || 0;
  const assumeCrit = p.params.assumeCrit === 1;
  const critMult =
    cr > 0 || cd > 0 ? (assumeCrit ? 1 + cd : 1 + Math.min(cr, 1) * cd) : 1;

  return (
    <>
      <LunarDirectGroup p={p} hl={hl} t={t} />
      <Op />
      {elv ? (
        <>
          <MathZone
            label="Elevated"
            value={fmtPercent(1 + elv)}
            mathLine={
              <span className="flex items-center">
                <MathVar val={1} label="" /> <MathOp char="+" />{" "}
                <MathVar
                  val={fmtPercent(elv)}
                  label="Elevated"
                  highlight={hl === "elevated%"}
                />
              </span>
            }
          />
          <Op />
        </>
      ) : null}
      <MathZone
        label="RES"
        value={fmtPercent(resMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar
              val={fmtPercent(effRes)}
              label="Target"
              highlight={hl === "resReduction%"}
            />
          </span>
        }
      />
      <Op />
      <MathZone
        label="CRIT"
        value={fmtPercent(critMult)}
        mathLine={
          <span className="flex items-center">
            <MathVar val={1} label="" /> <MathOp char="+" /> (
            <MathVar
              val={fmtPercent(Math.min(cr, 1))}
              label="CR"
              highlight={hl === "cr"}
            />{" "}
            <MathOp />{" "}
            <MathVar val={fmtPercent(cd)} label="CD" highlight={hl === "cd"} />)
          </span>
        }
      />
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

const TEMPLATE_NAMES: Record<FormulaTemplate, string> = {
  direct: "Direct Damage",
  amplify: "Amplifying Reaction",
  catalyze: "Additive Reaction",
  transform: "Transformative Reaction",
  lunar: "Lunar Reaction",
  lunarDirect: "Lunar Direct",
};

// ─── Main Component ───

export function FormulaBreakdown({ parts, highlightedStat, t }: Props) {
  return (
    <div className="flex flex-col gap-4 py-2">
      {parts.map((p, idx) => {
        const Renderer = RENDERERS[p.template];
        return (
          <div
            key={idx}
            className="flex justify-center overflow-x-auto scrollbar-none py-1.5 px-0.5 pb-2"
          >
            <div className="flex items-center min-w-max">
              <Renderer p={p} hl={highlightedStat} t={t} />
              <div className="flex px-2 shrink-0 h-16 items-center">
                <Op char="=" />
              </div>
              <div className="flex flex-col items-center justify-between gap-2 bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg">
                <span className="text-sm text-primary/70 tracking-wide leading-none opacity-80 whitespace-nowrap">
                  {TEMPLATE_NAMES[p.template]}{" "}
                  {parts.length > 1 ? `(#${idx + 1})` : ""}
                </span>
                <span className="font-[math] text-xl md:text-2xl font-black text-foreground">
                  {fmtDamage(p.damage)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
