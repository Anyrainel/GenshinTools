import { AlertTriangle, Home, RefreshCw, Trash2 } from "lucide-react";
import React, { type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/** Detect stale-chunk / dynamic-import failures (post-deploy cache mismatch). */
function isChunkLoadError(error?: Error): boolean {
  if (!error) return false;
  const msg = error.message || "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    error.name === "ChunkLoadError" ||
    msg.includes("Unable to preload CSS")
  );
}

function isDomMutationError(error?: Error): boolean {
  if (error?.name !== "NotFoundError") return false;
  return (
    error.message.includes("removeChild") ||
    error.message.includes("insertBefore")
  );
}

function extractModuleUrl(message: string): string | null {
  const match = message.match(/https?:\/\/\S+|\/assets\/\S+/);
  return match?.[0] ?? null;
}

function getCauseChain(error?: Error): string[] {
  const causes: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (
    current &&
    typeof current === "object" &&
    "cause" in current &&
    !seen.has(current)
  ) {
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
    if (!current) break;
    if (current instanceof Error) {
      causes.push(`${current.name}: ${current.message}`);
      continue;
    }
    causes.push(String(current));
  }

  return causes;
}

function formatPerformanceEntry(entry: PerformanceResourceTiming): string {
  const responseStatus =
    typeof (entry as PerformanceResourceTiming & { responseStatus?: unknown })
      .responseStatus === "number"
      ? String(
          (entry as PerformanceResourceTiming & { responseStatus: number })
            .responseStatus
        )
      : "n/a";

  const source = entry.name.split("/").pop() || entry.name;
  return `${source} [${entry.initiatorType || "unknown"} status=${responseStatus} duration=${Math.round(entry.duration)}ms transfer=${entry.transferSize}]`;
}

function getRelatedResourceEntries(moduleUrl: string | null): string[] {
  if (typeof performance === "undefined") return [];

  const entries = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[];
  if (entries.length === 0) return [];

  const moduleName = moduleUrl?.split("/").pop() ?? null;
  const filtered = entries.filter((entry) => {
    if (moduleName && entry.name.includes(moduleName)) return true;
    return (
      entry.name.includes("/assets/") &&
      (entry.initiatorType === "script" ||
        entry.initiatorType === "link" ||
        entry.initiatorType === "css")
    );
  });

  return filtered.slice(-6).map(formatPerformanceEntry);
}

function getChunkDebugMessage(error?: Error): string {
  if (!error) return "Unknown chunk loading error.";

  const lines = [`${error.name || "Error"}: ${error.message}`];
  const moduleUrl = extractModuleUrl(error.message || "");
  const causes = getCauseChain(error);
  const relatedEntries = getRelatedResourceEntries(moduleUrl);

  if (moduleUrl) {
    lines.push(`Imported module: ${moduleUrl}`);
    lines.push(
      "Note: this URL is the lazy import target and may not be the exact dependency that failed."
    );
  }

  if (causes.length > 0) {
    lines.push(`Cause chain: ${causes.join(" -> ")}`);
  }

  lines.push(
    `Route: ${window.location.pathname}${window.location.search}${window.location.hash}`
  );
  lines.push(`Online: ${navigator.onLine ? "yes" : "no"}`);

  if (relatedEntries.length > 0) {
    lines.push("Recent asset requests:");
    lines.push(...relatedEntries.map((entry) => `- ${entry}`));
  }

  return lines.join("\n");
}

interface Props {
  children: ReactNode;
  onClearData?: () => void;
  clearLabel?: string;
  refreshLabel?: string;
  reloadLabel?: string;
  homeLabel?: string;
  errorTitle?: string;
  errorDefaultMsg?: string;
  chunkErrorMsg?: string;
  domMutationMsg?: string;
  isSection?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  debugMessage?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      debugMessage: isChunkLoadError(error)
        ? getChunkDebugMessage(error)
        : undefined,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isChunkLoadError(error)) {
      console.error("Chunk load error diagnostics:", {
        error,
        componentStack: errorInfo.componentStack,
        debugMessage: getChunkDebugMessage(error),
      });
      return;
    }
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleClear = () => {
    if (this.props.onClearData) {
      this.props.onClearData();
      window.location.reload();
    }
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  /** Cache-busting reload with best-effort client cache cleanup. */
  private handleCacheBustReload = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));

    try {
      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
    } catch (error) {
      console.warn("Failed to clear CacheStorage before reload:", error);
    }

    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister())
        );
      }
    } catch (error) {
      console.warn(
        "Failed to unregister service workers before reload:",
        error
      );
    }

    try {
      await fetch(url.toString(), {
        cache: "reload",
        credentials: "same-origin",
      });
    } catch (error) {
      console.warn("Failed to prefetch fresh document before reload:", error);
    }

    window.location.replace(url.toString());
  };

  private handleHome = () => {
    window.location.href = import.meta.env.BASE_URL || "/";
  };

  public render() {
    if (this.state.hasError) {
      const { isSection } = this.props;
      const isChunkError = isChunkLoadError(this.state.error);
      const isDomMutation = isDomMutationError(this.state.error);

      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center w-full bg-background text-foreground",
            isSection ? "p-2 my-4" : "h-full min-h-[50vh] p-4"
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center w-full border border-destructive/20 bg-destructive/5 rounded-2xl",
              isSection
                ? "max-w-sm p-4 space-y-4"
                : "max-w-md p-8 shadow-lg space-y-6"
            )}
          >
            <div className="p-3 bg-destructive/20 rounded-full text-destructive">
              <AlertTriangle className={isSection ? "w-8 h-8" : "w-12 h-12"} />
            </div>
            <div className="text-center space-y-2 w-full">
              <h2
                className={cn(
                  "font-bold text-destructive",
                  isSection ? "text-lg" : "text-xl"
                )}
              >
                {this.props.errorTitle || "Something went wrong"}
              </h2>
              <div
                className={cn(
                  "text-muted-foreground whitespace-pre-wrap overflow-y-auto w-full text-left bg-background/50 p-2 rounded-md border border-border/50 font-mono",
                  isSection ? "text-xs max-h-32" : "text-sm max-h-48 p-3"
                )}
              >
                {this.state.error?.message ||
                  this.props.errorDefaultMsg ||
                  "An unexpected error occurred."}
              </div>
              {isChunkError && (
                <p className="text-muted-foreground text-sm">
                  {this.props.chunkErrorMsg ||
                    "This usually means the app was updated. A cache-busting reload should fix it."}
                </p>
              )}
              {isDomMutation && (
                <p className="text-muted-foreground text-sm">
                  {this.props.domMutationMsg ||
                    "A browser translator or text-changing extension may have modified the page. Disable it for this site, then refresh. You do not need to clear your data."}
                </p>
              )}
              {isChunkError && this.state.debugMessage && (
                <div
                  className={cn(
                    "text-muted-foreground whitespace-pre-wrap overflow-y-auto w-full text-left bg-background/50 rounded-md border border-border/50 font-mono",
                    isSection
                      ? "text-[10px] max-h-40 p-2"
                      : "text-xs max-h-56 p-3"
                  )}
                >
                  {this.state.debugMessage}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full pt-2">
              {isChunkError && (
                <Button
                  onClick={this.handleCacheBustReload}
                  size={isSection ? "sm" : "default"}
                  className="w-full gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {this.props.reloadLabel || "Reload"}
                </Button>
              )}
              {isDomMutation && (
                <Button
                  onClick={this.handleRefresh}
                  variant="secondary"
                  size={isSection ? "sm" : "default"}
                  className="w-full gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {this.props.refreshLabel || "Refresh Page"}
                </Button>
              )}
              {this.props.onClearData && (
                <Button
                  onClick={this.handleClear}
                  variant="destructive"
                  size={isSection ? "sm" : "default"}
                  className="w-full gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {this.props.clearLabel || "Clear Page Data"}
                </Button>
              )}
              {!isChunkError && !isDomMutation && (
                <Button
                  onClick={this.handleRefresh}
                  variant="secondary"
                  size={isSection ? "sm" : "default"}
                  className="w-full gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {this.props.refreshLabel || "Refresh Page"}
                </Button>
              )}
              {(!isSection || !this.props.onClearData) && (
                <Button
                  onClick={this.handleHome}
                  variant="outline"
                  size={isSection ? "sm" : "default"}
                  className="w-full gap-2"
                >
                  <Home className="w-4 h-4" />
                  {this.props.homeLabel || "Return to Home"}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function PageErrorBoundary({
  children,
  onClearData,
  clearLabel,
}: {
  children: ReactNode;
  onClearData?: () => void;
  clearLabel?: string;
}) {
  const { t } = useLanguage();
  return (
    <ErrorBoundary
      onClearData={onClearData}
      clearLabel={clearLabel || t.ui("common.clear")}
      refreshLabel={t.ui("common.refresh") || "Refresh Page"}
      reloadLabel={t.ui("common.reload") || "Reload"}
      homeLabel={t.ui("common.home") || "Home"}
      errorTitle={t.ui("common.error") || "Error"}
      errorDefaultMsg={
        typeof t.ui("common.errorMsg") === "string"
          ? t.ui("common.errorMsg")
          : "An unexpected error occurred."
      }
      chunkErrorMsg={t.ui("common.appUpdatedMsg") || undefined}
      domMutationMsg={t.ui("common.domMutationMsg") || undefined}
    >
      {children}
    </ErrorBoundary>
  );
}

export function SectionErrorBoundary({
  children,
  onClearData,
}: {
  children: ReactNode;
  onClearData?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <ErrorBoundary
      onClearData={onClearData}
      clearLabel={t.ui("common.clear")}
      refreshLabel={t.ui("common.refresh") || "Refresh Page"}
      reloadLabel={t.ui("common.reload") || "Reload"}
      homeLabel={t.ui("common.home") || "Home"}
      errorTitle={t.ui("common.error") || "Error"}
      errorDefaultMsg={
        typeof t.ui("common.errorMsg") === "string"
          ? t.ui("common.errorMsg")
          : "An unexpected error occurred."
      }
      chunkErrorMsg={t.ui("common.appUpdatedMsg") || undefined}
      domMutationMsg={t.ui("common.domMutationMsg") || undefined}
      isSection
    >
      {children}
    </ErrorBoundary>
  );
}
