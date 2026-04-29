import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

type AgeParts =
  | { kind: "now" }
  | { kind: "minutes"; value: number }
  | { kind: "hours"; value: number }
  | { kind: "days"; value: number }
  | { kind: "months"; value: number }
  | { kind: "years"; value: number };

function getAgeParts(lastUpdate: number, now: number): AgeParts {
  const diff = Math.max(0, now - lastUpdate);
  if (diff < MINUTE_MS) return { kind: "now" };
  if (diff < HOUR_MS) {
    return {
      kind: "minutes",
      value: Math.floor(diff / MINUTE_MS),
    };
  }
  if (diff < DAY_MS) {
    return {
      kind: "hours",
      value: Math.floor(diff / HOUR_MS),
    };
  }
  if (diff < MONTH_MS) {
    return {
      kind: "days",
      value: Math.floor(diff / DAY_MS),
    };
  }
  if (diff < YEAR_MS) {
    return {
      kind: "months",
      value: Math.floor(diff / MONTH_MS),
    };
  }
  return {
    kind: "years",
    value: Math.floor(diff / YEAR_MS),
  };
}

function useAccountDataSourceAgeLabel(lastUpdate?: number | null) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (
    typeof lastUpdate !== "number" ||
    !Number.isFinite(lastUpdate) ||
    lastUpdate <= 0
  ) {
    return null;
  }
  const parts = getAgeParts(lastUpdate, now);
  switch (parts.kind) {
    case "now":
      return t.ui("accountData.updatedJustNow");
    case "minutes":
      return t.format("accountData.updatedMinutes", parts.value);
    case "hours":
      return t.format("accountData.updatedHours", parts.value);
    case "days":
      return t.format("accountData.updatedDays", parts.value);
    case "months":
      return t.format("accountData.updatedMonths", parts.value);
    case "years":
      return t.format("accountData.updatedYears", parts.value);
  }
}

export function AccountDataSourceAgeBadge({
  lastUpdate,
}: {
  lastUpdate?: number | null;
}) {
  const label = useAccountDataSourceAgeLabel(lastUpdate);
  if (!label) return null;

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

export function AccountDataSourceAgeBanner({
  lastUpdate,
}: {
  lastUpdate?: number | null;
}) {
  const { t } = useLanguage();
  const label = useAccountDataSourceAgeLabel(lastUpdate);
  if (!label) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/10 px-3 py-2 text-sm text-foreground">
      <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{t.format("accountData.sourceUpdatedBanner", label)}</span>
    </div>
  );
}
