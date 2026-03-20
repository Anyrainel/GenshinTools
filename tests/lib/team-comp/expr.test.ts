import { describe, expect, it } from "vitest";

import {
  E,
  type Expr,
  compileExpr,
  countVars,
  differentiate,
  evaluate,
  isConst,
  simplify,
} from "@/lib/team-comp/expr";

// ─── Helpers ───

function vars(...values: number[]): Float64Array {
  return new Float64Array(values);
}

function randomVars(n: number): Float64Array {
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.random() * 10;
  return v;
}

// ─── Evaluate ───

describe("evaluate", () => {
  it("evaluates const", () => {
    expect(evaluate(E.const(42), vars())).toBe(42);
  });

  it("evaluates var", () => {
    expect(evaluate(E.var(0, "x"), vars(7))).toBe(7);
    expect(evaluate(E.var(1, "y"), vars(3, 5))).toBe(5);
  });

  it("evaluates add", () => {
    const e = E.add(E.const(1), E.var(0, "x"), E.const(2));
    expect(evaluate(e, vars(10))).toBe(13);
  });

  it("evaluates mul", () => {
    const e = E.mul(E.const(3), E.var(0, "x"));
    expect(evaluate(e, vars(7))).toBe(21);
  });

  it("evaluates div", () => {
    const e = E.div(E.var(0, "a"), E.var(1, "b"));
    expect(evaluate(e, vars(10, 4))).toBe(2.5);
  });

  it("evaluates min", () => {
    const e = E.min(E.var(0, "x"), E.const(5));
    expect(evaluate(e, vars(3))).toBe(3);
    expect(evaluate(e, vars(8))).toBe(5);
  });

  it("evaluates max", () => {
    const e = E.max(E.var(0, "x"), E.const(0));
    expect(evaluate(e, vars(-2))).toBe(0);
    expect(evaluate(e, vars(3))).toBe(3);
  });

  it("evaluates nested expression", () => {
    // (x + 1) * (y - 2) where x=3, y=5 → 4 * 3 = 12
    const e = E.mul(
      E.add(E.var(0, "x"), E.const(1)),
      E.add(E.var(1, "y"), E.const(-2))
    );
    expect(evaluate(e, vars(3, 5))).toBe(12);
  });

  it("evaluates clamp", () => {
    const e = E.clamp(E.var(0, "x"), E.const(0), E.const(1));
    expect(evaluate(e, vars(-0.5))).toBe(0);
    expect(evaluate(e, vars(0.5))).toBe(0.5);
    expect(evaluate(e, vars(1.5))).toBe(1);
  });
});

// ─── Constructors (auto-flatten) ───

describe("constructors", () => {
  it("add flattens nested adds", () => {
    const inner = E.add(E.const(1), E.const(2));
    const outer = E.add(inner, E.const(3));
    expect(outer.tag === "add" && outer.children.length).toBe(3);
  });

  it("mul flattens nested muls", () => {
    const inner = E.mul(E.const(2), E.var(0, "x"));
    const outer = E.mul(inner, E.const(3));
    expect(outer.tag === "mul" && outer.children.length).toBe(3);
  });

  it("add with zero args returns const(0)", () => {
    expect(E.add()).toEqual(E.const(0));
  });

  it("mul with zero args returns const(1)", () => {
    expect(E.mul()).toEqual(E.const(1));
  });

  it("add with one arg returns that arg", () => {
    const x = E.var(0, "x");
    expect(E.add(x)).toBe(x);
  });

  it("mul with one arg returns that arg", () => {
    const x = E.var(0, "x");
    expect(E.mul(x)).toBe(x);
  });
});

// ─── Simplify ───

describe("simplify", () => {
  it("folds constant add", () => {
    const e = E.add(E.const(3), E.const(4));
    const s = simplify(e);
    expect(s).toEqual(E.const(7));
  });

  it("folds constant mul", () => {
    const e = E.mul(E.const(3), E.const(4));
    const s = simplify(e);
    expect(s).toEqual(E.const(12));
  });

  it("folds constant div", () => {
    const e = E.div(E.const(10), E.const(4));
    const s = simplify(e);
    expect(s).toEqual(E.const(2.5));
  });

  it("folds constant min/max", () => {
    expect(simplify(E.min(E.const(3), E.const(5)))).toEqual(E.const(3));
    expect(simplify(E.max(E.const(3), E.const(5)))).toEqual(E.const(5));
  });

  it("eliminates 0+x → x", () => {
    const x = E.var(0, "x");
    const e = E.add(E.const(0), x);
    expect(simplify(e)).toEqual(x);
  });

  it("eliminates x+0 → x", () => {
    const x = E.var(0, "x");
    const e = E.add(x, E.const(0));
    expect(simplify(e)).toEqual(x);
  });

  it("eliminates 1*x → x", () => {
    const x = E.var(0, "x");
    const e = E.mul(E.const(1), x);
    expect(simplify(e)).toEqual(x);
  });

  it("eliminates 0*x → 0", () => {
    const x = E.var(0, "x");
    const e = E.mul(E.const(0), x);
    expect(simplify(e)).toEqual(E.const(0));
  });

  it("eliminates 0/x → 0", () => {
    const x = E.var(0, "x");
    const e = E.div(E.const(0), x);
    expect(simplify(e)).toEqual(E.const(0));
  });

  it("eliminates x/1 → x", () => {
    const x = E.var(0, "x");
    const e = E.div(x, E.const(1));
    expect(simplify(e)).toEqual(x);
  });

  it("collects constants in add", () => {
    const x = E.var(0, "x");
    const e = E.add(E.const(2), x, E.const(3));
    const s = simplify(e);
    // Should have x and const(5) as children
    expect(evaluate(s, vars(10))).toBe(15);
    if (s.tag === "add") {
      expect(s.children.length).toBe(2);
    }
  });

  it("collects constants in mul", () => {
    const x = E.var(0, "x");
    const e = E.mul(E.const(2), x, E.const(3));
    const s = simplify(e);
    expect(evaluate(s, vars(5))).toBe(30);
    if (s.tag === "mul") {
      expect(s.children.length).toBe(2);
    }
  });

  it("deeply simplifies nested expressions", () => {
    // (0 + x) * (1 * y) = x * y
    const e = E.mul(
      E.add(E.const(0), E.var(0, "x")),
      E.mul(E.const(1), E.var(1, "y"))
    );
    const s = simplify(e);
    const v = vars(3, 5);
    expect(evaluate(s, v)).toBe(15);
  });

  it("preserves value through simplification for random inputs", () => {
    const e = E.mul(
      E.add(E.const(2), E.var(0, "cr"), E.const(0.05)),
      E.add(E.var(1, "cd"), E.const(0.5)),
      E.div(E.const(190), E.add(E.const(190), E.const(200)))
    );
    const s = simplify(e);
    for (let i = 0; i < 20; i++) {
      const v = randomVars(2);
      expect(evaluate(s, v)).toBeCloseTo(evaluate(e, v), 10);
    }
  });
});

// ─── Differentiate ───

describe("differentiate", () => {
  it("d/dx(const) = 0", () => {
    const d = differentiate(E.const(5), 0);
    expect(evaluate(d, vars())).toBe(0);
  });

  it("d/dx(x) = 1", () => {
    const d = differentiate(E.var(0, "x"), 0);
    expect(evaluate(d, vars(7))).toBe(1);
  });

  it("d/dx(y) = 0", () => {
    const d = differentiate(E.var(1, "y"), 0);
    expect(evaluate(d, vars(7, 3))).toBe(0);
  });

  it("d/dx(x + 3) = 1", () => {
    const e = E.add(E.var(0, "x"), E.const(3));
    const d = differentiate(e, 0);
    expect(evaluate(d, vars(5))).toBe(1);
  });

  it("d/dx(2*x) = 2", () => {
    const e = E.mul(E.const(2), E.var(0, "x"));
    const d = differentiate(e, 0);
    expect(evaluate(d, vars(5))).toBe(2);
  });

  it("d/dx(x*y) = y", () => {
    const e = E.mul(E.var(0, "x"), E.var(1, "y"));
    const d = differentiate(e, 0);
    expect(evaluate(d, vars(3, 7))).toBe(7);
  });

  it("d/dx(x*x) = 2x (numerical check)", () => {
    const e = E.mul(E.var(0, "x"), E.var(0, "x"));
    const d = differentiate(e, 0);
    for (const x of [1, 2, 3, 5, 10]) {
      expect(evaluate(d, vars(x))).toBeCloseTo(2 * x, 10);
    }
  });

  it("d/dx(a/x) where a is const", () => {
    // d/dx(10/x) = -10/x²
    const e = E.div(E.const(10), E.var(0, "x"));
    const d = differentiate(e, 0);
    for (const x of [1, 2, 5]) {
      expect(evaluate(d, vars(x))).toBeCloseTo(-10 / (x * x), 8);
    }
  });

  it("d/dx(min(x, 5)) when const arg", () => {
    const e = E.min(E.var(0, "x"), E.const(5));
    const d = differentiate(e, 0);
    // With const second arg, derivative follows first arg = 1
    expect(evaluate(d, vars(3))).toBe(1);
  });

  it("d/dx(max(x, 0)) when const arg", () => {
    const e = E.max(E.var(0, "x"), E.const(0));
    const d = differentiate(e, 0);
    expect(evaluate(d, vars(3))).toBe(1);
  });
});

// ─── Compile ───

describe("compileExpr", () => {
  it("compiled matches evaluate for const", () => {
    const e = E.const(42);
    const fn = compileExpr(e);
    expect(fn(vars())).toBe(42);
  });

  it("compiled matches evaluate for var", () => {
    const e = E.var(0, "x");
    const fn = compileExpr(e);
    expect(fn(vars(7))).toBe(7);
  });

  it("compiled matches evaluate for arithmetic", () => {
    const e = E.mul(
      E.add(E.var(0, "x"), E.const(1)),
      E.add(E.var(1, "y"), E.const(-2))
    );
    const fn = compileExpr(e);
    for (let i = 0; i < 50; i++) {
      const v = randomVars(2);
      expect(fn(v)).toBeCloseTo(evaluate(e, v), 10);
    }
  });

  it("compiled matches evaluate for div", () => {
    const e = E.div(
      E.mul(E.const(2.78), E.var(0, "em")),
      E.add(E.const(1400), E.var(0, "em"))
    );
    const fn = compileExpr(e);
    for (let i = 0; i < 50; i++) {
      const v = randomVars(1);
      expect(fn(v)).toBeCloseTo(evaluate(e, v), 10);
    }
  });

  it("compiled matches evaluate for min/max", () => {
    const e = E.add(
      E.const(1),
      E.mul(
        E.min(E.max(E.var(0, "cr"), E.const(0)), E.const(1)),
        E.var(1, "cd")
      )
    );
    const fn = compileExpr(e);
    for (let i = 0; i < 50; i++) {
      const v = randomVars(2);
      v[0] = v[0] - 5; // allow negative CR values
      expect(fn(v)).toBeCloseTo(evaluate(e, v), 10);
    }
  });

  it("compiled matches evaluate for complex damage-like expression", () => {
    // baseDmg * dmgBonus * defMult * resMult * critMult
    const atk = E.add(
      E.mul(E.const(800), E.add(E.const(1), E.var(0, "atk%"))),
      E.var(1, "flatAtk")
    );
    const baseDmg = E.mul(atk, E.const(2.426));
    const dmgBonus = E.add(E.const(1), E.var(2, "dmg%"));
    const defMult = E.div(E.const(190), E.add(E.const(190), E.const(200)));
    const resMult = E.const(0.9);
    const critMult = E.add(
      E.const(1),
      E.mul(
        E.min(E.max(E.var(3, "cr"), E.const(0)), E.const(1)),
        E.var(4, "cd")
      )
    );
    const total = E.mul(baseDmg, dmgBonus, defMult, resMult, critMult);
    const simplified = simplify(total);
    const fn = compileExpr(simplified);

    for (let i = 0; i < 100; i++) {
      const v = randomVars(5);
      expect(fn(v)).toBeCloseTo(evaluate(total, v), 8);
    }
  });

  it("compiled negative const emits valid JS", () => {
    const e = E.add(E.var(0, "x"), E.const(-5));
    const fn = compileExpr(e);
    expect(fn(vars(10))).toBe(5);
  });
});

// ─── Factoring ───

describe("factoring", () => {
  it("factors common sub-expression from add of muls", () => {
    // a*b + a*c → a*(b+c)
    const a = E.var(0, "a");
    const b = E.var(1, "b");
    const c = E.var(2, "c");
    const e = E.add(E.mul(a, b), E.mul(a, c));
    const s = simplify(e);
    // Verify correctness over random inputs
    for (let i = 0; i < 50; i++) {
      const v = randomVars(3);
      expect(evaluate(s, v)).toBeCloseTo(evaluate(e, v), 10);
    }
    // Should have factored: result should not be an add of two muls
    // It should be mul(a, add(b, c)) or equivalent
    expect(s.tag).toBe("mul");
  });

  it("factors common sub-expression with constants", () => {
    // 2*x*y + 3*x*y → 5*x*y
    const x = E.var(0, "x");
    const y = E.var(1, "y");
    const e = E.add(E.mul(E.const(2), x, y), E.mul(E.const(3), x, y));
    const s = simplify(e);
    for (let i = 0; i < 20; i++) {
      const v = randomVars(2);
      expect(evaluate(s, v)).toBeCloseTo(evaluate(e, v), 10);
    }
  });

  it("factors out defMult*resMult*critMult from damage formula parts", () => {
    // Simulates: baseDmg1 * defMult * resMult * critMult + baseDmg2 * defMult * resMult * critMult
    const baseDmg1 = E.var(0, "baseDmg1");
    const baseDmg2 = E.var(1, "baseDmg2");
    const defMult = E.div(E.const(190), E.add(E.const(190), E.const(200)));
    const resMult = E.const(0.9);
    const critMult = E.add(E.const(1), E.mul(E.var(2, "cr"), E.var(3, "cd")));

    const part1 = E.mul(baseDmg1, defMult, resMult, critMult);
    const part2 = E.mul(baseDmg2, defMult, resMult, critMult);
    const total = E.add(part1, part2);
    const s = simplify(total);

    // Verify correctness
    for (let i = 0; i < 50; i++) {
      const v = randomVars(4);
      expect(evaluate(s, v)).toBeCloseTo(evaluate(total, v), 8);
    }
  });

  it("does not factor when no common sub-expression", () => {
    const e = E.add(
      E.mul(E.var(0, "x"), E.var(1, "y")),
      E.mul(E.var(2, "z"), E.var(3, "w"))
    );
    const s = simplify(e);
    // Should remain as add of two muls
    expect(s.tag).toBe("add");
  });
});

// ─── Utilities ───

describe("utilities", () => {
  it("countVars finds all variable indices", () => {
    const e = E.add(E.var(0, "x"), E.mul(E.var(2, "z"), E.var(0, "x")));
    const s = countVars(e);
    expect(s).toEqual(new Set([0, 2]));
  });

  it("isConst identifies constants", () => {
    expect(isConst(E.const(5))).toBe(true);
    expect(isConst(E.var(0, "x"))).toBe(false);
    expect(isConst(E.add(E.const(1), E.const(2)))).toBe(false);
  });

  it("isConst after simplify identifies folded constants", () => {
    const e = simplify(E.add(E.const(1), E.const(2)));
    expect(isConst(e)).toBe(true);
  });
});
