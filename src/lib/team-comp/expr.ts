/**
 * AST-based expression library for compiled damage formulas.
 *
 * Provides an expression tree (Expr) where inputs are artifact stat
 * contributions as a Float64Array. All pre-artifact stats/buffs are
 * baked in as constants. After constant folding, the compiled form
 * evaluates in ~20-50 arithmetic ops with zero allocations.
 */

// ─── Expr Types ───

export type Expr =
  | { tag: "const"; value: number }
  | { tag: "var"; idx: number; name: string }
  | { tag: "add"; children: Expr[] }
  | { tag: "mul"; children: Expr[] }
  | { tag: "div"; a: Expr; b: Expr }
  | { tag: "min"; a: Expr; b: Expr }
  | { tag: "max"; a: Expr; b: Expr };

// ─── Constructors ───

export const E = {
  const(n: number): Expr {
    return { tag: "const", value: n };
  },

  var(idx: number, name: string): Expr {
    return { tag: "var", idx, name };
  },

  add(...exprs: Expr[]): Expr {
    // Flatten nested adds
    const flat: Expr[] = [];
    for (const e of exprs) {
      if (e.tag === "add") {
        flat.push(...e.children);
      } else {
        flat.push(e);
      }
    }
    if (flat.length === 0) return E.const(0);
    if (flat.length === 1) return flat[0];
    return { tag: "add", children: flat };
  },

  mul(...exprs: Expr[]): Expr {
    // Flatten nested muls
    const flat: Expr[] = [];
    for (const e of exprs) {
      if (e.tag === "mul") {
        flat.push(...e.children);
      } else {
        flat.push(e);
      }
    }
    if (flat.length === 0) return E.const(1);
    if (flat.length === 1) return flat[0];
    return { tag: "mul", children: flat };
  },

  div(a: Expr, b: Expr): Expr {
    return { tag: "div", a, b };
  },

  min(a: Expr, b: Expr): Expr {
    return { tag: "min", a, b };
  },

  max(a: Expr, b: Expr): Expr {
    return { tag: "max", a, b };
  },

  /** Convenience: clamp(x, lo, hi) = min(max(x, lo), hi) */
  clamp(x: Expr, lo: Expr, hi: Expr): Expr {
    return E.min(E.max(x, lo), hi);
  },

  /** Convenience: addScaled(base, delta, scale) = base + delta * scale */
  addScaled(base: Expr, delta: Expr, scale: number): Expr {
    return E.add(base, E.mul(delta, E.const(scale)));
  },

  /** Convenience: sum of product pairs */
  dot(as: Expr[], bs: Expr[]): Expr {
    return E.add(...as.map((a, i) => E.mul(a, bs[i])));
  },
} as const;

// ─── Tree-walk Evaluator ───

export function evaluate(e: Expr, vars: Float64Array): number {
  switch (e.tag) {
    case "const":
      return e.value;
    case "var":
      return vars[e.idx];
    case "add": {
      let sum = 0;
      for (const c of e.children) sum += evaluate(c, vars);
      return sum;
    }
    case "mul": {
      let prod = 1;
      for (const c of e.children) prod *= evaluate(c, vars);
      return prod;
    }
    case "div":
      return evaluate(e.a, vars) / evaluate(e.b, vars);
    case "min":
      return Math.min(evaluate(e.a, vars), evaluate(e.b, vars));
    case "max":
      return Math.max(evaluate(e.a, vars), evaluate(e.b, vars));
  }
}

// ─── Expression identity key (structural) ───

/**
 * Compute a structural key for an expression (ignoring const values).
 * Two expressions with the same key are structurally identical.
 * Used for factoring common sub-expressions.
 */
function exprKey(e: Expr): string {
  switch (e.tag) {
    case "const":
      return `C${e.value}`;
    case "var":
      return `V${e.idx}`;
    case "add":
      return `(${e.children.map(exprKey).join("+")})`;
    case "mul":
      return `(${e.children.map(exprKey).join("*")})`;
    case "div":
      return `(${exprKey(e.a)}/${exprKey(e.b)})`;
    case "min":
      return `min(${exprKey(e.a)},${exprKey(e.b)})`;
    case "max":
      return `max(${exprKey(e.a)},${exprKey(e.b)})`;
  }
}

/**
 * Given an add's children (already simplified), try to factor out a common
 * sub-expression from mul terms.
 *
 * Example: a*X*Y + b*X*Z → X * (a*Y + b*Z)
 *
 * Returns a simplified factored expression, or null if no factoring found.
 */
function factorCommon(children: Expr[]): Expr | null {
  // Normalize: represent each child as a list of multiplicative factors
  const terms: { factors: Map<string, Expr>; constFactor: number }[] = [];
  for (const child of children) {
    const factors = new Map<string, Expr>();
    let constFactor = 1;
    if (child.tag === "mul") {
      for (const f of child.children) {
        if (f.tag === "const") {
          constFactor *= f.value;
        } else {
          const k = exprKey(f);
          factors.set(k, f);
        }
      }
    } else if (child.tag === "const") {
      constFactor = child.value;
    } else {
      factors.set(exprKey(child), child);
    }
    terms.push({ factors, constFactor });
  }

  if (terms.length < 2) return null;

  // Find factor keys present in ALL terms
  const firstKeys = terms[0].factors;
  const commonKeys: string[] = [];
  for (const k of firstKeys.keys()) {
    if (terms.every((t) => t.factors.has(k))) {
      commonKeys.push(k);
    }
  }

  if (commonKeys.length === 0) return null;

  // Extract common factors and build remainders
  const commonExprs: Expr[] = commonKeys.map((k) => firstKeys.get(k)!);
  const remainders: Expr[] = [];
  for (const term of terms) {
    const remaining: Expr[] = [];
    if (term.constFactor !== 1) remaining.push(E.const(term.constFactor));
    for (const [k, expr] of term.factors) {
      if (!commonKeys.includes(k)) {
        remaining.push(expr);
      }
    }
    if (remaining.length === 0) {
      remainders.push(E.const(1));
    } else if (remaining.length === 1) {
      remainders.push(remaining[0]);
    } else {
      remainders.push({ tag: "mul", children: remaining });
    }
  }

  // Result: commonExprs * sum(remainders)
  const sum =
    remainders.length === 1 ? remainders[0] : { tag: "add" as const, children: remainders };
  return simplify(E.mul(...commonExprs, sum));
}

// ─── Simplification (constant folding + identity elimination) ───

export function simplify(e: Expr): Expr {
  switch (e.tag) {
    case "const":
    case "var":
      return e;

    case "add": {
      const simplified = e.children.map(simplify);
      // Re-flatten after simplification
      const flat: Expr[] = [];
      let constSum = 0;
      for (const c of simplified) {
        if (c.tag === "const") {
          constSum += c.value;
        } else if (c.tag === "add") {
          flat.push(...c.children);
        } else {
          flat.push(c);
        }
      }
      if (constSum !== 0) flat.push(E.const(constSum));
      if (flat.length === 0) return E.const(0);
      if (flat.length === 1) return flat[0];

      // Factor out common sub-expressions from mul children:
      // a*X + b*X + c → (a + b + c) * X where X is a common factor
      const factored = factorCommon(flat);
      if (factored) return factored;

      return { tag: "add", children: flat };
    }

    case "mul": {
      const simplified = e.children.map(simplify);
      const flat: Expr[] = [];
      let constProd = 1;
      for (const c of simplified) {
        if (c.tag === "const") {
          if (c.value === 0) return E.const(0); // 0 × anything = 0
          constProd *= c.value;
        } else if (c.tag === "mul") {
          flat.push(...c.children);
        } else {
          flat.push(c);
        }
      }
      if (constProd !== 1) flat.push(E.const(constProd));
      if (flat.length === 0) return E.const(constProd);
      if (flat.length === 1) return flat[0];
      return { tag: "mul", children: flat };
    }

    case "div": {
      const a = simplify(e.a);
      const b = simplify(e.b);
      if (a.tag === "const" && b.tag === "const") {
        return E.const(a.value / b.value);
      }
      // 0 / x = 0
      if (a.tag === "const" && a.value === 0) return E.const(0);
      // x / 1 = x
      if (b.tag === "const" && b.value === 1) return a;
      return { tag: "div", a, b };
    }

    case "min": {
      const a = simplify(e.a);
      const b = simplify(e.b);
      if (a.tag === "const" && b.tag === "const") {
        return E.const(Math.min(a.value, b.value));
      }
      return { tag: "min", a, b };
    }

    case "max": {
      const a = simplify(e.a);
      const b = simplify(e.b);
      if (a.tag === "const" && b.tag === "const") {
        return E.const(Math.max(a.value, b.value));
      }
      return { tag: "max", a, b };
    }
  }
}

// ─── Symbolic Differentiation ───

/**
 * Symbolic differentiation of an expression with respect to variable `varIdx`.
 * min/max are treated as piecewise: d/dx min(a,b) = da if a<b, db if b<a.
 * For simplicity, we return the derivative of the first argument (a) when
 * neither can be statically determined smaller — this is safe for our use case
 * where min/max typically have one constant argument.
 */
export function differentiate(e: Expr, varIdx: number): Expr {
  switch (e.tag) {
    case "const":
      return E.const(0);
    case "var":
      return E.const(e.idx === varIdx ? 1 : 0);

    case "add":
      return simplify(E.add(...e.children.map((c) => differentiate(c, varIdx))));

    case "mul": {
      // Product rule generalized: d/dx (a*b*c*...) = sum_i (prod_{j!=i} x_j) * dx_i
      const n = e.children.length;
      const terms: Expr[] = [];
      for (let i = 0; i < n; i++) {
        const di = differentiate(e.children[i], varIdx);
        const diSimp = simplify(di);
        // Skip zero terms early
        if (diSimp.tag === "const" && diSimp.value === 0) continue;
        const others = e.children.filter((_, j) => j !== i);
        terms.push(E.mul(diSimp, ...others));
      }
      if (terms.length === 0) return E.const(0);
      return simplify(E.add(...terms));
    }

    case "div": {
      // Quotient rule: (a'b - ab') / b²
      const da = differentiate(e.a, varIdx);
      const db = differentiate(e.b, varIdx);
      const dbSimp = simplify(db);
      // If denominator is constant, simplify: a'/b
      if (dbSimp.tag === "const" && dbSimp.value === 0) {
        return simplify(E.div(da, e.b));
      }
      return simplify(
        E.div(
          E.add(E.mul(da, e.b), E.mul(E.const(-1), e.a, db)),
          E.mul(e.b, e.b)
        )
      );
    }

    case "min":
    case "max": {
      // Piecewise: if one arg is const, differentiate the other
      if (e.a.tag === "const") return differentiate(e.b, varIdx);
      if (e.b.tag === "const") return differentiate(e.a, varIdx);
      // Fallback: differentiate first argument
      return differentiate(e.a, varIdx);
    }
  }
}

// ─── Codegen via new Function() ───

/**
 * Compile an expression tree into a native JS function via `new Function()`.
 * The generated function takes a Float64Array and returns a number.
 * V8's TurboFan / SpiderMonkey's Warp will JIT-optimize this to near-native
 * straight-line arithmetic with no virtual dispatch or object allocation.
 */
export function compileExpr(e: Expr): (vars: Float64Array) => number {
  const body = "return " + emitJs(e) + ";";
  return new Function("v", body) as (vars: Float64Array) => number;
}

function emitJs(e: Expr): string {
  switch (e.tag) {
    case "const": {
      // Use full precision for constants
      if (e.value < 0) return `(${e.value})`;
      return `${e.value}`;
    }
    case "var":
      return `v[${e.idx}]`;
    case "add": {
      const parts = e.children.map(emitJs);
      return `(${parts.join("+")})`;
    }
    case "mul": {
      const parts = e.children.map(emitJs);
      return `(${parts.join("*")})`;
    }
    case "div":
      return `(${emitJs(e.a)}/${emitJs(e.b)})`;
    case "min":
      return `Math.min(${emitJs(e.a)},${emitJs(e.b)})`;
    case "max":
      return `Math.max(${emitJs(e.a)},${emitJs(e.b)})`;
  }
}

// ─── Utilities ───

/** Count the number of unique variable indices referenced in an expression. */
export function countVars(e: Expr): Set<number> {
  const vars = new Set<number>();
  function walk(node: Expr): void {
    switch (node.tag) {
      case "const":
        break;
      case "var":
        vars.add(node.idx);
        break;
      case "add":
      case "mul":
        for (const c of node.children) walk(c);
        break;
      case "div":
      case "min":
      case "max":
        walk(node.a);
        walk(node.b);
        break;
    }
  }
  walk(e);
  return vars;
}

/** Check if an expression is a constant (no variables). */
export function isConst(e: Expr): e is { tag: "const"; value: number } {
  return e.tag === "const";
}

/** Get the constant value of an expression, or undefined if not constant. */
export function constValue(e: Expr): number | undefined {
  if (e.tag === "const") return e.value;
  return undefined;
}
