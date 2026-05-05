import { useHandleSignInCallback } from "@logto/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isLoading, error } = useHandleSignInCallback(() => {
    navigate("/account", { replace: true });
  });

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => {
      navigate("/account", { replace: true });
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [error, navigate]);

  return (
    <PageLayout>
      <ScrollLayout>
        <div className="space-y-4">
          <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
            <div className="p-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>{t.ui("accountSystem.loginFailed")}</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
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
