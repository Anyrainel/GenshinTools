import {
  AlertCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { LOGTO_API_RESOURCE } from "@/cloud/authConfig";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLogtoAccountSummary } from "@/hooks/useLogtoAccountSummary";

export default function AccountPage() {
  const { t } = useLanguage();
  const {
    isAuthenticated,
    isLoading,
    error,
    account,
    accountError,
    signIn,
    signOut,
  } = useLogtoAccountSummary();
  const signedInLabel = useMemo(() => {
    if (!account) return t.ui("accountSystem.signedIn");
    return account.displayName ?? account.email ?? account.subject;
  }, [account, t]);

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (signInError) {
      toast.error(
        signInError instanceof Error ? signInError.message : String(signInError)
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (signOutError) {
      toast.error(
        signOutError instanceof Error
          ? signOutError.message
          : String(signOutError)
      );
    }
  };

  return (
    <PageLayout>
      <ScrollLayout>
        <div className="space-y-4">
          <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
            <div className="bg-gradient-select border-b border-border/70 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold">
                  {t.ui("accountSystem.accountTitle")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.ui("accountSystem.accountDesc")}
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            </div>

            <div className="p-4 space-y-4">
              {(error || accountError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.ui("accountSystem.loginFailed")}</AlertTitle>
                  <AlertDescription>
                    {accountError ?? error?.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full border border-border p-2">
                      <UserRound className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {isAuthenticated
                          ? signedInLabel
                          : t.ui("accountSystem.signedOut")}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {isAuthenticated
                          ? (account?.email ??
                            t.ui("accountSystem.logtoAccount"))
                          : t.ui("accountSystem.signInRequiredDesc")}
                      </div>
                    </div>
                  </div>
                  <Badge variant={isAuthenticated ? "default" : "secondary"}>
                    {isLoading
                      ? t.ui("common.loading")
                      : isAuthenticated
                        ? t.ui("accountSystem.status.signedIn")
                        : t.ui("accountSystem.status.signedOut")}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">
                  {t
                    .ui("accountSystem.apiResource")
                    .replace("{0}", LOGTO_API_RESOURCE)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSignIn()}
                  disabled={isLoading || isAuthenticated}
                >
                  <LogIn className="h-4 w-4" />
                  {t.ui("accountSystem.signIn")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  disabled={isLoading || !isAuthenticated}
                >
                  <LogOut className="h-4 w-4" />
                  {t.ui("accountSystem.signOut")}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
