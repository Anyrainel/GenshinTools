import { useState } from "react";
import { CommunityFeed } from "@/components/shared/CommunityFeed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type CharacterComment,
  CommunityApiError,
  postCharacterComment,
  updateCharacterComment,
} from "@/providers/community/community";

export function CharacterCommentThread({
  comment,
  characterId,
  onSignIn,
  isReply = false,
}: {
  comment: CharacterComment;
  characterId: string;
  onSignIn: () => Promise<void>;
  isReply?: boolean;
}) {
  const { t, language } = useLanguage();
  const session = useAppSession();
  const [current, setCurrent] = useState(comment);
  const [mode, setMode] = useState<"edit" | "reply" | "delete" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [revision, setRevision] = useState(0);
  const owner = session.isAuthenticated && current.isOwner;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !mode || (mode !== "delete" && !draft.trim())) return;
    setBusy(true);
    setError(null);
    setExpired(false);
    try {
      if (mode === "reply") {
        await postCharacterComment(characterId, draft.trim(), current.id);
        setCurrent((value) => ({ ...value, replyCount: value.replyCount + 1 }));
        setShowReplies(true);
        setRevision((value) => value + 1);
      } else {
        await updateCharacterComment(
          characterId,
          current.id,
          mode === "delete" ? null : draft.trim()
        );
        setCurrent((value) =>
          mode === "delete"
            ? {
                ...value,
                body: "",
                authorEmail: null,
                isDeleted: true,
                isOwner: false,
              }
            : { ...value, body: draft.trim(), updatedAt: Date.now() }
        );
      }
      setMode(null);
      setDraft("");
    } catch (failure) {
      const status = failure instanceof CommunityApiError ? failure.status : 0;
      setExpired(status === 401);
      setError(
        status === 401
          ? t.ui("feedback.signInRequiredError")
          : status === 429
            ? t.ui("community.rateLimited")
            : mode === "reply"
              ? t.ui("community.postFailed")
              : t.ui("community.updateFailed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {!current.isDeleted && (
          <span className="font-medium break-all">
            {current.authorEmail ?? t.ui("feedback.anonymous")}
          </span>
        )}
        <time dateTime={new Date(current.createdAt).toISOString()}>
          {new Date(current.createdAt).toLocaleString(language)}
        </time>
        {current.updatedAt && !current.isDeleted && (
          <span>{t.ui("community.edited")}</span>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words">
        {current.isDeleted ? t.ui("community.deleted") : current.body}
      </p>
      <div className="flex flex-wrap gap-1">
        {!isReply && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (!session.isAuthenticated) {
                void onSignIn();
                return;
              }
              setMode("reply");
              setDraft("");
              setError(null);
            }}
          >
            {t.ui("community.reply")}
          </Button>
        )}
        {owner && (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMode("edit");
                setDraft(current.body);
                setError(null);
              }}
            >
              {t.ui("charEdit.editMode")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setMode("delete");
                setError(null);
              }}
            >
              {t.ui("common.delete")}
            </Button>
          </>
        )}
        {!isReply && current.replyCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showReplies}
            onClick={() => setShowReplies((value) => !value)}
          >
            {t
              .ui("community.replies")
              .replace("{0}", String(current.replyCount))}
          </Button>
        )}
      </div>
      {mode && (
        <form onSubmit={submit} className="space-y-2">
          {mode !== "delete" && (
            <>
              <Textarea
                aria-label={
                  mode === "reply"
                    ? t.ui("community.reply")
                    : t.ui("charEdit.editMode")
                }
                value={draft}
                maxLength={1000}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
              />
              <p className="text-sm">{draft.length}/1000</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              variant={mode === "delete" ? "destructive" : "default"}
              disabled={busy || (mode !== "delete" && !draft.trim())}
            >
              {mode === "delete"
                ? t.ui("community.confirmDelete")
                : mode === "edit"
                  ? t.ui("common.save")
                  : t.ui("community.reply")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setMode(null);
                setError(null);
              }}
            >
              {t.ui("common.cancel")}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {expired && (
        <Button
          size="sm"
          disabled={session.isLoading}
          onClick={() => void onSignIn()}
        >
          {t.ui("accountSystem.signIn")}
        </Button>
      )}
      {!isReply && showReplies && (
        <div className="ml-2 min-w-0 border-l-2 border-border pl-3 sm:ml-4 sm:pl-4">
          <CommunityFeed<CharacterComment>
            path={`/api/community/v1/characters/${encodeURIComponent(characterId)}/comments/${encodeURIComponent(current.id)}/replies`}
            includeOwn={session.isAuthenticated}
            compact
            revision={revision}
            renderItem={(reply) => (
              <CharacterCommentThread
                comment={reply}
                characterId={characterId}
                onSignIn={onSignIn}
                isReply
              />
            )}
          />
        </div>
      )}
    </div>
  );
}
