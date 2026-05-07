import { useHandleSignInCallback } from "@logto/react";
import { Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getLogtoRedirectUri, LOGTO_API_RESOURCE } from "@/cloud/authConfig";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isLoading, error } = useHandleSignInCallback(() => {
    navigate("/account", { replace: true });
  });
  const errorMessage = error ? formatCallbackError(error) : null;

  return (
    <PageLayout>
      <ScrollLayout>
        <div className="space-y-4">
          <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
            <div className="p-4">
              {error ? (
                <>
                  <Alert variant="destructive">
                    <AlertTitle>{t.ui("accountSystem.loginFailed")}</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/account">
                      {t.ui("accountSystem.openAccount")}
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

function formatCallbackError(error: Error): string {
  const details = getLogtoCallbackErrorDetails(error);
  if (details) return details;
  return error.message;
}

function getLogtoCallbackErrorDetails(error: Error): string | null {
  const logtoError = error as LogtoCallbackErrorShape;
  if (logtoError.code === "callback_uri_verification.error_found") {
    const oidc = parseOidcError(logtoError.data);
    if (oidc?.error === "invalid_target") {
      if (!LOGTO_API_RESOURCE) {
        return `Logto rejected an API resource request even though this app is configured for Free-plan sign-in tokens. Clear old sign-in state and start sign-in again from the Account page. Details: ${oidc.errorDescription ?? "resource indicator is missing or unknown."}`;
      }
      return `Logto rejected the cloud backup API resource "${LOGTO_API_RESOURCE}". In Logto, create or enable an API resource with this exact identifier, or set VITE_LOGTO_API_RESOURCE to the identifier you configured. Details: ${oidc.errorDescription ?? "resource indicator is missing or unknown."}`;
    }
    const reason = oidc
      ? `Logto returned ${oidc.error}${oidc.errorDescription ? `: ${oidc.errorDescription}` : ""}.`
      : "Logto returned an error in the sign-in callback.";
    return `${reason} If this is a redirect setup issue, check that the Logto app allows this exact redirect URI: ${getLogtoRedirectUri()}`;
  }
  if (logtoError.code === "callback_uri_verification.redirect_uri_mismatched") {
    return `The callback URL does not match the redirect URI used to start sign-in. The app expects: ${getLogtoRedirectUri()}`;
  }
  if (logtoError.code === "callback_uri_verification.missing_state") {
    return "The sign-in callback is missing state. Start sign-in again from the Account page instead of opening /callback directly.";
  }
  if (logtoError.code === "callback_uri_verification.state_mismatched") {
    return "The sign-in callback state does not match this browser session. Start sign-in again in the same browser tab.";
  }
  if (logtoError.code === "callback_uri_verification.missing_code") {
    return "The sign-in callback is missing the authorization code. Start sign-in again from the Account page.";
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
