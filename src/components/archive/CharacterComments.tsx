import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CharacterCommentThread } from "@/components/archive/CharacterCommentThread";
import { CommunityFeed } from "@/components/shared/CommunityFeed";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type CharacterComment,
  CommunityApiError,
  postCharacterComment,
} from "@/providers/community/community";

export function CharacterComments({ characterId }: { characterId: string }) {
  const { t } = useLanguage();
  const session = useAppSession();
  const location = useLocation();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  async function signIn() {
    try {
      await session.signIn(`${location.pathname}${location.search}`);
    } catch {
      setError(t.ui("accountSystem.loginFailed"));
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postCharacterComment(characterId, body.trim());
      setBody("");
      setRevision((value) => value + 1);
      setRequiresSignIn(false);
    } catch (failure) {
      setRequiresSignIn(
        failure instanceof CommunityApiError && failure.status === 401
      );
      setError(
        failure instanceof CommunityApiError && failure.status === 429
          ? t.ui("community.rateLimited")
          : failure instanceof CommunityApiError && failure.status === 401
            ? t.ui("feedback.signInRequiredError")
            : t.ui("community.postFailed")
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">{t.ui("community.comments")}</h3>
      <p className="text-sm">{t.ui("community.publicCommentNotice")}</p>
      {session.isAuthenticated ? (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            aria-label={t.ui("community.comments")}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            disabled={busy}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{body.length}/1000</span>
            <Button disabled={busy || !body.trim()} type="submit">
              {t.ui("community.post")}
            </Button>
          </div>
        </form>
      ) : (
        <Button disabled={session.isLoading} onClick={() => void signIn()}>
          {t.ui("accountSystem.signIn")}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {requiresSignIn && (
        <Button disabled={session.isLoading} onClick={() => void signIn()}>
          {t.ui("accountSystem.signIn")}
        </Button>
      )}
      <CommunityFeed<CharacterComment>
        path={`/api/community/v1/characters/${encodeURIComponent(characterId)}/comments`}
        revision={revision}
        includeOwn={session.isAuthenticated}
        renderItem={(comment) => (
          <CharacterCommentThread
            comment={comment}
            characterId={characterId}
            onSignIn={signIn}
          />
        )}
      />
    </section>
  );
}
