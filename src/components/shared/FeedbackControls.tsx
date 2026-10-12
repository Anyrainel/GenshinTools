import { Eye, EyeOff, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PublicFeedback } from "@/providers/community/community";
import { updateFeedbackPost } from "@/providers/community/feedback";

export function FeedbackControls({ post }: { post: PublicFeedback }) {
  const { t } = useLanguage();
  const session = useAppSession();
  const [current, setCurrent] = useState(post);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function update(action: "visibility" | "vote", enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setCurrent(await updateFeedbackPost(post.id, action, enabled));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          {current.authorEmail ?? t.ui("feedback.anonymous")}
        </span>
        {!current.isPublic && (
          <span className="text-sm">{t.ui("feedback.hidden")}</span>
        )}
        <Button
          variant="outline"
          size="sm"
          aria-label={t.ui("feedback.upvote")}
          aria-pressed={current.hasUpvoted}
          disabled={busy || !session.isAuthenticated}
          onClick={() => void update("vote", !current.hasUpvoted)}
        >
          <ThumbsUp className="size-4" /> {current.upvotes}
        </Button>
        {current.isOwner && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void update("visibility", !current.isPublic)}
          >
            {current.isPublic ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {current.isPublic
              ? t.ui("feedback.hide")
              : t.ui("feedback.publish")}
          </Button>
        )}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t.ui("feedback.updateFailed")}
        </p>
      )}
    </div>
  );
}
