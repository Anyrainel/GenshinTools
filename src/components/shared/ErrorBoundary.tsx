import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { AlertTriangle, Home, RefreshCw, Trash2 } from "lucide-react";
import React, { type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClearData?: () => void;
  clearLabel?: string;
  refreshLabel?: string;
  homeLabel?: string;
  errorTitle?: string;
  errorDefaultMsg?: string;
  isSection?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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

  private handleHome = () => {
    window.location.href = import.meta.env.BASE_URL || "/";
  };

  public render() {
    if (this.state.hasError) {
      const { isSection } = this.props;

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
            </div>

            <div className="flex flex-col gap-2 w-full pt-2">
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
              <Button
                onClick={this.handleRefresh}
                variant="secondary"
                size={isSection ? "sm" : "default"}
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {this.props.refreshLabel || "Refresh Page"}
              </Button>
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
      homeLabel={t.ui("common.home") || "Home"}
      errorTitle={t.ui("common.error") || "Error"}
      errorDefaultMsg={
        typeof t.ui("common.errorMsg") === "string"
          ? t.ui("common.errorMsg")
          : "An unexpected error occurred."
      }
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
      homeLabel={t.ui("common.home") || "Home"}
      errorTitle={t.ui("common.error") || "Error"}
      errorDefaultMsg={
        typeof t.ui("common.errorMsg") === "string"
          ? t.ui("common.errorMsg")
          : "An unexpected error occurred."
      }
      isSection
    >
      {children}
    </ErrorBoundary>
  );
}
