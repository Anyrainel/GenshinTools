# shadcn 本地改动

## Card · 2026-10-12

文件：`src/components/ui/card.tsx`。适配标题与内容背景不同、各区块紧贴边缘的现有卡片。

- Card：移除外壳 `py-6`、区块间 `gap-6`；内部留白由各区块负责。
- CardHeader：默认使用 flex，移除固定两行 grid 和下边框触发的 `pb-6`；有 CardAction 时仍使用 grid。
- 其余 API、主题颜色和各区块内边距保持原版。

## Select · 2026-10-12

文件：`src/components/ui/select.tsx`。Trigger 的 `size` 使用普通 `h-9` / `h-8`，移除 `data-size` 条件高度，允许调用处的紧凑高度正常生效；其余行为保留原版。

更新时审查并重新应用以上差异，不直接覆盖。Card、Select 在 stock 清单中登记为自定义组件，仍接受普通 UI 样式检查；其他原版组件继续校验源码哈希。
