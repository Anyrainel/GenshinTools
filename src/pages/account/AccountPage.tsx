import { Cloud, LogOut, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  clearCloudBackupDevSession,
  getCloudBackupDevSession,
  saveCloudBackupDevSession,
} from "@/cloud/session";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AccountPage() {
  const { t } = useLanguage();
  const [userId, setUserId] = useState("");
  const [authSecret, setAuthSecret] = useState("");

  useEffect(() => {
    const session = getCloudBackupDevSession();
    setUserId(session?.userId ?? "");
    setAuthSecret(session?.authSecret ?? "");
  }, []);

  const hasSession = userId.trim() !== "" && authSecret.trim() !== "";

  const handleSave = () => {
    if (!hasSession) {
      toast.error(t.ui("accountSystem.devSessionMissing"));
      return;
    }
    saveCloudBackupDevSession({
      userId,
      authSecret,
    });
    toast.success(t.ui("accountSystem.devSessionSaved"));
  };

  const handleSignOut = () => {
    clearCloudBackupDevSession();
    setUserId("");
    setAuthSecret("");
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
                  {t.ui("accountData.account")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.ui("accountSystem.accountDesc")}
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="backup-dev-user">
                    {t.ui("accountSystem.devUserId")}
                  </Label>
                  <Input
                    id="backup-dev-user"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="dev-user"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="backup-dev-secret">
                    {t.ui("accountSystem.devAuthSecret")}
                  </Label>
                  <Input
                    id="backup-dev-secret"
                    type="password"
                    value={authSecret}
                    onChange={(event) => setAuthSecret(event.target.value)}
                    placeholder="BACKUP_DEV_AUTH_SECRET"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasSession}
                >
                  <Save className="h-4 w-4" />
                  {t.ui("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  disabled={!getCloudBackupDevSession()}
                >
                  <LogOut className="h-4 w-4" />
                  {t.ui("accountSystem.signOut")}
                </Button>
                <Button asChild type="button" variant="secondary">
                  <Link to="/account/cloud-backup">
                    <Cloud className="h-4 w-4" />
                    {t.ui("accountSystem.cloudBackup")}
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
