import { captureWithBranding } from "@/components/shared/ExportBranding";
import { downloadElementAsImage } from "@/lib/downloadImage";

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
  await captureWithBranding(
    tableElement,
    (wrapper) => downloadElementAsImage(wrapper, filename, t),
    { title }
  );
}
