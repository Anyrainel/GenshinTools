import { Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_CONTACT_METHOD_MAX_LENGTH,
  FeedbackApiError,
  isFeedbackRateLimitedError,
  submitFeedback,
} from "@/cloud/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type AccountFeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  isAccountLoading: boolean;
  accountId: string | null;
  onSignIn: () => Promise<void>;
};

type FeedbackFormState = {
  rating: number | null;
  suggestion: string;
  bugReport: string;
  contactMethod: string;
};

const EMPTY_FORM: FeedbackFormState = {
  rating: null,
  suggestion: "",
  bugReport: "",
  contactMethod: "",
};

const FEEDBACK_DRAFT_KEY = "ggartifact:feedback:draft";
const FEEDBACK_DRAFT_SAVE_DELAY_MS = 300;

export function AccountFeedbackDialog({
  open,
  onOpenChange,
  isAuthenticated,
  isAccountLoading,
  accountId,
  onSignIn,
}: AccountFeedbackDialogProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FeedbackFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextAllowedAt, setNextAllowedAt] = useState(0);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const skipDraftFlushOnClose = useRef(false);
  const cooldownKey = useMemo(
    () => (accountId ? `ggartifact:feedback:${accountId}:nextAllowedAt` : null),
    [accountId]
  );

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    const draft = readFeedbackDraft();
    if (!draft) return;
    setForm((current) => (hasFeedbackDraft(current) ? current : draft));
  }, [isAuthenticated, open]);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    const timeout = window.setTimeout(() => {
      writeFeedbackDraft(form);
    }, FEEDBACK_DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [form, isAuthenticated, open]);

  useEffect(() => {
    if (!open || !cooldownKey) return;
    const stored = Number(localStorage.getItem(cooldownKey) ?? 0);
    setNextAllowedAt(Number.isFinite(stored) ? stored : 0);
  }, [cooldownKey, open]);

  useEffect(() => {
    if (nextAllowedAt <= Date.now()) return;
    const timeout = window.setTimeout(
      () => setNextAllowedAt(0),
      nextAllowedAt - Date.now()
    );
    return () => window.clearTimeout(timeout);
  }, [nextAllowedAt]);

  const validationError = getValidationError(form, t);
  const isCoolingDown = nextAllowedAt > Date.now();
  const submitDisabled =
    isSubmitting || isCoolingDown || validationError !== null;

  const updateForm = (
    field: Exclude<keyof FeedbackFormState, "rating">,
    value: string
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setRequiresSignIn(false);
  };

  const updateRating = (rating: number) => {
    setForm((current) => ({ ...current, rating }));
    setFormError(null);
    setRequiresSignIn(false);
  };

  const saveCooldown = (value: number) => {
    setNextAllowedAt(value);
    if (cooldownKey) localStorage.setItem(cooldownKey, String(value));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (isCoolingDown) {
      setFormError(t.ui("feedback.rateLimited"));
      return;
    }
    if (form.rating === null) {
      setFormError(t.ui("feedback.ratingRequired"));
      return;
    }

    writeFeedbackDraft(form);
    setIsSubmitting(true);
    setFormError(null);
    setRequiresSignIn(false);
    try {
      const response = await submitFeedback({
        rating: form.rating,
        suggestion: form.suggestion,
        bugReport: form.bugReport,
        contactMethod: form.contactMethod,
      });
      saveCooldown(response.nextAllowedAt);
      skipDraftFlushOnClose.current = true;
      clearFeedbackDraft();
      setForm(EMPTY_FORM);
      toast.success(t.ui("feedback.submitSuccess"));
      handleFeedbackOpenChange(false);
    } catch (error) {
      if (isFeedbackRateLimitedError(error)) {
        saveCooldown(error.payload.retryAt);
        setFormError(t.ui("feedback.rateLimited"));
      } else if (error instanceof FeedbackApiError && error.status === 401) {
        setFormError(t.ui("feedback.signInRequiredError"));
        setRequiresSignIn(true);
      } else {
        setFormError(t.ui("feedback.submitFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeedbackOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (!skipDraftFlushOnClose.current) {
        writeFeedbackDraft(form);
      }
      skipDraftFlushOnClose.current = false;
    }
    onOpenChange(nextOpen);
  };

  const handleFeedbackSignIn = () => {
    writeFeedbackDraft(form);
    void handleSignIn(onOpenChange, onSignIn);
  };

  if (!isAuthenticated) {
    return (
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("feedback.signInRequiredTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              {t.ui("feedback.signInRequiredDesc")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t.ui("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSignIn(onOpenChange, onSignIn)}
              disabled={isAccountLoading}
            >
              {t.ui("accountSystem.signIn")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleFeedbackOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("feedback.title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("feedback.description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <RatingField
            label={t.ui("feedback.ratingLabel")}
            rating={form.rating}
            onChange={updateRating}
            starLabelTemplate={t.ui("feedback.ratingStarLabel")}
          />
          <FeedbackTextareaField
            id="feedback-suggestion"
            label={t.ui("feedback.suggestionLabel")}
            value={form.suggestion}
            onChange={(value) => updateForm("suggestion", value)}
            placeholder={t.ui("feedback.suggestionPlaceholder")}
          />
          <FeedbackTextareaField
            id="feedback-bug-report"
            label={t.ui("feedback.bugReportLabel")}
            value={form.bugReport}
            onChange={(value) => updateForm("bugReport", value)}
            placeholder={t.ui("feedback.bugReportPlaceholder")}
          />
          <div className="space-y-2">
            <Label htmlFor="feedback-contact">
              {t.ui("feedback.contactLabel")}
            </Label>
            <Input
              id="feedback-contact"
              value={form.contactMethod}
              onChange={(event) =>
                updateForm("contactMethod", event.target.value)
              }
              maxLength={FEEDBACK_CONTACT_METHOD_MAX_LENGTH}
              placeholder={t.ui("feedback.contactPlaceholder")}
            />
          </div>
          <div className="min-h-5 text-sm text-destructive">
            {formError ?? (isCoolingDown ? t.ui("feedback.rateLimited") : "")}
          </div>
          <ResponsiveDialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t.ui("common.cancel")}
            </Button>
            {requiresSignIn ? (
              <Button
                type="button"
                onClick={handleFeedbackSignIn}
                disabled={isAccountLoading}
              >
                {t.ui("accountSystem.signIn")}
              </Button>
            ) : (
              <Button type="submit" disabled={submitDisabled}>
                {isSubmitting
                  ? t.ui("feedback.submitting")
                  : t.ui("feedback.submit")}
              </Button>
            )}
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function FeedbackTextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {value.length}/{FEEDBACK_BODY_MAX_LENGTH}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={FEEDBACK_BODY_MAX_LENGTH}
        placeholder={placeholder}
        className="min-h-28 resize-y"
      />
    </div>
  );
}

function RatingField({
  label,
  rating,
  onChange,
  starLabelTemplate,
}: {
  label: string;
  rating: number | null;
  onChange: (rating: number) => void;
  starLabelTemplate: string;
}) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const activeRating = hoverRating ?? rating ?? 0;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHoverRating(null)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-primary"
            aria-label={formatStarLabel(starLabelTemplate, value)}
            onMouseEnter={() => setHoverRating(value)}
            onFocus={() => setHoverRating(value)}
            onBlur={() => setHoverRating(null)}
            onClick={() => onChange(value)}
          >
            <Star
              className={cn(
                "h-5 w-5",
                activeRating >= value && "fill-current text-primary"
              )}
            />
          </Button>
        ))}
      </div>
    </div>
  );
}

function formatStarLabel(template: string, value: number): string {
  return template.includes("{0}")
    ? template.replace("{0}", String(value))
    : `${value} ${template}`;
}

function getValidationError(
  form: FeedbackFormState,
  t: { ui: (path: string) => string }
): string | null {
  if (form.rating === null) {
    return t.ui("feedback.ratingRequired");
  }
  const suggestion = form.suggestion.trim();
  const bugReport = form.bugReport.trim();
  if (!suggestion && !bugReport) {
    return t.ui("feedback.bodyRequired");
  }
  if (suggestion.length > FEEDBACK_BODY_MAX_LENGTH) {
    return t.ui("feedback.suggestionTooLong");
  }
  if (bugReport.length > FEEDBACK_BODY_MAX_LENGTH) {
    return t.ui("feedback.bugReportTooLong");
  }
  if (form.contactMethod.trim().length > FEEDBACK_CONTACT_METHOD_MAX_LENGTH) {
    return t.ui("feedback.contactTooLong");
  }
  return null;
}

function hasFeedbackDraft(form: FeedbackFormState): boolean {
  return (
    form.rating !== null ||
    form.suggestion.trim().length > 0 ||
    form.bugReport.trim().length > 0 ||
    form.contactMethod.trim().length > 0
  );
}

function readFeedbackDraft(): FeedbackFormState | null {
  try {
    const raw = sessionStorage.getItem(FEEDBACK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FeedbackFormState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const draft = {
      rating:
        typeof parsed.rating === "number" &&
        parsed.rating >= 1 &&
        parsed.rating <= 5
          ? parsed.rating
          : null,
      suggestion:
        typeof parsed.suggestion === "string" ? parsed.suggestion : "",
      bugReport: typeof parsed.bugReport === "string" ? parsed.bugReport : "",
      contactMethod:
        typeof parsed.contactMethod === "string" ? parsed.contactMethod : "",
    };
    return hasFeedbackDraft(draft) ? draft : null;
  } catch {
    return null;
  }
}

function writeFeedbackDraft(form: FeedbackFormState) {
  try {
    if (!hasFeedbackDraft(form)) {
      sessionStorage.removeItem(FEEDBACK_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(FEEDBACK_DRAFT_KEY, JSON.stringify(form));
  } catch {
    // Losing a tab-local draft should not block the feedback form.
  }
}

function clearFeedbackDraft() {
  try {
    sessionStorage.removeItem(FEEDBACK_DRAFT_KEY);
  } catch {
    // Ignore unavailable session storage.
  }
}

async function handleSignIn(
  onOpenChange: (open: boolean) => void,
  onSignIn: () => Promise<void>
) {
  onOpenChange(false);
  await onSignIn();
}
