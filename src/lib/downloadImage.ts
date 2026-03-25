import { toPng } from "html-to-image";
import { toast } from "sonner";

/**
 * Capture a DOM element as a PNG and trigger a download.
 * Shared helper used by SwapGuide export, tier-list export, etc.
 */
export async function downloadElementAsImage(
  element: HTMLElement,
  filename: string,
  t: { ui: (key: string) => string },
  options?: { pixelRatio?: number }
): Promise<void> {
  try {
    const loadingToast = toast.loading(t.ui("app.generatingImage"));

    // Small delay so the toast renders before the main-thread-blocking capture
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { scrollWidth, scrollHeight } = element;

    // Read the page gradient so exports match the themed background
    const rootStyle = getComputedStyle(document.documentElement);
    const gradientPage = rootStyle.getPropertyValue("--gradient-page").trim();
    const bgImage = gradientPage || undefined;
    // Solid fallback for any remaining transparent areas
    const bgHsl = rootStyle.getPropertyValue("--background").trim();
    const bgColor = bgHsl ? `hsl(${bgHsl})` : "#10141d";

    const dataUrl = await toPng(element, {
      cacheBust: true,
      backgroundColor: bgColor,
      width: scrollWidth,
      height: scrollHeight,
      pixelRatio: options?.pixelRatio ?? 1,
      style: {
        width: `${scrollWidth}px`,
        height: `${scrollHeight}px`,
        backgroundImage: bgImage,
      },
    });

    const link = document.createElement("a");
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    link.download = `${filename}-${localDate}.png`;
    link.href = dataUrl;
    link.click();

    toast.dismiss(loadingToast);
    toast.success(t.ui("app.imageGenerated"));
  } catch (err) {
    console.error(err);
    toast.error(t.ui("app.imageGenerationFailed"));
  }
}
