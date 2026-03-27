/**
 * Template-based talent detail rendering.
 * Converts template strings like "{param1:F1P}" + param arrays into display values.
 * See docs/talent_format.md for specification.
 */

const TEMPLATE_RE = /\{param(\d+):(F1P|F2P|F1|F2|P|I)\}/g;

/** Strip trailing zeros and trailing dot from a decimal string. */
function trimDecimal(s: string): string {
  if (s.includes(".")) {
    return s.replace(/0+$/, "").replace(/\.$/, "") || "0";
  }
  return s || "0";
}

function formatValue(value: number, fmt: string): string {
  switch (fmt) {
    case "I":
      return String(Math.round(value));
    case "F1":
      return trimDecimal(value.toFixed(1));
    case "F2":
      return trimDecimal(value.toFixed(2));
    case "P":
      return `${trimDecimal((value * 100).toFixed(0))}%`;
    case "F1P":
      return `${trimDecimal((value * 100).toFixed(1))}%`;
    case "F2P":
      return `${trimDecimal((value * 100).toFixed(2))}%`;
    default:
      return trimDecimal(value.toFixed(2));
  }
}

/** Render a template string using the given param array for a single talent level. */
export function renderTemplate(template: string, params: number[]): string {
  return template.replace(TEMPLATE_RE, (_match, nStr, fmt) => {
    const index = Number(nStr) - 1;
    if (index < 0 || index >= params.length) return "0";
    return formatValue(params[index], fmt);
  });
}
