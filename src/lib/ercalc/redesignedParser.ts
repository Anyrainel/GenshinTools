import type {
  ProbProbability,
  RedesignedCharTiming,
  RedesignedInput,
  RedesignedParticles,
} from "./types";

function evalTime(val: string): number {
  val = val.trim();
  if (val.includes("/")) {
    const parts = val.split("/");
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
      return num / den;
    }
  }
  const parsed = Number(val);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function splitByComma(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let parenDepth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "(" || char === "（") {
      parenDepth++;
    } else if (char === ")" || char === "）") {
      parenDepth--;
    }
    if ((char === "," || char === "，") && parenDepth === 0) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    result.push(current);
  }
  return result;
}

export function parseRedesignedInput(text: string): RedesignedInput {
  const result: RedesignedInput = {
    raw: text,
    charOrders: [],
    burstRequirements: {},
    axisLengths: [24, 20], // default
    actionSequence: "",
    actionCosts: { Q: 1.0, E: 1.0, A: 0.8 },
    elements: {},
    particles: {},
    recoveries: {},
  };

  const lines = text.split(/\r?\n/);

  let inTimingTable = false;
  const customTiming: RedesignedCharTiming[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. Team N
    if (line.match(/^N\s*[:=]/i) || line.startsWith("【队伍编码")) {
      const content = line
        .substring(
          line.indexOf("=") !== -1
            ? line.indexOf("=") + 1
            : line.indexOf("N") + 1
        )
        .trim();
      const cleaned = content.replace(/^[｛{]/, "").replace(/[｝}]$/, "");
      const items = splitByComma(cleaned);
      for (const item of items) {
        const trimmed = item.trim();
        if (!trimmed) continue;
        const match = trimmed.match(
          /^(\d+)([^\d(（]+)(?:[(（](\d+)[,，](\d+)[)）]|(\d+))?$/
        );
        if (match) {
          const digits = match[1];
          const name = match[2].trim();
          result.charOrders.push(name);
          if (digits.length === 1) {
            const cost = match[5] !== undefined ? Number(match[5]) : 60;
            result.burstRequirements[name] = {
              type: "regular",
              raw: trimmed,
              regularCost: cost,
            };
          } else if (digits.length >= 2) {
            const fixedCount = Number(digits[0]);
            const interval = Number(digits.slice(1));
            const fixedCost = match[3] !== undefined ? Number(match[3]) : 0;
            const additionalCost =
              match[4] !== undefined ? Number(match[4]) : 0;
            result.burstRequirements[name] = {
              type: "special",
              raw: trimmed,
              specialFixedCount: fixedCount,
              specialFixedCost: fixedCost,
              specialInterval: interval,
              specialAdditionalCost: additionalCost,
            };
          }
        }
      }
      continue;
    }

    // 2. Axis Lengths C
    if (line.match(/^C\s*[:=]/i) || line.startsWith("【轴长")) {
      const content = line
        .substring(
          line.indexOf("=") !== -1
            ? line.indexOf("=") + 1
            : line.indexOf("C") + 1
        )
        .trim();
      const cleaned = content.replace(/^[｛{]/, "").replace(/[｝}]$/, "");
      const nums = cleaned.match(/[\d.]+/g)?.map(Number) ?? [];
      if (nums.length > 0) {
        result.axisLengths = nums.length === 1 ? [nums[0], nums[0]] : nums;
      }
      continue;
    }

    // 3. Action Sequence P
    if (line.match(/^P\s*[:=]/i) || line.startsWith("【动作序列")) {
      const content = line
        .substring(
          line.indexOf("=") !== -1
            ? line.indexOf("=") + 1
            : line.indexOf("P") + 1
        )
        .trim();
      const cleaned = content
        .replace(/^[｛{]/, "")
        .replace(/[｝}]$/, "")
        .replace(/\s+/g, "");
      result.actionSequence = cleaned;
      continue;
    }

    // 4. Action Costs t_i
    if (line.match(/^t_i\s*[:=]/i) || line.startsWith("【动作耗时")) {
      const content = line
        .substring(
          line.indexOf("=") !== -1
            ? line.indexOf("=") + 1
            : line.indexOf("t_i") + 1
        )
        .trim();
      const cleaned = content.replace(/^[｛{]/, "").replace(/[｝}]$/, "");
      const qMatch = cleaned.match(/t_Q\s*=\s*([\d.]+)/i);
      const eMatch = cleaned.match(/t_E\s*=\s*([\d.]+)/i);
      const aMatch = cleaned.match(/t_A\s*=\s*([\d.]+)/i);
      if (qMatch) result.actionCosts.Q = Number(qMatch[1]);
      if (eMatch) result.actionCosts.E = Number(eMatch[1]);
      if (aMatch) result.actionCosts.A = Number(aMatch[1]);
      continue;
    }

    // 5. Custom Timing Table
    if (line.startsWith("【角色时序表】")) {
      inTimingTable = true;
      continue;
    }
    if (inTimingTable) {
      if (line.startsWith("【") || line.includes("：") || line.includes(":")) {
        inTimingTable = false; // exit table
      } else {
        const parts = line.split(/[,，]/);
        if (parts.length >= 5) {
          const name = parts[0].trim();
          const element = parts[1].trim();
          const actionCount = Number(parts[2].trim());
          const tIn = evalTime(parts[3]);
          const tOut = evalTime(parts[4]);
          customTiming.push({ name, element, actionCount, tIn, tOut });
          continue;
        }
      }
    }

    // 6. Elements mapping
    if (line.startsWith("元素属性：") || line.startsWith("元素属性:")) {
      const content = line
        .substring(
          line.indexOf("：") !== -1
            ? line.indexOf("：") + 1
            : line.indexOf(":") + 1
        )
        .trim();
      const items = content.split(/[,，]/);
      for (const item of items) {
        const m = item.trim().match(/^([^\s(（]+)[(（]([^)）]+)[)）]$/);
        if (m) {
          result.elements[m[1].trim()] = m[2].trim();
        }
      }
      continue;
    }

    // 7. Particles Config
    if (
      line.includes("元素微粒") &&
      !line.includes("：") &&
      !line.includes(":")
    ) {
      continue;
    }
    const particleMatch = line.match(/^([^：:]+)\s*[:：]\s*(.*)$/);
    if (particleMatch && result.charOrders.includes(particleMatch[1].trim())) {
      const name = particleMatch[1].trim();
      const content = particleMatch[2].trim();
      if (
        content.includes("δ=") ||
        content.includes("Tprod=") ||
        content.includes("e0=") ||
        content.includes("e₀=")
      ) {
        const deltaMatch = content.match(/(?:δ|d|delta)\s*=\s*([\d.]+)/i);
        const tProdMatch = content.match(/(?:Tprod|tprod)\s*=\s*([\d.]+)/i);
        const e0Match = content.match(/(?:e₀|e0)\s*=\s*([^{\s,，]+|{.*})/i);

        const delta = deltaMatch ? Number(deltaMatch[1]) : 1.0;
        const tProd = tProdMatch ? Number(tProdMatch[1]) : 0.0;
        let e0: RedesignedParticles = 1.0;

        if (e0Match) {
          const e0Str = e0Match[1].trim();
          if (e0Str.startsWith("{") && e0Str.endsWith("}")) {
            const probParts = e0Str
              .substring(1, e0Str.length - 1)
              .split(/[,，]/);
            const probs: ProbProbability[] = [];
            for (const p of probParts) {
              const m = p.trim().match(/^([\d.]+)\(([\d.]+)\)$/);
              if (m) {
                probs.push({ value: Number(m[1]), prob: Number(m[2]) });
              }
            }
            e0 = probs;
          } else {
            e0 = Number(e0Str);
          }
        }

        result.particles[name] = { delta, tProd, e0 };
      }
    }
  }

  // Parse periodic recoveries
  const recoverySectionIndex = text.indexOf("周期性回复");
  if (recoverySectionIndex !== -1) {
    const recoveryText = text.substring(recoverySectionIndex);
    const recLines = recoveryText.split(/\r?\n/);
    let currentChar: string | null = null;
    let expectedTuples = 0;

    for (const rLine of recLines) {
      const line = rLine.trim();
      if (!line) continue;
      if (line.startsWith("周期性回复")) continue;

      const m = line.match(/^([^：:]+)\s*[:：]\s*(.*)$/);
      let isCharLine = false;
      let matchedNames: string[] = [];
      if (m) {
        const names = m[1].split(/[,，、]/).map((n) => n.trim());
        matchedNames = names.filter((n) => result.charOrders.includes(n));
        if (matchedNames.length > 0) {
          isCharLine = true;
        }
      }

      if (isCharLine && m) {
        const content = m[2].trim();
        if (content.includes("S=")) {
          const name = matchedNames[0]; // S= configs are per-character
          const S_match = content.match(/S\s*=\s*([\d.]+)/i);
          const n_match = content.match(/n\s*=\s*([\d.]+)/i);
          const d_match = content.match(/(?:d_in|din)\s*=\s*([\d.]+)/i);
          const V_match = content.match(/V\s*=\s*([\d.]+)/i);
          const P_match = content.match(/P\s*=\s*([\d.]+)/i);

          const S = S_match ? Number(S_match[1]) : 24.0;
          const nVal = n_match ? Number(n_match[1]) : 0;
          const dIn = d_match ? Number(d_match[1]) : 0.18;
          const V = V_match ? Number(V_match[1]) : 0;
          const P = P_match ? Number(P_match[1]) : 1;

          result.recoveries[name] = { S, n: nVal, dIn, V, P, tuples: [] };
          currentChar = name;
          expectedTuples = nVal;
        } else if (content.toLowerCase() === "无" || content === "无") {
          for (const name of matchedNames) {
            result.recoveries[name] = {
              S: 0,
              n: 0,
              dIn: 0.18,
              V: 0,
              P: 1,
              tuples: [],
            };
          }
          currentChar = null;
          expectedTuples = 0;
        }
      } else if (currentChar && expectedTuples > 0) {
        const cleanLine = line.includes(":")
          ? line.substring(line.indexOf(":") + 1)
          : line;
        const vals = cleanLine.split(/[,，]/).map(Number);
        if (vals.length >= 4) {
          result.recoveries[currentChar].tuples.push({
            a: vals[0],
            b: vals[1],
            lambda: vals[2],
            k: vals[3],
          });
          if (result.recoveries[currentChar].tuples.length >= expectedTuples) {
            currentChar = null;
            expectedTuples = 0;
          }
        }
      }
    }
  }

  // Populate elements from the elements object if it's there
  for (const name of result.charOrders) {
    if (!result.elements[name]) {
      result.elements[name] = "None";
    }
  }

  if (customTiming.length > 0) {
    result.customTiming = customTiming;
  }

  return result;
}
