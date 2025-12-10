import { toPng } from "html-to-image";
import { toast } from "sonner";

interface DownloadTierListImageOptions {
  tableElement: HTMLElement;
  title: string;
  filename: string;
  t: {
    ui: (key: string) => string;
  };
}

export async function downloadTierListImage({
  tableElement,
  title,
  filename,
  t,
}: DownloadTierListImageOptions): Promise<void> {
  try {
    const loadingToast = toast.loading(t.ui("app.generatingImage"));

    // Add a small delay to allow toast to show
    await new Promise((resolve) => setTimeout(resolve, 100));

    const { scrollWidth, scrollHeight } = tableElement;

    // First, capture the table
    const tableDataUrl = await toPng(tableElement, {
      cacheBust: true,
      backgroundColor: "#10141d",
      width: scrollWidth,
      height: scrollHeight,
      pixelRatio: 2,
      style: {
        width: `${scrollWidth}px`,
        height: `${scrollHeight}px`,
      },
    });

    // Create a canvas to combine title and table image
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Set canvas dimensions
    const topPadding = 48; // 24px * 2 for pixelRatio
    const textHeight = 48; // ~24px * 2 for pixelRatio
    const bottomPadding = 16; // 8px * 2 for pixelRatio (reduced from 48px)
    const titleHeight = topPadding + textHeight + bottomPadding; // Total: 112px
    canvas.width = scrollWidth * 2; // pixelRatio 2
    canvas.height = (titleHeight + scrollHeight) * 2;

    // Fill background
    ctx.fillStyle = "#10141d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw title text (centered)
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 48px sans-serif"; // 24px * 2 for pixelRatio
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(title, canvas.width / 2, topPadding);

    // Load table image and draw it below title (with reduced spacing)
    const tableImg = new Image();
    tableImg.src = tableDataUrl;

    await new Promise((resolve, reject) => {
      tableImg.onload = () => {
        ctx.drawImage(tableImg, 0, titleHeight, canvas.width, scrollHeight * 2);
        resolve(null);
      };
      tableImg.onerror = reject;
    });

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.download = `${filename}-${new Date().toISOString().split("T")[0]}.png`;
    link.href = dataUrl;
    link.click();

    toast.dismiss(loadingToast);
    toast.success(t.ui("app.imageGenerated"));
  } catch (err) {
    console.error(err);
    toast.error(t.ui("app.imageGenerationFailed"));
  }
}
