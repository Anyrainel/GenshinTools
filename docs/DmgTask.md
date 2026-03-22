# Task: Incremental Damage Implementation Guide

## Objective

This document outlines the workflow and requirements for implementing or updating characters, weapons, and artifact sets in the Engine. Whenever new content is released, follow this guide to incrementally integrate their buffs and damage formulas based on the official game data.

For the overall system architecture, type definitions, buff classes, formula classes, and stat key mapping, you **must** refer to **[DmgDesign.md](./DmgDesign.md)**.

## 1. Incremental Workflow

When a game update introduces new entities, follow this sequence:

### Step 1: Identify Missing Implementations

Run the unified audit script to find out exactly what needs to be implemented and check for misplaced files.
```bash
uv run --project scripts/pyproject.toml scripts/impl_audit.py check
```
This will print out entities that do not yet have a matching `@Register*` implementation.

### Step 2: Review and Implement

1. For any missing entity, use the `show` command to dump its localized details and existing code snippet (if any) into the `scripts/.impl_audit_output.txt` file for easy reference alongside your editor:
   ```bash
   uv run --project scripts/pyproject.toml scripts/impl_audit.py show C <char_id>
   uv run --project scripts/pyproject.toml scripts/impl_audit.py show W <weapon_id>
   uv run --project scripts/pyproject.toml scripts/impl_audit.py show A <artifact_id>
   ```
2. **Add the new classes**:
   - **Characters**: `src/lib/team-comp/impl/character*.ts` (split by rarity and region, e.g., `character5Natlan.ts`). Extended from `CharacterBase` and decorated with `@RegisterCharacter`.
   - **Weapons**: `src/lib/team-comp/impl/weapon*.ts` (split by rarity and weapon type, e.g., `weapon5Claymore.ts`. 3* weapons are grouped in `weapon3.ts`). Extended from `WeaponBase` and decorated with `@RegisterWeapon`.
   - **Artifacts**: Add 2pc bonuses to `artifact2pc.ts` (decorated with `@RegisterArtifactHalfSet`) and 4pc bonuses to `artifact4pc.ts` (decorated with `@RegisterArtifactSet`).
3. Run `npm run type-check:headtail` to ensure no errors were introduced.
4. Repeat from Step 1 until `check` reports no missing or misplaced implementations.

### Step 3: Document Blockers

If you hit a blocker you cannot resolve (e.g., missing data, ambiguous game mechanics, need for a new buff abstraction), document it in `docs/DmgTODO.md`, explaining *what* is blocked and *why*.

---

## 2. Character Implementation Guidelines

Each character extends `CharacterBase` (from `damageModels.ts`) and registers with the system via `@RegisterCharacter`.

### Class Members

Required members for you to implement:
- `buffs`: `StatBuff[]` - Buffs provided by talents, passives and constellations. Dynamically constructed based on input constellation and combat option. Use theoretical max values achievable.
- `formulaMap`: `Record<string, FormulaEntry>` - Defines the formulas for the major damage sources of this character. Include multiple playstyles if applicable.

### Talent Level Convention

Use **Lv10** talent multipliers as the baseline. For characters whose constellation upgrades a specific talent (+3 levels via C3 or C5), use **Lv13** when `this.constellation >= threshold`. Use the generated `charInfo` to double check which talent is augmented if you aren't certain.

### Creating BuffSources

Use `cbs(this, triggers?, origin?)` from `helpers.ts` to create `BuffSource` objects:

```typescript
cbs(this)                           // { type: 'character', id: this.charId }
cbs(this, ['low-hp'])               // with triggers
cbs(this, [], 'C6')                 // with origin (constellation)
cbs(this, ['reaction'], 'E')        // origin = E, triggered on reaction
```

Remember: BuffSource is only for display purposes. It is not consumed by formula calculation. For any logic mentioned in BuffSource, the logic also needs to be implemented in BuffTarget or TeamMeta or constellation checks.

### BuffTarget / DamageFormula DamageTag Nuances

If a character's kit increases the damage of a specific named effect (e.g. "Crimson Oowajo DMG"), treat it as the broader standard AbilityType (e.g. `"skill"`) when defining `BuffTarget` and `DamageFormula` **if** the game text implies it belongs to that category (e.g. "deals Elemental Skill DMG"). This allows it to benefit from teammates' generic skill buffs.

### Handling Mutually Exclusive Scenarios (OptionMap)

If a character has randomized or playstyle-based mechanics that are mutually exclusive (e.g., Furina Ousia/Pneuma), use `OptionMap` instead of assumptions.

- **Do NOT** create separate character files or subclasses.
- **Do** define an `OptionDef` schema with labeled choices and pass it to `@RegisterCharacter`.
- **Do** use `resolveOption(schema, this.option)` to get a typed value inside your class.
- **Do** order choices by preference — **first choice = most preferred default**. The `default` field must match the first choice's value.
- **Do** add `when?: (teamMeta: ITeamMeta) => boolean` to choices that require specific conditions (constellation level, team elements, reactions). The UI shows all choices but disables invalid ones.

**Example:**
```typescript
import { resolveOption, type OptionDef } from './damageModels';

const huTaoOption = {
  label: { zh: "生命值状态", en: "HP State" },
  choices: [
    { value: "low",  label: { zh: "生命值 ≤ 50%", en: "HP ≤ 50%" } },
    { value: "high", label: { zh: "生命值 > 50%", en: "HP > 50%" } },
    { value: "1",    label: { zh: "生命值为 1 (C6)", en: "HP = 1 (C6)" },
      when: (tm) => (tm.constellations["hu_tao"] ?? 0) >= 6 },
  ] as const,
  default: "low",
} satisfies OptionDef;

@RegisterCharacter("hu_tao", huTaoOption)
class HuTao extends CharacterBase {
  private readonly o = resolveOption(huTaoOption, this.option);
}
```

### Stat Keys & Translation Rules

For comprehensive guidelines on picking the correct stat keys (like `reactionDmg%` vs `dmg%`, `baseDmg` vs `baseDmg%`), defining `BuffTarget.receiver`, and handling Mutually Exclusive Scenarios, you **must** refer to the **[DmgRunbook.md](./DmgRunbook.md)**.

### Dual-Stat Scaling

For dual-scaling (e.g. ATK + EM), use the optional `extraTerm` parameter on any formula class:
```typescript
// Nahida Tri-Karma: ATK + EM scaling
new DirectFormula(1.859, tag, "atk", { key: "em", multiplier: 3.717 })
```

### ⚠️ No selfStats at Construction Time

`formulaMap` and `buffs` are evaluated at **construction time**. You cannot read the character's resolved stats (e.g. total ATK) when defining formulas. For stat-dependent buffs or formulas, use `ScalingBuff` instead.

---

## 3. Weapon Implementation Guidelines

Each weapon extends `WeaponBase` (from `damageModels.ts`) and registers via the `@RegisterWeapon` decorator.

### Required Members

| Member | Type | Description |
|---|---|---|
| `buffs` | `StatBuff[]` | Passive effect(s), parameterized by `this.refinement` |

Auto-resolved stats: `WeaponBase` resolves `baseAtk` and the secondary stat from `resources.ts`. **You do NOT need to define a `stats` field.**

### `buffs` as `readonly` vs `get`

Most weapons use `readonly buffs = [...]`. When the buff list depends on team composition (via `this.teamMeta` or `this.charId`), use a **getter** instead:

```typescript
// Static (most weapons):
readonly buffs = [ new StatBuff(...) ];

// Dynamic (team-dependent weapons):
get buffs() {
  const liyueCount = this.teamMeta.countByRegion("Liyue");
  return [ new StatBuff(wbs(this), { receiver: "self" }, [
    { key: "atk%", value: liyueCount * r(this.refinement, [0.07, 0.08, 0.09, 0.1, 0.11]) },
  ]) ];
}
```

### Refinement Scaling

Use the shared helper `r(refinement, values)` from `helpers.ts`. It picks the value at the given 1-indexed refinement level:

```typescript
r(this.refinement, [0.20, 0.25, 0.30, 0.35, 0.40])  // R1=0.20, R5=0.40
```

### BuffSource Helper

Use `wbs(self, triggers?, noStackId?)` from `helpers.ts` to create `BuffSource` objects:

```typescript
wbs(this)                       // { type: 'weapon', id: 'staff_of_homa' }
wbs(this, ['low-hp'])           // with triggers
```

Remember: BuffSource is only for display purposes. Logic regarding conditional activation must be modeled inside `TeamMeta` checks or `BuffTarget` filters.

### Proc-Only Weapons

Weapons whose passive is purely proc damage, CD reset, energy restore, or HP restore still need a class so they're in the registry (the base class picks up base stats). Use empty buffs:

```typescript
@RegisterWeapon('favonius_sword')
class FavoniusSword extends WeaponBase {
  readonly buffs = [];
}
```

---

## 4. Artifact Implementation Guidelines

### Architecture

Each artifact set has **two** classes:
- One extending `ArtifactHalfSetBase` (2pc bonus), keyed by **halfSetId** (numeric string)
- One extending `ArtifactSetBase` (4pc bonus only), keyed by **setId**

The 4pc class provides **only the 4pc-specific bonus**. The 2pc bonus is already provided by the `ArtifactHalfSetBase` class.

Register via `@RegisterArtifactHalfSet` and `@RegisterArtifactSet` decorators.

### Required Members

| Member | Type | Description |
|---|---|---|
| `stats` | `StatEntry[]` | Usually empty `[]` — bonuses come from buffs |
| `buffs` | `StatBuff[]` | Set bonus effects |

### Modeling Conditional 4pc Effects

- For **self-buffs with stacks** (e.g., Crimson Witch E stacks), assume max stacks.
- For **team-wide buffs** (e.g., Noblesse 4pc ATK%), use `receiver: 'team'` or `'onField'`.
- For **enemy debuffs** (e.g., Viridescent 4pc RES reduction), model as a `resReduction%` stat buff with `receiver: 'team'` — anyone can benefit since the formula reads `resReduction%`. Same for `defReduction%`.

### BuffSource.type

Use `type: 'artifactHalfSet'` for 2pc buffs and `type: 'artifactSet'` for 4pc buffs. Available fields:
- `id` — `this.artifactHalfSetId` or `this.artifactSetId`
- `triggers` — trigger conditions: `['E']`, `['after-burst']`, etc. Do NOT use triggers to express 2pc/4pc — the `type` field handles that distinction.

### 2pc Bonus Taxonomy

| Category | Value |
|---|---|
| ATK/HP/DEF +X% | `{ key: 'atk%', value: 0.18 }` |
| EM +80 | `{ key: 'em', value: 80 }` |
| ER +20% | `{ key: 'er', value: 0.20 }` |
| Elemental% +15% | `{ key: '<element>%', value: 0.15 }` |
| Physical% +25% | `{ key: 'phys%', value: 0.25 }` |
| Burst DMG +20% | `{ key: 'dmg%', value: 0.20 }` with `filter: { abilities: ['burst'] }` |

For full annotated examples, see [DmgDesign.md §5.3](./DmgDesign.md#53-extension-examples).

## Appendix

收集了检查武器、圣遗物和角色实现时的经验法则（Rules of thumb）。AI 助手在发现和修复 bug 时应参考这些法则，而不是依赖“玩家直觉”。在阅读游戏内描述文本时，请结合具体语境判断是否出现例外情况。

### 0. `BuffSource` 注意事项
所有BuffSource中的内容都是为了UI显示端服务的，不参与任何计算逻辑。包括`triggers`和`origin`等字段。
- `origin`只允许出现"A"（普通攻击、重击、下落攻击）,"E"（元素战技）,"Q"（元素爆发）,"P1"-"P4"（固有天赋1-4）,"C0"-"C6"（命座1-6）,"R1"-"R5"（精通1-5），代表着buff的文本出处。
- `triggers`内可以使用灵活的tag，意味着是什么条件触发这个buff，在翻译时最好能写出精确的tag，如“lunarBloom” (触发月绽放反应时), "elemental-reaction"（触发任意元素反应时, "burst"（使用元素爆发后），"skill"（元素战技命中敌人后）。如果字符串刚好符合某些已有的type时（如AbilityType，ReactionType等），要复用其类型值，否则可以使用任意字符串的kebab-case，不同角色、武器的同一种触发条件必须使用相同的tag。不需要描述“命中敌人”等条件，默认已经命中了敌人。
- 很多时候增益的描述跨越多句话，甚至包含不同的条件（如基于“月兆等级”的不同效果）。在实现时必须阅读完整段，确保包含所有分支（例如不要仅实现“初辉”而遗漏“满辉”的增益）。
- 需注意高命座（如C6）是否改变了增益的获取方式。例如某个增益原仅被Q触发，但满命座允许E同样触发，应在其`triggers`数组中动态更新，如 `cbs(this, this.constellation >= 6 ? ["Q", "E"] : ["Q"])`，确保UI能正确展示扩展的触发方式。

### 1. `noStackId` 使用原则
如果一个武器或圣遗物提供`"team"` 或 `"onField"` 的增益，它一般不能叠加，需要填写 `noStackId`（默认使用本身的ID），这样才能防止队伍中多个角色装备同一物品时增益被错误叠加。同一个角色在队伍中只能出现一次，所以角色一般不需要`noStackId`。
- 游戏内的描述文本明确说明“该效果可叠加”或“多件同名武器产生的此效果可以叠加”时，则对应的效果不需要 `noStackId`。
- 个别武器或圣遗物会构成某一个系列的增益，例如千年的大乐章系列武器，或者月辉明光系列圣遗物，这类特效在不同装备之间也不能叠加，所以`noStackId` 需要使用这类特效的id（可以自行命名）。

### 2. `BuffTarget.receiver` 使用原则
在将游戏内文本映射为 receiver 类型时请格外注意：
- **`selfOnField`**：只在装备者本人在场上时才生效。匹配如“退场时解除”、“退场时消失”或“when X leaves the field”，或者增益描述为针对某些主动攻击或技能的加成时，通常意味着只有在场时生效。
- **`self`**：通用的个人增益。通常在声明“处于队伍后台也能触发”时，或者完全没有任何限定词时，代表该增益对本人生效，无论前台还是后台。
- **`selfOffField`**：在后台激活的效果。匹配“处于队伍后台”或“not on the field”（作为触发条件时）。
- **`onField`**：只赋予当前场上角色的增益。匹配如“队伍中附近的角色”，“当前场上角色”或“your active character”。
- **`otherOnField`**：只赋予当前场上其他角色的增益。匹配如“除<角色名>外的附近的当前场上角色”，以及杜林白龙形态下的轮变启迪。
- **`team`**：赋予全队的增益。匹配“队伍中附近的所有角色”或“all nearby party members”。

### 3. `dmg%` 与 `reactionDmg%` 的区别
绝对不要把普通的伤害加成与剧变/增幅反应伤害加成混淆：
- 如果被动/增益提升的是“绽放反应造成的伤害（Bloom DMG）”、“超绽放反应造成的伤害”或“蒸发反应造成的伤害”等，必须将其写入 **`reactionDmg%`**，并确保 `DamageTagFilter` 过滤了该特定的反应。绝对不要使用 `dmg%`+`filter: { reactions: [...] }`，因为它属于不同的乘区！
- 有些时候多种伤害类型会有一个统称，如“月曜反应造成的伤害”，则意味着`reactionDmg%`+`filter: { reactions: ["lunarCharged", "lunarBloom", "lunarCrystallize"] }`。
- 注意：月绽放（lunarBloom）技能的直伤部分本身不吃“绽放反应伤害”加成（其随之生成的草原核属于普通的 bloom 伤害）。因此，任何描述提升“绽放（bloom）反应伤害”的效果（如妮露的丰穰之核天赋、乐园遗落等圣遗物）绝对不应该在 `filter` 中混入 `lunarBloom`，除非被动明确不仅加成“绽放”还加成“月绽放”（否则会导致高达四五倍的直伤乘区错误！）。
- “X元素伤害加成”或“X元素造成的伤害”是个特例，需要使用`pyro%`,`hydro%`等，而不是`dmg%`，这是因为类似的词条可以出现在圣遗物上，系统已经把它们归类为不同的词条。统称的“元素伤害”意味着所有7个元素对应的词条增益。而“元素伤害或物理伤害”则可被认为是普适的`dmg%`。
- 一定要明确的辨别伤害加成有没有条件，如果是“普通攻击或重击造成的伤害”，那就需要`dmg%`+`filter: { abilities: ["normal", "charged"] }`。
- 擢升应译为`Elevated%`。

### 4. `cr/cd` 与 `reactionCr/reactionCd` 注意事项
留意暴击属性是否专门只针对某种反应生效：
- “扩散反应的暴击率提升30%” -> 请使用 **`reactionCr`** 或 **`reactionCd`**，而不是普通的 `cr` 或 `cd`。仅有少数角色的天赋、被动或命座会提供此类增益。

### 5. `baseDmg` 与 `baseDmg%` 的区别
- **`baseDmg`**：用于增加固定数额到基础伤害中的效果。例如：“附近的当前场上角色……的伤害提升，提升值相当于<角色名>的X%”，“……造成A类型伤害时，基于<角色名>的B属性，提高造成的伤害”。
- **`baseDmg%`**：用于按倍率缩放基础伤害的效果。例如：“造成原本X%的伤害”，或者“提升X%月曜反应的基础伤害”，前者一般只对自身的某种技能的伤害进行提升（如那维莱特固有天赋使重击伤害提升），而后者只出现在挪德卡莱角色的被动中。
- **特例注意（基于精通的剧变反应伤害提升）**：若文本描述为“XXX反应伤害提升，提升值相当于<角色名>元素精通的Y%”（如菈乌玛的苍色祷歌），因为元素精通是固定数值（例如1000），500% 的元素精通将产生 5000 点的基础伤害追加。这必须映射至 **`baseDmg`** 而绝对不能是 `reactionDmg%` 或 `baseDmg%`！直接将倍率作为乘区给到ScalingBuff的目标键 `baseDmg`。

### 6. `LunarFormula` 与 `LunarDirectFormula`
- **`LunarFormula`**：适用于计算月反应带来的聚变反应伤害，如雷暴云或月笼造成的伤害。
- **`LunarDirectFormula`**：适用于计算挪德卡莱角色技能造成的“视为月XX反应伤害”的伤害。
- 如奈芙尔（nefer）的特殊重击会造成2段（自身）和3段（虚影）伤害，其中只有虚影造成的伤害视为月绽放反应伤害，而自身的伤害仅为普通的草元素伤害，因此计算时需要将不同段使用不同公式来计算。

### 7. 互斥机制与 `OptionMap`
如果一个角色拥有切换不同玩法的机制（例如芙宁娜的荒/芒性，杜林的白/黑龙形态，哥伦比亚的引力干涉类型，阿蕾奇诺的生命之契起始数值130%/155%/200%），或随机增益（例如流浪乐章），请避免假设所有增益同时存在，或者写死某个平均值。应通过 `@RegisterCharacter` 使用 `OptionDef` 定义并在运行时解析 `OptionMap`。让用户在使用中规定一个状态。

**选项排序规则**：choices 必须按偏好排序——**第一个选项是最优默认值**。`default` 字段必须与第一个选项的 value 一致。

**条件可用性（`when`）**：如果某个选项需要特定条件才有意义（如命座等级、队伍元素、反应），应添加 `when?: (teamMeta: ITeamMeta) => boolean`。UI 会显示所有选项但禁用不满足条件的选项，`resolveOption()` 会跳过被禁用的选项。常见模式：
- 命座门控：`when: (tm) => (tm.constellations["hu_tao"] ?? 0) >= 6`
- 反应门控：`when: (tm) => tm.hasReaction("freeze")`
- 元素门控：`when: (tm) => tm.countByElement("Electro") >= 1`

### 8. 特殊技能的 `AbilityType`
- 一些技能描述会包含“该伤害视为X伤害”，则即使该技能描述出现在E或Q的文本中，也应该将其归类为X类型的伤害，如瓦蕾莎在极限驱动状态时的Q技能被视为下落攻击伤害。
- 某些角色会在某些状态下施展“特殊X攻击”，如奈芙尔在拥有曹露时可释放“特殊”重击，应该也被认为是重击伤害。
- 某些技能描述会澄清“该伤害不被视为X伤害”，则意味着任何技能类型都不生效，应该使用`special`作为`AbilityType`，如艾梅莉埃固有技能中的清露香氛“不被视为元素战技伤害”。
- 某些技能会生成召唤物进行自动攻击或协同攻击，则该类伤害应该继承生成召唤物的技能类型，如艾梅莉埃的柔灯之匣一二阶由E生成，为元素战技伤害，三阶由Q生成，为元素爆发伤害。行秋Q技能生成的雨帘剑可以为前台角色提供协同攻击，所以当做行秋的元素爆发伤害。

### 9. `DamageFormula` 的选择
- 没有元素反应的情况下，大多数公式使用`DirectFormula`，然而挪德卡莱角色的技能很多都有“该伤害视为月XX反应伤害”的描述，此时这些伤害就应该转而使用`LunarDirectFormula`。
- 在目标是计算元素反应伤害时，则应该使用对应的Formula。

### 10. `scalingKey` 与 `hits` 字段的正确使用
- **`scalingKey` 规范**：如果某个技能（或反应）明确且唯一地基于某种属性缩放（如“基于生命值上限……”或“基于元素精通……”），必须直接在 `DamageFormula` 构造函数中使用对应的键（如 `"hp"`, `"em"`）作为主的 `scalingKey`。
  - **错误做法**：将主控属性设为 `"atk"`（然后倍率填 `0`），再通过 `extraTerm` 去读取生命值或精通。这会导致 UI 渲染呈现出混乱的“0 攻击阶层”展示。
  - **正确做法**：直接写入 `"hp"` 或 `"em"`, 例如 `new DirectFormula(mult, tag, "hp")`。只有在技能确实受到双属性共同缩放（如“X% 攻击力 + Y% 元素精通”）时，才使用 `extraTerm`。
- **`hits` 字段规范**：对于包含多段伤害判定的技能（如“造成3次伤害”或有多个独立的伤害数字）：
  - 如果各段倍率完全相同，必须在对应的 `FormulaEntry` part 中设置明确的 `hits` 字段（如 `hits: 3`），并在公式内填入**单段**对应倍率。
  - 如果各段倍率不同（如 44.4% + 57.7%），最好将它们拆分为多个独立的 `part`，每个 `part` 各自计算。如果嫌拆分过多，至少也要在 `label` 中明确说明这是全段总计，但对于游戏内能明确看出多次分别跳字的情况，最好将其拆分成不同 part，或是拆分为具有代表性的 `part`(例如将相同倍率的合并为 `hits: N`，不同的单独列出)。
  - **切忌**：在 UI 上显示为多段攻击的技能，在代码里却合并成了一个具有巨大总倍率且 `hits: 1`（或省略 `hits`）的单一 `part`，这对于想要单独比较单段伤害的玩家来说很不直观。

### 11. 前提假设惯例 (Assumption Conventions)

我们在建模时计算的是**峰值伤害（Peak Damage）**，而不是循环中的平均伤害。以下各项假设确保了不同角色间的计算结果具有可比性：

| 假设内容 / Assumption | 处理规则 / Rule | 理由与说明 / Rationale |
|---|---|---|
| **条件性增益 (Conditional buffs)** | 默认始终处于激活状态 | 例如“施放元素战技后”或“触发元素反应后” → 假定总是满足该触发条件 |
| **层数 (Stacks)** | 视情况而定 | 1. 如果满层需要不同元素角色，则根据`teamMeta`计算层数 2. 如果满层只需要战斗手法，那默认满层 3. 如果满层很难达到，或者持续时间不足以覆盖循环，则设置OptionMap |
| **低血量条件 (Low HP conditions)** | 实现OptionMap | 例如“生命值低于50%时” → 实现“生命值>=50%”和“生命值<50%”的OptionDef |
| **护盾条件 (Shield conditions)** | 若队伍中有护盾角色则激活 | 例如“处于护盾庇护下” → 使用 `teamMeta.hasShielder()` 动态判断（结合角色特性与命座） |
| **治疗条件 (Heal conditions)** | 若队伍中有治疗角色则激活 | 例如“受到治疗后” → 使用 `teamMeta.hasHealer()` 动态判断（结合角色特性与命座） |
| **敌人元素附着 (Enemy element affection)** | 若队伍中有对应元素即可 | 例如“对处于火元素影响下的敌人” → 假定已被附着，前提是队伍里确实有火元素角色 |
| **自身元素附着 (Self element affection)** | 默认已激活 | 例如“处于火元素附着下” → 假定已被附着，在代码库中加注释注明此假设 |
| **天赋等级 (Talent levels)** | 默认Lv10（包含C3/C5的+3→Lv13）| Lv10是未计入命座的系统最高级；C3/C5命座会各自提升一个天赋至Lv13，命座文本中会包含天赋的名字 |
| **反应条件 (Reaction conditions)** | 配队必须完整支持该反应 | 例如“触发扩散反应时” → 队伍必须有风元素及至少一种可被扩散的元素 |
| **命座限制 (Constellation gates)** | 检查 `this.constellation >= N` | 只有在玩家所选命座大于或等于该数值时，才在代码中推入对应的天赋/命座增益 |
| **精炼缩放 (Refinement scaling)** | 使用 `this.refinement` 助手函数 | 同一个增益效果中只有数值会随精炼提升而变化，其它属性保持一致即可 |
| **月兆 (Moonsign)** | 检查 `teamMeta.countByFaction(“Moonsign”)` | 例如”月兆·初辉” → 检查数量 `>= 1`；”月兆·满辉” → 检查数量 `>= 2`。Moonsign faction包含所有有月兆被动的角色（含非诺德凯角色如兹白） |
