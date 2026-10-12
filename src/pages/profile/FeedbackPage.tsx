import { useState } from "react";
import { toast } from "sonner";
import { AccountFeedbackDialog } from "@/components/layout/AccountFeedbackDialog";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { CommunityFeed } from "@/components/shared/CommunityFeed";
import { FeedbackControls } from "@/components/shared/FeedbackControls";
import { Button } from "@/components/ui/button";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PublicFeedback } from "@/providers/community/community";

export default function FeedbackPage() {
  const { t, language } = useLanguage();
  const session = useAppSession();
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  return (
    <PageLayout>
      <ScrollLayout
        header={
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">
              {t.ui("accountSystem.feedback")}
            </h1>
            <Button onClick={() => setOpen(true)}>
              {t.ui("feedback.title")}
            </Button>
          </div>
        }
      >
        <CommunityFeed<PublicFeedback>
          key={
            session.isAuthenticated
              ? (session.account?.id ?? "signed-in")
              : "anonymous"
          }
          includeOwn={session.isAuthenticated}
          path="/api/feedback/v1/submissions"
          revision={revision}
          renderItem={(item) => (
            <>
              <FeedbackControls post={item} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  role="img"
                  aria-label={t
                    .ui("feedback.ratingStarLabel")
                    .replace("{0}", String(item.rating))}
                >
                  {"★".repeat(item.rating)}
                  {"☆".repeat(5 - item.rating)}
                </span>
                <time dateTime={new Date(item.createdAt).toISOString()}>
                  {new Date(item.createdAt).toLocaleString(language)}
                </time>
              </div>
              {item.suggestion && (
                <div>
                  <h2 className="font-medium">
                    {t.ui("feedback.suggestionLabel")}
                  </h2>
                  <p className="whitespace-pre-wrap">{item.suggestion}</p>
                </div>
              )}
              {item.bugReport && (
                <div>
                  <h2 className="font-medium">
                    {t.ui("feedback.bugReportLabel")}
                  </h2>
                  <p className="whitespace-pre-wrap">{item.bugReport}</p>
                </div>
              )}
            </>
          )}
        />
      </ScrollLayout>
      <AccountFeedbackDialog
        open={open}
        onOpenChange={setOpen}
        onSubmitted={() => setRevision((value) => value + 1)}
        isAuthenticated={session.isAuthenticated}
        isAccountLoading={session.isLoading}
        accountId={session.account?.id ?? null}
        onSignIn={async () => {
          try {
            await session.signIn("/feedback");
          } catch {
            toast.error(t.ui("accountSystem.loginFailed"));
          }
        }}
      />
    </PageLayout>
  );
}
