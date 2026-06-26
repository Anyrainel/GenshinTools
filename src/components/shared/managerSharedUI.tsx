import { Download, ExternalLink, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { useArtifactManagerConnection } from "@/hooks/useArtifactManagerConnection";
import { cn } from "@/lib/utils";

const GOODSCANNER_RELEASES =
  "https://github.com/Anyrainel/GOODScanner/releases";
const GOODSCANNER_PROXY_EXE =
  "https://gh-proxy.org/https://github.com/Anyrainel/GOODScanner/releases/latest/download/GOODScanner.exe";

export function ConnectionStatus({
  connection,
  t,
}: {
  connection: ReturnType<typeof useArtifactManagerConnection>["connection"];
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (connection.status === "disconnected") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t.ui("manager.offline")}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex text-muted-foreground hover:text-foreground"
              aria-label={t.ui("manager.offlineHint")}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>{t.ui("manager.offlineHint")}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  if (connection.status === "cors-blocked") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-sm text-destructive">
            {t.ui("manager.errorCors")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground ml-3.5">
          {t.ui("manager.errorCorsHint")}
        </p>
      </div>
    );
  }

  if (connection.status === "error") {
    const code = connection.httpStatus;
    let errorText: string;
    if (code === 404) {
      errorText = t.ui("manager.errorNotGOODScanner");
    } else if (code === 403) {
      errorText = t.ui("manager.errorRejected");
    } else if (code === 401) {
      errorText = t.ui("manager.errorAuth");
    } else if (code === 408) {
      errorText = t.ui("manager.errorTimeout");
    } else if (code >= 500) {
      errorText = t.ui("manager.errorServer").replace("{0}", String(code));
    } else {
      errorText = t.ui("manager.errorUnexpected").replace("{0}", String(code));
    }
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-sm text-destructive">{errorText}</span>
        </div>
        {connection.body && (
          <p className="text-xs text-muted-foreground ml-3.5 break-all">
            {connection.body}
          </p>
        )}
      </div>
    );
  }

  const h = connection.health;
  const isReady = h.enabled && h.gameAlive && !h.busy;

  let statusText: string;
  let dotColor: string;
  if (isReady) {
    statusText = t.ui("manager.ready");
    dotColor = "bg-green-500";
  } else if (h.busy) {
    statusText = t.ui("manager.busy");
    dotColor = "bg-yellow-500";
  } else if (!h.gameAlive) {
    statusText = t.ui("manager.gameNotRunning");
    dotColor = "bg-yellow-500";
  } else {
    statusText = t.ui("manager.paused");
    dotColor = "bg-yellow-500";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      <span className="text-sm">{statusText}</span>
    </div>
  );
}

export function SetupInstructions({
  t,
}: {
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const link = (
    <a
      href={GOODSCANNER_RELEASES}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-400 hover:underline"
    >
      GOODScanner
      <ExternalLink className="h-3 w-3" />
    </a>
  );

  const step1Parts = t.ui("manager.setupStep1").split("{0}");

  return (
    <div className="space-y-2">
      <ol className="space-y-1.5 text-sm list-decimal list-inside">
        <li>
          {step1Parts[0]}
          {link}
          {step1Parts[1]}
          <div className="flex items-center gap-1.5 mt-1 ml-0">
            <span className="text-xs text-foreground/80">
              {t.ui("import.proxyHint")}
            </span>
            <a
              href={GOODSCANNER_PROXY_EXE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors"
            >
              GOODScanner.exe
              <Download className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </li>
        <li>{t.ui("manager.setupStep2")}</li>
        <li>{t.ui("manager.setupStep3")}</li>
        <li>{t.ui("manager.setupStep4")}</li>
      </ol>
    </div>
  );
}
