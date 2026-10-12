# LightweightSelect 调用盘点 · 2026-10-12

结论：外观可以统一到 Select 的 `variant="lightweight"`，但仅增加 Trigger variant 不能完整替代现有实现。两者底层都是 Radix Select，尚无大量控件性能基准，不能承诺迁移后更快。本次保留所有 LightweightSelect 调用。

## GenshinTools：9 个直接调用文件

| 文件（src/components 下） | 用途与外观 |
| --- | --- |
| game-account/FlexPatternDialog.tsx | 部位、主词条；28px，自动宽度，渐变背景；主词条使用自定义短标签 |
| teams/ArtifactSwapDialog.tsx | 排序字段；固定 112px 宽，默认高度，空值提示 |
| teams/ArtifactFreezeDialog.tsx | 排序字段；固定 96px 宽，默认高度，空值提示 |
| teams/TeamRosterCard.tsx | 角色、装备条件；24–32px，响应式宽度和字号，居中加粗，半透明背景，禁用选项 |
| teams/AnalyzerResultCard.tsx | 投入档位；32px 高、80px 宽 |
| archive/SkillCard.tsx | 天赋等级；28px，窄宽度，渐变背景 |
| shared/BuildCard.tsx | 最低命座；圆角胶囊，自动高度，响应式内边距，命座语义颜色，小箭头 |
| shared/StatSelect.tsx | 单词条选择；28px，渐变背景，紧凑宽度，自定义短标签、取消选项；同一组件中有多个调用分支 |
| shared/WeightedStatSelect.tsx | 添加加权词条；嵌入行内，高度跟随父级，无边框、透明背景；BuildCard 的主、副词条编辑通过此组件间接使用 |

## GGStarRail：6 个直接调用文件

| 文件（src 下） | 用途与外观 |
| --- | --- |
| components/builds/StatSelect.tsx | 主词条；28px，渐变背景，居中且隐藏箭头，短标签与取消选项 |
| components/builds/BuildCard.tsx | 添加副词条；20px 方形加号按钮，隐藏箭头，无边框，小面积主色背景 |
| pages/archive/CharacterSkillCard.tsx | 技能对比等级；28px，窄宽度，渐变背景 |
| pages/archive/CharacterExtendedDetails.tsx | 强化版本；32px，自动宽度，渐变背景 |
| pages/archive/CharacterCurrencyWarDetails.tsx | 赛季；32px，自动宽度，渐变背景 |
| components/teams/team/Controls.tsx | CompactSelect；24–28px，自动宽度，小字号加粗，无阴影，支持自定义显示与弹层样式 |

GGStarRail 的 CompactSelect 间接调用者共 8 个：team/RosterCard、MemberOptions、optimizer/DamagePill、optimizer/RelicsDamageCard、optimizer/StatSheetTile、investment/InvestmentDetail、investment/InvestmentRoster、choice/ChoiceResultsCard（均在 src/components/teams 下）。BuildCard 还通过 StatSelect 间接使用。GGStarRail 当前没有 stock Select。

## 建议的统一接口

- `variant="lightweight"` 负责基础外观：较小左右内边距、gap、细焦点环、上下双箭头、透明背景；避免 stock 的 dark 背景规则改变透明/渐变调用。
- `size` 与 `className` 继续负责 20/24/28/32px、父级高度、固定/自动宽度和响应式布局。高度使用普通 utility，避免 data-size 强制压过调用方。
- 胶囊、无边框嵌入式、加号按钮、语义颜色继续由调用方指定；不把业务颜色写入通用 Select。
- 提供 `showIndicator` / `indicator`，保留隐藏箭头、自定义图标；自定义短标签继续作为 children。
- Content 保留 `position="popper"`、触发器宽度约束、碰撞留白、滚轮事件阻止冒泡和高度上限。现有 stock 默认 item-aligned，不能只替换 import。
- Item 保留左侧勾选标记和对应缩进；stock 的右侧标记会改变现有视觉。

迁移前验证弹层定位、滚轮不带动父页面、键盘与禁用选项、触发器短标签、移动端碰撞及大量配装卡片渲染。variant 可以解决外观重复；布局参数和弹层行为也对齐后，才删除 LightweightSelect。
