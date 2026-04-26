import { Check, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { useArtifactManagerConnection } from "@/hooks/useArtifactManagerConnection";
import {
  type CategoryOutcome,
  type ScanOutcome,
  useArtifactScannerJob,
} from "@/hooks/useArtifactScannerJob";
import {
  convertGOODToAccountData,
  type GOODData,
} from "@/lib/account-data/import/goodConversion";
import { mergePartialAccountData } from "@/lib/account-data/import/mergeAccountData";
import type {
  CategoryProgress,
  ScanProgress,
  ScanRequest,
} from "@/lib/account-data/manager/types";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { ConnectionStatus, SetupInstructions } from "./managerSharedUI";

const DEFAULT_PORT = 8765;

type ScanTarget = "characters" | "weapons" | "artifacts";

interface ArtifactScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTarget?: ScanTarget;
}

export function ArtifactScannerDialog({
  open,
  onOpenChange,
  defaultTarget = "artifacts",
}: ArtifactScannerDialogProps) {
  const { t } = useLanguage();
  const [port, setPort] = useState(DEFAULT_PORT);
  const [portInput, setPortInput] = useState(String(DEFAULT_PORT));

  const [scanCharacters, setScanCharacters] = useState(
    defaultTarget === "characters"
  );
  const [scanWeapons, setScanWeapons] = useState(defaultTarget === "weapons");
  const [scanArtifacts, setScanArtifacts] = useState(
    defaultTarget === "artifacts"
  );

  const { connection } = useArtifactManagerConnection(open, port);
  const { phase, submit, reset } = useArtifactScannerJob(port);

  const commitPort = useCallback(() => {
    const n = Number.parseInt(portInput, 10);
    if (n > 0 && n <= 65535) {
      setPort(n);
    } else {
      setPortInput(String(port));
    }
  }, [portInput, port]);

  useEffect(() => {
    if (open) {
      setScanCharacters(defaultTarget === "characters");
      setScanWeapons(defaultTarget === "weapons");
      setScanArtifacts(defaultTarget === "artifacts");
    } else if (phase.type === "completed" || phase.type === "error") {
      reset();
    }
  }, [open, defaultTarget, phase.type, reset]);

  const isConnected = connection.status === "connected";
  const isReady =
    isConnected &&
    connection.health.enabled &&
    connection.health.gameAlive &&
    !connection.health.busy;
  const hasSelection = scanCharacters || scanWeapons || scanArtifacts;
  const isJobActive =
    phase.type === "submitting" ||
    phase.type === "submitted" ||
    phase.type === "running" ||
    phase.type === "fetching";

  const handleScan = useCallback(() => {
    const targets: ScanRequest = {
      characters: scanCharacters,
      weapons: scanWeapons,
      artifacts: scanArtifacts,
    };
    submit(targets);
  }, [scanCharacters, scanWeapons, scanArtifacts, submit]);

  const handleClose = useCallback(() => {
    if (phase.type === "completed" || phase.type === "error") {
      reset();
    }
    onOpenChange(false);
  }, [phase.type, reset, onOpenChange]);

  const handleApply = useCallback(
    (outcome: ScanOutcome) => {
      const account = getActiveAccount(useAccountStore.getState());
      if (!account) {
        toast.error(t.ui("accountData.noData"));
        return;
      }

      const chars =
        outcome.characters?.status === "success"
          ? outcome.characters.data
          : undefined;
      const weps =
        outcome.weapons?.status === "success"
          ? outcome.weapons.data
          : undefined;
      const arts =
        outcome.artifacts?.status === "success"
          ? outcome.artifacts.data
          : undefined;

      if (!chars && !weps && !arts) {
        // Nothing to apply — surface and bail.
        toast.error(t.ui("scanner.nothingToApply"));
        return;
      }

      const good: GOODData = {
        format: "GOOD",
        version: 3,
        source: "GOODScanner",
        ...(chars && { characters: chars }),
        ...(weps && { weapons: weps }),
        ...(arts && { artifacts: arts }),
      };

      const converted = convertGOODToAccountData(good, account.data.characters);
      const sections = converted.presentSections;
      const allPresent =
        sections.characters && sections.weapons && sections.artifacts;

      let finalData = converted.data;
      let artifactIdMap: Map<string, string> | undefined;
      if (!allPresent) {
        const merged = mergePartialAccountData(
          account.data,
          converted.data,
          sections
        );
        finalData = merged.data;
        artifactIdMap = merged.artifactIdMap;
      }

      applyAccountImport({
        accountId: account.id,
        data: finalData,
        artifactIdMap,
      });

      const counts: string[] = [];
      if (chars)
        counts.push(
          `${chars.length} ${t.ui("accountData.characters").toLowerCase()}`
        );
      if (weps)
        counts.push(
          `${weps.length} ${t.ui("accountData.weapons").toLowerCase()}`
        );
      if (arts)
        counts.push(
          `${arts.length} ${t.ui("accountData.artifacts").toLowerCase()}`
        );
      toast.success(
        t.ui("scanner.syncApplied").replace("{0}", counts.join(", "))
      );

      if (converted.warnings.length > 0) {
        toast.warning(
          t
            .ui("scanner.syncWarnings")
            .replace("{0}", String(converted.warnings.length))
        );
      }

      handleClose();
    },
    [t, handleClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.ui("scanner.title")}</DialogTitle>
          <DialogDescription>{t.ui("scanner.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {phase.type === "idle" && (
            <div className="space-y-4">
              <SetupInstructions t={t} />
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scanner-port" className="text-xs">
                    {t.ui("manager.port")}
                  </Label>
                  <Input
                    id="scanner-port"
                    className="w-24 h-8 text-sm"
                    value={portInput}
                    onChange={(e) => setPortInput(e.target.value)}
                    onBlur={commitPort}
                    onKeyDown={(e) => e.key === "Enter" && commitPort()}
                  />
                </div>
                <ConnectionStatus connection={connection} t={t} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t.ui("scanner.scanTargets")}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <ScanTargetRow
                    id="scan-characters"
                    checked={scanCharacters}
                    onChange={setScanCharacters}
                    label={t.ui("accountData.characters")}
                  />
                  <ScanTargetRow
                    id="scan-weapons"
                    checked={scanWeapons}
                    onChange={setScanWeapons}
                    label={t.ui("accountData.weapons")}
                  />
                  <ScanTargetRow
                    id="scan-artifacts"
                    checked={scanArtifacts}
                    onChange={setScanArtifacts}
                    label={t.ui("accountData.artifacts")}
                  />
                </div>
              </div>
            </div>
          )}

          {(phase.type === "submitting" || phase.type === "submitted") && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm">
                {phase.type === "submitting"
                  ? t.ui("manager.submitting")
                  : t.ui("manager.waitingForGame")}
              </span>
            </div>
          )}

          {phase.type === "running" && (
            <ScanProgressView
              targets={phase.targets}
              scanProgress={phase.scanProgress}
              t={t}
            />
          )}

          {phase.type === "fetching" && (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm">{t.ui("scanner.fetchingData")}</span>
            </div>
          )}

          {phase.type === "completed" && (
            <ScanResultSummary
              targets={phase.targets}
              outcome={phase.outcome}
              t={t}
              onApply={() => handleApply(phase.outcome)}
              onSkip={handleClose}
            />
          )}

          {phase.type === "error" && (
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm">{phase.message}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {phase.type === "idle" && (
            <Button disabled={!isReady || !hasSelection} onClick={handleScan}>
              {t.ui("scanner.startScan")}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {isJobActive ? t.ui("manager.minimize") : t.ui("manager.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScanProgressView({
  targets,
  scanProgress,
  t,
}: {
  targets: ScanRequest;
  scanProgress: ScanProgress;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const rows: {
    key: "characters" | "weapons" | "artifacts";
    label: string;
    progress: CategoryProgress | undefined;
    indeterminate: boolean;
  }[] = [];
  if (targets.characters)
    rows.push({
      key: "characters",
      label: t.ui("accountData.characters"),
      progress: scanProgress.characters,
      // The game doesn't expose a total for characters; render as a counter.
      indeterminate: true,
    });
  if (targets.weapons)
    rows.push({
      key: "weapons",
      label: t.ui("accountData.weapons"),
      progress: scanProgress.weapons,
      indeterminate: false,
    });
  if (targets.artifacts)
    rows.push({
      key: "artifacts",
      label: t.ui("accountData.artifacts"),
      progress: scanProgress.artifacts,
      indeterminate: false,
    });

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <CategoryProgressRow
          key={row.key}
          label={row.label}
          progress={row.progress}
          indeterminate={row.indeterminate}
          t={t}
        />
      ))}
    </ul>
  );
}

function CategoryProgressRow({
  label,
  progress,
  indeterminate,
  t,
}: {
  label: string;
  progress: CategoryProgress | undefined;
  indeterminate: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const state = progress?.state ?? "pending";
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;

  let icon: React.ReactNode;
  let labelClass = "";
  if (state === "complete") {
    icon = <Check className="h-4 w-4 text-green-500" />;
  } else if (state === "aborted") {
    icon = <XCircle className="h-4 w-4 text-destructive" />;
  } else if (state === "running") {
    icon = <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  } else {
    icon = <Circle className="h-4 w-4 text-muted-foreground" />;
    labelClass = "text-muted-foreground";
  }

  let detail: string;
  if (state === "pending") {
    detail = t.ui("scanner.statePending");
  } else if (state === "aborted") {
    detail = t.ui("manager.aborted");
  } else if (indeterminate) {
    // Characters: total stays equal to completed — show a raw count.
    detail = t.ui("scanner.countScanned").replace("{0}", String(completed));
  } else {
    detail = `${completed} / ${total || "?"}`;
  }

  const barValue = indeterminate || total <= 0 ? 0 : (completed / total) * 100;
  const showBar = !indeterminate && state !== "pending";

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span className={labelClass}>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {detail}
        </span>
      </div>
      {showBar && <Progress value={barValue} className="h-1.5" />}
    </li>
  );
}

function ScanTargetRow({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function CategoryOutcomeRow({
  label,
  result,
  t,
}: {
  label: string;
  result: CategoryOutcome<unknown> | undefined;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  let icon: React.ReactNode;
  let detail: string;
  let detailClass = "text-muted-foreground";
  if (result?.status === "success") {
    icon = <Check className="h-4 w-4 text-green-500" />;
    detail = t
      .ui("scanner.countItems")
      .replace("{0}", String(result.data.length));
  } else if (result?.status === "aborted") {
    icon = <XCircle className="h-4 w-4 text-destructive" />;
    detail = t.ui("manager.aborted");
    detailClass = "text-destructive";
  } else if (result?.status === "error") {
    icon = <XCircle className="h-4 w-4 text-destructive" />;
    detail = result.message;
    detailClass = "text-destructive";
  } else {
    // Shouldn't happen — category was requested but no outcome slot.
    icon = <Circle className="h-4 w-4 text-muted-foreground" />;
    detail = t.ui("scanner.noData");
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      {icon}
      <span>{label}</span>
      <span className={`text-xs ${detailClass} truncate`}>{detail}</span>
    </li>
  );
}

function ScanResultSummary({
  targets,
  outcome,
  t,
  onApply,
  onSkip,
}: {
  targets: ScanRequest;
  outcome: ScanOutcome;
  t: ReturnType<typeof useLanguage>["t"];
  onApply: () => void;
  onSkip: () => void;
}) {
  const rows: {
    key: "characters" | "weapons" | "artifacts";
    label: string;
    result: CategoryOutcome<unknown> | undefined;
  }[] = [];
  if (targets.characters)
    rows.push({
      key: "characters",
      label: t.ui("accountData.characters"),
      result: outcome.characters,
    });
  if (targets.weapons)
    rows.push({
      key: "weapons",
      label: t.ui("accountData.weapons"),
      result: outcome.weapons,
    });
  if (targets.artifacts)
    rows.push({
      key: "artifacts",
      label: t.ui("accountData.artifacts"),
      result: outcome.artifacts,
    });

  const successCount = rows.filter(
    (r) => r.result?.status === "success"
  ).length;
  const incompleteCount = rows.filter(
    (r) => r.result?.status !== "success"
  ).length;
  const allFailed = successCount === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {allFailed ? (
          <XCircle className="h-5 w-5 text-destructive" />
        ) : incompleteCount > 0 ? (
          <CheckCircle2 className="h-5 w-5 text-yellow-500" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}
        <span className="text-sm font-medium">
          {allFailed
            ? t.ui("scanner.allAborted")
            : incompleteCount > 0
              ? t.ui("scanner.scanPartial")
              : t.ui("scanner.scanComplete")}
        </span>
      </div>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <CategoryOutcomeRow
            key={r.key}
            label={r.label}
            result={r.result}
            t={t}
          />
        ))}
      </ul>
      {incompleteCount > 0 && !allFailed && (
        <p className="text-xs text-muted-foreground">
          {t.ui("scanner.partialApplyHint")}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApply} disabled={allFailed}>
          {incompleteCount > 0 && !allFailed
            ? t.ui("scanner.applyCompletedOnly")
            : t.ui("scanner.applyToAccount")}
        </Button>
        <Button size="sm" variant="outline" onClick={onSkip}>
          {t.ui("manager.skipSync")}
        </Button>
      </div>
    </div>
  );
}
