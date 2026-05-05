import { AlertCircle, LogOut, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  clearCloudBackupDevSession,
  DEFAULT_CLOUD_BACKUP_DEV_USER_ID,
  getCloudBackupDevSession,
  loginCloudBackupDevAccount,
} from "@/cloud/session";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AccountPage() {
  const { t } = useLanguage();
  const [userId, setUserId] = useState("");
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const session = getCloudBackupDevSession();
    setUserId(session?.userId ?? DEFAULT_CLOUD_BACKUP_DEV_USER_ID);
    setHasSavedSession(Boolean(session));
  }, []);

  const hasSession = userId.trim() !== "";

  const handleUseAccount = async () => {
    if (!hasSession) {
      toast.error(t.ui("accountSystem.devSessionMissing"));
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginCloudBackupDevAccount(userId);
      setHasSavedSession(true);
      toast.success(t.ui("accountSystem.devSessionSaved"));
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleClearAccount = () => {
    clearCloudBackupDevSession();
    setUserId(DEFAULT_CLOUD_BACKUP_DEV_USER_ID);
    setHasSavedSession(false);
    toast.success(t.ui("accountSystem.signedOut"));
  };

  return (
    <PageLayout>
      <ScrollLayout bodyClassName="max-w-3xl">
        <div className="space-y-4">
          <section className="rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
            <div className="bg-gradient-select border-b border-border/70 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold">
                  {t.ui("accountSystem.devAccountTitle")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.ui("accountSystem.accountDesc")}
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            </div>

            <div className="p-4 space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t.ui("accountSystem.loginFailed")}</AlertTitle>
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="backup-dev-user">
                    {t.ui("accountSystem.devUserId")}
                  </Label>
                  <Input
                    id="backup-dev-user"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder={DEFAULT_CLOUD_BACKUP_DEV_USER_ID}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void handleUseAccount()}
                  disabled={!hasSession || isLoggingIn}
                >
                  <UserCheck className="h-4 w-4" />
                  {t.ui("accountSystem.useDevAccount")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearAccount}
                  disabled={!hasSavedSession}
                >
                  <LogOut className="h-4 w-4" />
                  {t.ui("accountSystem.clearDevAccount")}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
