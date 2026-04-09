import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, ExternalLink, HelpCircle, SearchCheck } from "lucide-react";

interface AccountDataNeedsBothStateProps {
  /** Whether account data is missing (shows import account button) */
  needsAccountData: boolean;
  /** Whether build data is missing (shows go-to-builds button) */
  needsBuilds: boolean;
  /** Opens the account import dialog */
  onOpenImport?: () => void;
  /** Starts the account-data tour */
  onShowTour?: () => void;
}

/**
 * Shared empty state for views that require both account data AND builds
 * (Recommendation, Evaluation, Triage).
 * Shows up to two action buttons depending on what's missing.
 */
export function AccountDataNeedsBothState({
  needsAccountData,
  needsBuilds,
  onOpenImport,
  onShowTour,
}: AccountDataNeedsBothStateProps) {
  const { t } = useLanguage();

  // Primary action is whichever is missing first (account data > builds)
  const primary =
    needsAccountData && onOpenImport
      ? {
          label: t.ui("import.titleAccountData"),
          icon: Download,
          onClick: onOpenImport,
        }
      : needsBuilds
        ? {
            label: t.ui("evaluation.goToBuilds"),
            icon: ExternalLink,
            href: "/artifact-filter/configure",
          }
        : undefined;

  // Secondary only when both are missing
  const secondary =
    needsAccountData && needsBuilds
      ? {
          label: t.ui("evaluation.goToBuilds"),
          icon: ExternalLink,
          href: "/artifact-filter/configure",
        }
      : undefined;

  return (
    <EmptyState
      icon={SearchCheck}
      title={t.ui("accountData.needsBothTitle")}
      description={t.ui("accountData.needsBothDesc")}
      action={primary}
      secondaryAction={secondary}
      helpAction={
        onShowTour
          ? {
              label: t.ui("buttons.help"),
              icon: HelpCircle,
              onClick: onShowTour,
            }
          : undefined
      }
    />
  );
}
