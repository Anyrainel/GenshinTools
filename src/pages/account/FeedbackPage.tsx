import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AccountFeedbackDialog } from "@/components/layout/AccountFeedbackDialog";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FeedbackPage() {
  const { t } = useLanguage();
  const session = useAppSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <PageLayout>
      <div className="flex flex-1 items-center justify-center">
        <Button onClick={() => setOpen(true)}>
          {t.ui("accountSystem.feedback")}
        </Button>
      </div>
      <AccountFeedbackDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) navigate("/");
        }}
        isAuthenticated={session.isAuthenticated}
        isAccountLoading={session.isLoading}
        accountId={session.account?.id ?? null}
        onSignIn={async () => {
          try {
            await session.signIn("/account/feedback");
          } catch {
            toast.error(t.ui("accountSystem.loginFailed"));
          }
        }}
      />
    </PageLayout>
  );
}
