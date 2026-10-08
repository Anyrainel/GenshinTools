import { Download } from "lucide-react";
import type { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export const GGSCANNER_PROJECT_URL = "https://github.com/Anyrainel/GGScanner";
export const GGSCANNER_RELEASES_URL = `${GGSCANNER_PROJECT_URL}/releases`;

const DOWNLOADS = [
  {
    recommended: true,
    fileName: "GGScanner.exe",
    url: "https://gh-proxy.org/https://github.com/Anyrainel/GGScanner/releases/latest/download/GGScanner.exe",
  },
  {
    recommended: false,
    fileName: "GGScannerOCR.exe",
    url: "https://gh-proxy.org/https://github.com/Anyrainel/GGScanner/releases/latest/download/GGScannerOCR.exe",
  },
] as const;

export function ScannerDownloadLinks({
  t,
  className,
}: {
  t: ReturnType<typeof useLanguage>["t"];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {DOWNLOADS.map((tool) => (
        <a
          key={tool.fileName}
          href={tool.url}
          target="_blank"
          rel="noreferrer"
          download={tool.fileName}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
            "text-xs font-medium transition-colors",
            tool.recommended
              ? "border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {tool.recommended
            ? t.ui("import.toolGoodCapture")
            : t.ui("import.toolGoodScanner")}
          {tool.recommended && (
            <span className="text-xs">· {t.ui("import.recommended")}</span>
          )}
          <Download className="w-3 h-3 opacity-60" />
        </a>
      ))}
    </div>
  );
}
