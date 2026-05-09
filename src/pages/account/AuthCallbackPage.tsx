import { useHandleSignInCallback } from "@logto/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { consumeLogtoReturnPath } from "@/cloud/authConfig";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isLoading, isAuthenticated, error } = useHandleSignInCallback(() => {
    const returnPath = consumeLogtoReturnPath();
    navigate(returnPath, { replace: true });
  });
  const [showStaleCallbackError, setShowStaleCallbackError] = useState(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || error) {
      setShowStaleCallbackError(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setShowStaleCallbackError(true);
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [error, isAuthenticated, isLoading]);

  const staleCallbackMessage = showStaleCallbackError
    ? t.ui("accountSystem.loginError.expired")
    : null;
  const errorMessage = error
    ? formatCallbackError(error, t)
    : staleCallbackMessage;

  return (
    <PageLayout>
      <ScrollLayout>
        <div className="space-y-4">
          <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
            <div className="p-4">
              {errorMessage ? (
                <>
                  <Alert variant="destructive">
                    <AlertTitle>{t.ui("accountSystem.loginFailed")}</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/account/cloud-backup">
                      {t.ui("accountSystem.cloudBackup")}
                    </Link>
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{t.ui("accountSystem.loginCallback")}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}

type LogtoCallbackErrorShape = Error & {
  code?: string;
  data?: unknown;
};

function formatCallbackError(
  error: Error,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  const details = getLogtoCallbackErrorDetails(error, t);
  if (details) return details;
  return t.ui("accountSystem.loginError.default");
}

function getLogtoCallbackErrorDetails(
  error: Error,
  t: ReturnType<typeof useLanguage>["t"]
): string | null {
  const logtoError = error as LogtoCallbackErrorShape;
  if (logtoError.code === "callback_uri_verification.error_found") {
    const oidc = parseOidcError(logtoError.data);
    if (oidc?.error === "invalid_target") {
      return t.ui("accountSystem.loginError.cloudBackupUnavailable");
    }
    return t.ui("accountSystem.loginError.rejected");
  }
  if (logtoError.code === "callback_uri_verification.redirect_uri_mismatched") {
    return t.ui("accountSystem.loginError.expired");
  }
  if (logtoError.code === "callback_uri_verification.missing_state") {
    return t.ui("accountSystem.loginError.expired");
  }
  if (logtoError.code === "callback_uri_verification.state_mismatched") {
    return t.ui("accountSystem.loginError.wrongSession");
  }
  if (logtoError.code === "callback_uri_verification.missing_code") {
    return t.ui("accountSystem.loginError.incomplete");
  }
  return null;
}

function parseOidcError(data: unknown): {
  error: string;
  errorDescription?: string;
} | null {
  if (!data || typeof data !== "object") return null;
  const maybeOidc = data as { error?: unknown; errorDescription?: unknown };
  if (typeof maybeOidc.error !== "string") return null;
  return {
    error: maybeOidc.error,
    ...(typeof maybeOidc.errorDescription === "string"
      ? { errorDescription: maybeOidc.errorDescription }
      : {}),
  };
}
