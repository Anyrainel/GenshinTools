/**
 * Create a branding DOM element for move-based image captures.
 * Includes the star + arch bridge SVG matching the React component.
 * Used when the export captures on-page content and we can't embed
 * a React component in a hidden container.
 */
export function createBrandingElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px;padding:4px 0";
  el.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="position:absolute;top:0;width:144px;height:20px;opacity:0.8;pointer-events:none">
        <svg viewBox="0 0 200 40" style="width:100%;height:100%;filter:drop-shadow(0 0 5px rgba(255,215,0,0.2))">
          <defs>
            <linearGradient id="eArchL" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="hsla(45,70%,85%,0)"/>
              <stop offset="100%" stop-color="hsl(45,70%,85%)"/>
            </linearGradient>
            <linearGradient id="eArchR" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="hsl(45,70%,85%)"/>
              <stop offset="100%" stop-color="hsla(45,70%,85%,0)"/>
            </linearGradient>
          </defs>
          <path d="M10,38 Q50,20 75,18" fill="none" stroke="url(#eArchL)" stroke-width="2" stroke-linecap="round"/>
          <path d="M125,18 Q150,20 190,38" fill="none" stroke="url(#eArchR)" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <svg width="20" height="20" viewBox="0 0 100 100" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,0.8));margin-bottom:-4px">
        <defs>
          <linearGradient id="eGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="hsl(45,70%,85%)"/>
            <stop offset="100%" stop-color="hsl(35,70%,75%)"/>
          </linearGradient>
        </defs>
        <path d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z" fill="url(#eGold)"/>
      </svg>
      <span style="font-family:serif;font-weight:bold;font-size:24px;background:linear-gradient(to bottom right,hsl(45 70% 85%),hsl(35 70% 75%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent">GG圣遗物</span>
    </div>
    <span style="font-size:24px;color:#e5e7eb;font-weight:300">ggartifact.com</span>
  `;
  return el;
}

/**
 * Move an on-page element into an off-screen wrapper with branding,
 * call the capture callback, then restore the element to its original position.
 * This preserves CSS variables and computed styles (unlike cloneNode).
 */
export async function captureWithBranding(
  content: HTMLElement,
  capture: (wrapper: HTMLElement) => Promise<void>,
  opts?: { title?: string; minWidth?: number }
): Promise<void> {
  const parent = content.parentElement;
  const nextSibling = content.nextSibling;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;left:-9999px;top:0;padding:12px";
  wrapper.style.width = `${Math.max(content.scrollWidth + 24, opts?.minWidth ?? 800)}px`;

  wrapper.appendChild(createBrandingElement());

  if (opts?.title) {
    const titleEl = document.createElement("div");
    titleEl.style.cssText =
      "text-align:center;font-weight:bold;font-size:24px;color:#e5e7eb;margin-bottom:12px";
    titleEl.textContent = opts.title;
    wrapper.appendChild(titleEl);
  }

  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  try {
    await capture(wrapper);
  } finally {
    if (nextSibling) {
      parent?.insertBefore(content, nextSibling);
    } else {
      parent?.appendChild(content);
    }
    wrapper.remove();
  }
}

/** Branding header for image exports — gold star + arch bridge over site name. */
export function ExportBranding() {
  return (
    <div className="flex items-center justify-center gap-3 mb-3">
      {/* Site name with star + arch bridge */}
      <div className="relative flex flex-col items-center">
        <div className="absolute top-0 w-36 h-5 opacity-80 pointer-events-none">
          <svg
            viewBox="0 0 200 40"
            className="w-full h-full drop-shadow-[0_0_5px_rgba(255,215,0,0.2)]"
          >
            <defs>
              <linearGradient
                id="exportArchL"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="hsl(45, 70%, 85%, 0)" />
                <stop offset="100%" stopColor="hsl(45, 70%, 85%)" />
              </linearGradient>
              <linearGradient
                id="exportArchR"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="hsl(45, 70%, 85%)" />
                <stop offset="100%" stopColor="hsl(45, 70%, 85%, 0)" />
              </linearGradient>
            </defs>
            <path
              d="M10,38 Q50,20 75,18"
              fill="none"
              stroke="url(#exportArchL)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M125,18 Q150,20 190,38"
              fill="none"
              stroke="url(#exportArchR)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 100 100"
          className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-[-4px]"
        >
          <defs>
            <linearGradient id="exportGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(45 70% 85%)" />
              <stop offset="100%" stopColor="hsl(35 70% 75%)" />
            </linearGradient>
          </defs>
          <path
            d="M50 0 C55 35 65 45 100 50 C65 55 55 65 50 100 C45 65 35 55 0 50 C35 45 45 35 50 0 Z"
            fill="url(#exportGold)"
          />
        </svg>
        <span
          className="font-serif font-bold text-2xl text-transparent bg-clip-text"
          style={{
            backgroundImage:
              "linear-gradient(to bottom right, hsl(45 70% 85%), hsl(35 70% 75%))",
          }}
        >
          GG圣遗物
        </span>
      </div>
      <span className="text-2xl text-foreground font-light">
        ggartifact.com
      </span>
    </div>
  );
}
