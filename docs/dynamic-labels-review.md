# 命座动态标签审查

本文档列出所有 formulaMap 中因命座而产生标签变动的情况，供逐行审查。

---

## 类型一：动态标签（ternary 表达式改变标签文字）

这些公式的 label 在不同命座下文字不同，是最需要标准化的情况。共 4 例。

### 1. 奥罗龙 (Ororon) — Q+音波

- **文件**: `character4Natlan.ts:294-310`
- **命座**: C6
- **当前实现**: ternary 拼接
- **C0-C5 标签**:
  - zh: `Q+音波`
  - en: `Q +Soundwave`
- **C6 标签**:
  - zh: `Q+音波+6命超感`
  - en: `Q +Soundwave +C6 Hyper`
- **建议**: 保持基础标签 `Q+音波` / `Q +Soundwave` 不变。C6 的额外伤害拆成独立公式 entry（如已存在）或通过 parts 扩展体现。如果 C6 只是加了额外 parts，可用静态标签 + UI 角标标注 "C6增强"。

> 我们应该区分Q和音波伤害，Q伤害应该就是`Q`，然后在C6时多附加一个200%的超感伤害part，都是一次性的Q伤害。而音波是持续的伤害，它会一直旋转，触碰怪物的次数不可预测，所以我们应该单独出另一个公式，然后默认触碰6次。

### 2. 钟离 (Zhongli) — E

- **文件**: `character5Liyue.ts:206-231`
- **命座**: C6
- **当前实现**: ternary 完全替换标签
- **C0-C5 标签**:
  - zh: `E`
  - en: `E`
- **C6 标签**:
  - zh: `6命 E (满点)`
  - en: `C6 E (Full Points)`
- **建议**: C6 改变了 E 的机制（吸血+百分比），本质上是同一个公式在 C6 下参数不同。可保持静态标签 `E`，UI 通过角标显示 "C6增强"。或者如果想突出区别，可拆成两个 entry：`E` (minC:0) 和 `C6 E (满点)` (minC:6)，同时给 C0 版 E 在 C6 时标记为被替代。

> 我怎么感觉 6命 E (满点) 这个公式是兹白(zibai)的，不是钟离的？这样吧，我们让这个公式就叫`E`，然后我们在她的OptionMap中实现“时隙浮光消耗”两个选项，选项1是100点 （6命才允许选），选项2是70点。这样用户就不需要猜测E伤害到底是怎么算的了，也允许他们在6命的时候依然模拟70点的伤害，一举两得。

### 3. 芙宁娜 (Flins) — E

- **文件**: `character5NodKrai.ts:726-746`
- **命座**: C2
- **当前实现**: ternary 完全替换标签
- **C0-C1 标签**:
  - zh: `E`
  - en: `E`
- **C2+ 标签**:
  - zh: `2命 E`
  - en: `C2 E`
- **建议**: C2 增加了额外 parts/hits。可保持静态标签 `E`，让 minC-aware 的 parts 自行扩展。UI 角标标注命座增强。

> 对菲林斯(Flins)，我们确实可以采用静态标签`E`.

### 4. 英妮菲亚 (Ineffa) — Q

- **文件**: `character5NodKrai.ts:1106-1119`
- **命座**: C2
- **当前实现**: ternary 完全替换标签
- **C0-C1 标签**:
  - zh: `Q`
  - en: `Q`
- **C2+ 标签**:
  - zh: `2命 Q`
  - en: `C2 Q`
- **建议**: 同 Flins，保持静态标签 `Q`，让 parts 的变化体现命座差异。

> 同意，伊涅芙(Ineffa)可以使用静态标签`Q`.

---

## 类型二：静态标签的条件公式（条件展开 / if 分支添加）

这些公式标签本身是静态的，但整个 formula entry 在低命座下不存在。改为 minC 后标签可完全保持不变。共约 37 例。

> 同意

### Fontaine 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 夏沃蕾 Chevreuse | `chevreuse-c2-chain` | 2命 E伤害 | C2 E | C2 |
| 夏洛蒂 Charlotte | `charlotte-c6-coord` | 6命 协同攻击 | C6 Coordinated | C6 |

### Inazuma 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 绮良良 Kirara | `kirara-c4-steed` | C4驰骋 | C4 Steed of Skanda | C4 |
| 菲谢尔 Fischl | `fischl-c4-mark` | C4雷草印 | C4 Thundergrass Mark | C4 |

### Liyue 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 重云 Chongyun | `chongyun-c1-blades` | 1命 普攻冰刃×3 | Normal Blades×3 (C1) | C1 |

### Mondstadt 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 菲谢尔 Fischl | `fischl-c6-lupus` | C6狼魂落雷 | C6 Lupus Lightning | C6 |

### Natlan 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 希洛 Xilo | `xilo-c6-shield` | 6命护盾破碎 | C6 Shield Shatter | C6 |

### NodKrai 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 希道 Xidao | `xidao-c2-aedon` | C2阿咚 | C2 Aedon | C2 |
| 希道 Xidao | `xidao-c2-ball` | C2水弹×3 | C2 Ball ×3 | C2 |

### Sumeru 四星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 纳西妲 Nahida | `nahida-c6-light` | 6命天园之光 | C6 Pairidaeza's Light | C6 |

### Fontaine 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 娜维亚 Navia | `navia-c6-normal` | 6命 普攻（4段） | C6 Normal (4-hit) | C6 |
| 娜维亚 Navia | `navia-c4-burst` | 4命Q伤害×14 | C4 Q (×14) | C4 |
| 芙宁娜 Furina | `furina-c6-parfait` | — | C6 E Parfait (×6) | C6 |
| 芙宁娜 Furina | `furina-c6-strike` | 6命 礼花重奏 | C6 Strike Reprised | C6 |

### Inazuma 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 雷电将军 Raiden | `raiden-c6-normal` | — | C6 Normal (4-hit) | C6 |
| 八重神子 Miko | `miko-c1-fish` | C1游鱼 | C1 Swimming Fish | C1 |
| 八重神子 Miko | `miko-c6-shunsuiken` | 6命额外瞬水剑×2 | C6 Shunsuiken (×2) | C6 |
| 八重神子 Miko | `miko-c6-blazing` | C6 额外炽焰箭（5段） | C6 Blazing Arr (5-hit) | C6 |
| 夜兰 Yelan | `yelan-c6-plunge` | 6命 下落 | C6 Plunge | C6 |

### Mondstadt 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 温迪 Venti | `venti-c1-spark` | 1命火花 | C1 Spark | C1 |
| 温迪 Venti | `venti-c4-explosion` | 4命爆炸 | C4 Explosion | C4 |
| 温迪 Venti | `venti-c2-blossom` | — | C2 Fatal Blossom ×3 | C2 |
| 温迪 Venti | `venti-c2-e` | — | C2 E | C2 |
| 瓦尔卡 Varka | `varka-c1-special-e` | C1特殊E | C1 Special E | C1 |
| 瓦尔卡 Varka | `varka-c1-special-ca` | C1特殊重击 | C1 Special CA | C1 |

### Natlan 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 克洛琳德 Clorinde | `clorinde-c1-stacks` | 1命星刃层数 | C1 Stellar Blade Stacks | C1 |
| 克洛琳德 Clorinde | `clorinde-c6-ring` | 6命焚曜之环·灼象 | C6 Scorching Ring | C6 |

### NodKrai 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 芙宁 Flins | `flins-c6-normal` | — | C6 Normal | C6 |
| 芙宁 Flins | `flins-c6-sanctuary` | — | C6 Sanctuary ×8 | C6 |
| 英妮菲亚 Ineffa | `ineffa-c6-thundercloud` | 6命 雷暴云 | C6 Thundercloud | C6 |

### Snezhnaya 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 阿蕾奇诺 Arlecchino | `arlecchino-c2-bloodfire` | 2命厄月血火 | C2 Balemoon Bloodfire | C2 |

### Sumeru 五星
| 角色 | 公式 key | 标签 zh | 标签 en | 命座 |
|------|---------|---------|---------|------|
| 艾尔海森 Alhaitham | `alhaitham-c6-e` | — | C6 E | C6 |
| 艾尔海森 Alhaitham | `alhaitham-c6-bolts` | 6命渡荒之雷 | C6 Duststalker Bolts | C6 |

---

## 类型三：选项标签中的命座描述

部分角色的 option choices 在标签中提及命座生效条件。这些不是公式标签，但可能需要一并考虑。

| 角色 | 描述 zh | 描述 en | 命座 |
|------|---------|---------|------|
| 雷泽 Razor | HP<30%（C2生效） / HP≥30%（C2不生效） | — | C2 |
| 迪卢克 Diluc | >50%（C1生效） / <50%（C1不生效） | — | C1 |
| 杜林 Durin | C4白焰(无限层) / C4黑蚀(14层) | C4 White (unlimited) / C4 Dark (14 stacks) | C4 |
| 温迪 Venti | <50%（C4生效） / >50%（C4不生效） | — | C4 |

> 雷泽 Razor 不需要标注C2生不生效，选项只需要描述条件，不需要告诉用户到底会发生什么，因为解释不完，可以在label上标注一下，比如“敌人血量(2命)”，然后选项只需要是“HP<30%”, "HP≥30%". 迪卢克可以使用完全类似的描述。（选项前面也加上HP）
> 我并没有看到温迪有任何选项，所以没法提供反馈。杜林的选项有点复杂，我需要研究一下。

---

## 标准化建议总结

1. **类型一（4例动态标签）**: 建议改为静态标签，让 UI 通过 minC 角标体现命座增强。或者在极少数机制完全改变的情况下（钟离 C6）拆成独立 entry。
2. **类型二（~37例条件公式）**: 标签已是静态的，只需加 `minC` 字段，移除条件展开即可。
3. **类型三（选项标签）**: 暂不处理，保持现状。这些是 UI 选项描述，不影响公式标签标准化。
