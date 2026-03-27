# Talent Detail Rendering

This document describes how to render the talent scaling tables from the
exported reference data.

## Data Sources

Rendering a talent detail table requires two data files:

| File | Fields used |
|---|---|
| `character_{4,5}_{lang}.json` | `skills[].details` — array of `[label, template]` pairs |
| `character_stats.json` | `talent.{A,E,Q}` — 2D param arrays `[level_index][param_index]` |

The `details` array order matches the skill order:
`skills[0]` = Normal Attack (A), `skills[1]` = Elemental Skill (E),
`skills[2]` = Elemental Burst (Q).

## Template Syntax

Each template string contains placeholder tokens of the form:

```
{paramN:FMT}
```

- **N** — 1-based index into the param array for a given talent level.
  `param1` maps to `params[0]`, `param2` to `params[1]`, etc.
- **FMT** — one of the format codes listed below.

A template may contain literal text around placeholders:

```
{param1:F1P}+{param2:F1P}      ->  "47.3%+60.2%"
{param1:F1P} DEF               ->  "134% DEF"
{param1:I}                     ->  "20"
{param1:F1P}/{param2:F1P}      ->  "128%/160%"
{param1:I}s                    ->  "12s"
{param1:F1P} each              ->  "72% each"
```

## Format Codes

| Code | Description | Conversion |
|---|---|---|
| `I` | Integer | `round(value)` as integer string |
| `F1` | 1 decimal place | Fixed 1-digit decimal, trailing zeros stripped |
| `F2` | 2 decimal places | Fixed 2-digit decimal, trailing zeros stripped |
| `P` | Percentage (0 decimals) | `value * 100`, rounded, with `%` suffix |
| `F1P` | Percentage (1 decimal) | `value * 100`, 1-digit decimal, with `%` suffix |
| `F2P` | Percentage (2 decimals) | `value * 100`, 2-digit decimal, with `%` suffix |

**Trailing-zero rule**: after formatting to the specified decimal precision,
strip trailing `0` characters and then any trailing `.` character. If the
result is empty, use `"0"`.

Examples:

| Raw value | Format | Result |
|---|---|---|
| `0.367` | `F1P` | `36.7%` |
| `0.498` | `F1P` | `49.8%` |
| `1.068` | `F1P` | `106.8%` |
| `0.30` | `F1P` | `30%` |
| `20.0` | `I` | `20` |
| `12.0` | `I` | `12` |
| `1.3374` | `F1P` | `133.7%` |
| `0.05` | `F2P` | `5%` |
| `6.5` | `F1` | `6.5` |

## Rendering Algorithm

```
function render(template, params):
    Replace each {paramN:FMT} token in template:
        index = N - 1
        if index is out of bounds: substitute "0"
        otherwise: substitute format_value(params[index], FMT)
    return result

function format_value(value, fmt):
    match fmt:
        "I"   -> str(round(value))
        "F1"  -> trim(sprintf("%.1f", value))
        "F2"  -> trim(sprintf("%.2f", value))
        "P"   -> trim(sprintf("%.0f", value * 100)) + "%"
        "F1P" -> trim(sprintf("%.1f", value * 100)) + "%"
        "F2P" -> trim(sprintf("%.2f", value * 100)) + "%"
        else  -> trim(sprintf("%.2f", value))

function trim(s):
    if s contains ".":
        strip trailing "0"s
        strip trailing "."
    if empty: return "0"
    return s
```

## End-to-End Example

Given Albedo's Elemental Skill (E), `character_5_en.json`:

```json
"details": [
  ["Skill DMG", "{param1:F1P}"],
  ["Transient Blossom DMG", "{param2:F1P} DEF"],
  ["Duration", "{param4:I}s"],
  ["Skill CD", "{param5:I}s"]
]
```

And `character_stats.json`:

```json
"talent": {
  "E": [
    [1.3044, 1.3392, 30.0, 0.0, 4.0, ...],
    [1.4022, 1.4396, 30.0, 0.0, 4.0, ...],
    ...
  ]
}
```

Rendering row `["Skill DMG", "{param1:F1P}"]` at level 1 (index 0):

1. Match `{param1:F1P}` — N=1, index=0, value=`1.3044`
2. Apply F1P: `1.3044 * 100 = 130.44` -> `sprintf("%.1f", 130.44)` = `"130.4"`
3. Trim: `"130.4"` (no trailing zeros) -> `"130.4%"`

Result: `"130.4%"` (the label column is `"Skill DMG"`).

## Placeholder Regex

The canonical regex pattern for matching placeholders:

```
\{param(\d+):(F1P|F1|P|I|F2P|F2)\}
```
