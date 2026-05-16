import {
  AlertCircle,
  Download,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Monitor,
  Smartphone,
  Star,
  Upload,
} from "lucide-react";
import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import type { ControlHandle } from "@/components/shared/controlHandle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GOODData } from "@/lib/account-data/import/goodConversion";
import { cn } from "@/lib/utils";

interface AccountImportControlProps {
  onLocalImport: (data: GOODData, optionalUid: string) => void;
  onUidImport: (uid: string, clearData: boolean) => Promise<void>;
  onHoyolabImport: (
    uid: string,
    cookie: string,
    clearData: boolean
  ) => Promise<void>;
  initialUid?: string;
}

const TOOLS = [
  {
    labelKey: "import.toolGoodCapture" as const,
    url: "https://github.com/Anyrainel/GOODScanner/releases",
  },
  {
    labelKey: "import.toolGoodScanner" as const,
    url: "https://github.com/Anyrainel/GOODScanner/releases",
  },
] as const;

const PROXY_TOOLS = [
  {
    label: "data_cache.json",
    url: "/good/data_cache.json",
  },
  {
    label: "GOODScanner.exe",
    url: "https://gh-proxy.org/https://github.com/Anyrainel/GOODScanner/releases/latest/download/GOODScanner.exe",
  },
  {
    label: "GOODCapture.exe",
    url: "https://gh-proxy.org/https://github.com/Anyrainel/GOODScanner/releases/latest/download/GOODCapture.exe",
  },
] as const;

/**
 * AccountImportControl - A dialog for importing account data.
 *
 * Supports GOOD JSON file import (recommended, full inventory) and Enka UID import (quick, limited).
 * Card-based layout with visual hierarchy to guide users toward the recommended method.
 */
export const AccountImportControl = forwardRef<
  ControlHandle,
  AccountImportControlProps
>(function AccountImportControl(
  { onLocalImport, onUidImport, onHoyolabImport, initialUid },
  ref
) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uidInput, setUidInput] = useState(initialUid || "");
  const [localUidInput, setLocalUidInput] = useState(
    () => localStorage.getItem("gg_last_local_uid") || ""
  );
  const [clearData, setClearData] = useState(false);
  // HoYoLAB cookie parts — stored per field so users don't need to assemble
  // the "k=v; k=v" string themselves.
  const [osLtuid, setOsLtuid] = useState(
    () => localStorage.getItem("gg_hoyolab_os_ltuid") || ""
  );
  const [osLtoken, setOsLtoken] = useState(
    () => localStorage.getItem("gg_hoyolab_os_ltoken") || ""
  );
  const [cnAccountId, setCnAccountId] = useState(
    () => localStorage.getItem("gg_hoyolab_cn_account_id") || ""
  );
  const [cnCookieToken, setCnCookieToken] = useState(
    () => localStorage.getItem("gg_hoyolab_cn_cookie_token") || ""
  );
  const [hoyolabClear, setHoyolabClear] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [hoyolabRegion, setHoyolabRegion] = useState<"os" | "cn">(
    () => (localStorage.getItem("gg_hoyolab_region") as "os" | "cn") || "os"
  );

  const isValidUid = (uid: string) => /^\d{9,10}$/.test(uid.trim());

  const hoyolabCookieReady =
    hoyolabRegion === "os"
      ? !!osLtuid.trim() && !!osLtoken.trim()
      : !!cnAccountId.trim() && !!cnCookieToken.trim();

  const assembledCookie = () =>
    hoyolabRegion === "os"
      ? `ltuid_v2=${osLtuid.trim()}; ltoken_v2=${osLtoken.trim()}`
      : `account_id=${cnAccountId.trim()}; cookie_token=${cnCookieToken.trim()}`;

  const isGOODFormat = (data: unknown): boolean =>
    typeof data === "object" &&
    data !== null &&
    "format" in data &&
    (data as Record<string, unknown>).format === "GOOD";

  useEffect(() => {
    if (initialUid) {
      setUidInput(initialUid);
    }
  }, [initialUid]);

  useImperativeHandle(ref, () => ({
    open: () => {
      setErrorMessage(null);
      setIsOpen(true);
    },
  }));

  const handleLocalImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (!isGOODFormat(imported)) {
          setErrorMessage(t.ui("import.wrongFormat"));
          return;
        }
        if (localUidInput) {
          localStorage.setItem("gg_last_local_uid", localUidInput);
        } else {
          localStorage.removeItem("gg_last_local_uid");
        }
        onLocalImport(imported, localUidInput.trim());
        setIsOpen(false);
      } catch (error) {
        console.error("Failed to import data:", error);
        setErrorMessage(t.ui("import.fileLoadError"));
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleHoyolabImport = async () => {
    if (!uidInput || !isValidUid(uidInput)) return;
    if (!hoyolabCookieReady) {
      setErrorMessage(t.ui("import.hoyolabMissingCookie"));
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      if (hoyolabRegion === "os") {
        localStorage.setItem("gg_hoyolab_os_ltuid", osLtuid.trim());
        localStorage.setItem("gg_hoyolab_os_ltoken", osLtoken.trim());
      } else {
        localStorage.setItem("gg_hoyolab_cn_account_id", cnAccountId.trim());
        localStorage.setItem(
          "gg_hoyolab_cn_cookie_token",
          cnCookieToken.trim()
        );
      }
      await onHoyolabImport(uidInput, assembledCookie(), hoyolabClear);
      setIsOpen(false);
    } catch (error: unknown) {
      console.error("HoYoLAB Import failed", error);
      let message = t.ui("import.fileLoadError");
      if (error instanceof Error) {
        message = error.message;
      }
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleUidImport = async () => {
    if (!uidInput || !isValidUid(uidInput)) return;

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onUidImport(uidInput, clearData);
      setIsOpen(false);
    } catch (error: unknown) {
      console.error("UID Import failed", error);
      let message = t.ui("import.fileLoadError");
      if (error instanceof Error) {
        message = error.message;
      }
      setErrorMessage(message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setErrorMessage(null);
      }}
    >
      <ResponsiveDialogContent className="md:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("import.titleAccountData")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {t.ui("import.goodTitle")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          {/* ── Recommended: GOOD Import Card ── */}
          <div
            className={cn(
              "relative rounded-lg border p-4",
              "border-primary/40 bg-primary/[0.04]"
            )}
          >
            {/* Badge */}
            <span
              className={cn(
                "absolute -top-2.5 right-3",
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
                "bg-primary/70 text-primary-foreground text-xs font-semibold"
              )}
            >
              <Star className="w-3 h-3" />
              {t.ui("import.recommended")}
            </span>

            {/* Header row */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Monitor className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  {t.ui("import.goodTitle")}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  {t.ui("import.goodBenefit")}
                </p>
              </div>
            </div>

            {/* PC requirement banner + tool links */}
            <div className="mt-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-yellow-500 shrink-0" />
                <span className="text-sm text-yellow-500">
                  {t.ui("import.goodPcHint")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 lg:ml-6">
                {TOOLS.map((tool) => (
                  <a
                    key={tool.labelKey}
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
                      "text-xs font-medium",
                      "border border-primary/30 bg-primary/15",
                      "text-foreground/80 hover:bg-primary/25 hover:border-primary/50",
                      "transition-colors"
                    )}
                  >
                    {t.ui(tool.labelKey)}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-2">
              <span className="text-xs text-foreground/80">
                {t.ui("import.proxyHint")}
              </span>
              {PROXY_TOOLS.map((tool, i) => (
                <Fragment key={tool.label}>
                  {i > 0 && (
                    <span className="text-xs text-foreground/50">/</span>
                  )}
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer"
                    download={tool.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
                      "text-xs font-medium",
                      "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
                      "transition-colors"
                    )}
                  >
                    {tool.label}
                    <Download className="w-3 h-3 opacity-60" />
                  </a>
                </Fragment>
              ))}
            </div>

            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t.ui("import.optionalUid") || "Optional UID"}
                  value={localUidInput}
                  onChange={(e) => setLocalUidInput(e.target.value)}
                  className="flex h-9 w-32 sm:w-36 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                />
                <Button
                  size="sm"
                  className="gap-2 shrink-0 flex-grow sm:flex-1 relative overflow-hidden"
                  disabled={
                    isBusy ||
                    (!!localUidInput.trim() && !isValidUid(localUidInput))
                  }
                >
                  <Upload className="w-4 h-4" />
                  {t.ui("import.goodFileButton")}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleLocalImport}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={
                      isBusy ||
                      (!!localUidInput.trim() && !isValidUid(localUidInput))
                    }
                  />
                </Button>
              </div>
              {localUidInput.trim() && !isValidUid(localUidInput) && (
                <p className="text-xs text-destructive">
                  {t.ui("import.uidInvalid")}
                </p>
              )}
              <p className="text-xs text-sky-600 text-right">
                {t.ui("import.goodSplitFileHint")}
              </p>
            </div>
          </div>

          {/* ── Quick: UID Import Card ── */}
          <div className="rounded-lg border border-border p-4">
            {/* Header row */}
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted/60 p-2 shrink-0">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  {t.ui("import.uidTitle")}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  {t.ui("import.uidDescription")}
                </p>
              </div>
            </div>

            {/* UID input row */}
            <div className="flex flex-col gap-1.5 mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t.ui("import.uidPlaceholder") || "UID"}
                  value={uidInput}
                  onChange={(e) => setUidInput(e.target.value)}
                  className="flex h-9 w-32 sm:w-36 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                  onKeyDown={(e) => e.key === "Enter" && handleUidImport()}
                />
                <div className="flex items-center space-x-1.5 shrink-0">
                  <Checkbox
                    id="clearData"
                    checked={clearData}
                    onBooleanChange={setClearData}
                    disabled={isBusy}
                  />
                  <Label
                    htmlFor="clearData"
                    className="text-[10px] sm:text-xs font-normal text-muted-foreground cursor-pointer whitespace-nowrap"
                  >
                    {t.ui("import.clearBeforeImport")}
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleUidImport}
                  disabled={!uidInput || !isValidUid(uidInput) || isBusy}
                  className="flex-grow sm:flex-1 lg:ml-6 border-2 border-primary bg-primary/15 text-foreground font-semibold"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t.ui("import.action")
                  )}
                </Button>
              </div>
              {uidInput.trim() && !isValidUid(uidInput) && (
                <p className="text-xs text-destructive">
                  {t.ui("import.uidInvalid")}
                </p>
              )}
              <p className="text-xs text-sky-600 text-right">
                {t
                  .ui("import.enkaStatusHint")
                  .split(/\{link\}|\{\/link\}/)
                  .map((part, i) =>
                    i === 1 ? (
                      <a
                        key={i}
                        href="https://status.enka.network/"
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-sky-300 hover:text-sky-200"
                      >
                        {part}
                      </a>
                    ) : (
                      <Fragment key={i}>{part}</Fragment>
                    )
                  )}
              </p>
            </div>
          </div>

          {/* ── HoYoLAB / 米游社 Cookie Import Card ── */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted/60 p-2 shrink-0">
                <KeyRound className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  {t.ui("import.hoyolabTitle")}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  {t.ui("import.hoyolabDescription")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-input overflow-hidden shrink-0">
                  {(["os", "cn"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setHoyolabRegion(r);
                        localStorage.setItem("gg_hoyolab_region", r);
                      }}
                      disabled={isBusy}
                      className={cn(
                        "px-3 h-9 text-xs font-medium transition-colors",
                        hoyolabRegion === r
                          ? "bg-primary/15 text-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted/60"
                      )}
                    >
                      {t.ui(
                        r === "os"
                          ? "import.hoyolabRegionOs"
                          : "import.hoyolabRegionCn"
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Info className="w-3.5 h-3.5" />
                  {t.ui("import.hoyolabHowTo")}
                </button>
              </div>

              {hoyolabRegion === "os" ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    placeholder="ltuid_v2"
                    value={osLtuid}
                    onChange={(e) => setOsLtuid(e.target.value)}
                    disabled={isBusy}
                    className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <input
                    type="password"
                    placeholder="ltoken_v2"
                    value={osLtoken}
                    onChange={(e) => setOsLtoken(e.target.value)}
                    disabled={isBusy}
                    className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    placeholder="account_id"
                    value={cnAccountId}
                    onChange={(e) => setCnAccountId(e.target.value)}
                    disabled={isBusy}
                    className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <input
                    type="password"
                    placeholder="cookie_token"
                    value={cnCookieToken}
                    onChange={(e) => setCnCookieToken(e.target.value)}
                    disabled={isBusy}
                    className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder={t.ui("import.uidPlaceholder") || "UID"}
                  value={uidInput}
                  onChange={(e) => setUidInput(e.target.value)}
                  className="flex h-9 w-32 sm:w-36 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy}
                />
                <div className="flex items-center space-x-1.5 shrink-0">
                  <Checkbox
                    id="hoyolabClear"
                    checked={hoyolabClear}
                    onBooleanChange={setHoyolabClear}
                    disabled={isBusy}
                  />
                  <Label
                    htmlFor="hoyolabClear"
                    className="text-[10px] sm:text-xs font-normal text-muted-foreground cursor-pointer whitespace-nowrap"
                  >
                    {t.ui("import.clearBeforeImport")}
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleHoyolabImport}
                  disabled={
                    !uidInput ||
                    !isValidUid(uidInput) ||
                    !hoyolabCookieReady ||
                    isBusy
                  }
                  className="flex-grow sm:flex-1 lg:ml-6 border-2 border-primary bg-primary/15 text-foreground font-semibold"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t.ui("import.action")
                  )}
                </Button>
              </div>
              <p className="text-xs italic text-muted-foreground">
                {t.ui("import.hoyolabPrivacyNote")}
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 text-sm text-destructive px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-md max-h-24 overflow-y-auto break-words mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </ResponsiveDialogContent>

      {/* Nested guide dialog — shadcn/Radix dialogs stack cleanly. */}
      <ResponsiveDialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <ResponsiveDialogContent className="md:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {t.ui("import.hoyolabGuideTitle")}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {t.ui("import.hoyolabGuideIntro")}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex flex-col gap-4 pt-1 text-sm">
            <div className="inline-flex self-start rounded-md border border-input overflow-hidden">
              {(["os", "cn"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setHoyolabRegion(r);
                    localStorage.setItem("gg_hoyolab_region", r);
                  }}
                  className={cn(
                    "px-3 h-9 text-xs font-medium transition-colors",
                    hoyolabRegion === r
                      ? "bg-primary/15 text-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {t.ui(
                    r === "os"
                      ? "import.hoyolabRegionOs"
                      : "import.hoyolabRegionCn"
                  )}
                </button>
              ))}
            </div>
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">
                {t.ui(
                  hoyolabRegion === "os"
                    ? "import.hoyolabGuideStepOsTitle"
                    : "import.hoyolabGuideStepCnTitle"
                )}
              </h4>
              <ol className="list-decimal pl-5 space-y-1 text-foreground/90">
                {(() => {
                  const site =
                    hoyolabRegion === "os"
                      ? "https://www.hoyolab.com"
                      : "https://www.miyoushe.com";
                  const [f1, f2] =
                    hoyolabRegion === "os"
                      ? ["ltuid_v2", "ltoken_v2"]
                      : ["account_id", "cookie_token"];
                  return (
                    <>
                      <li>{t.format("import.hoyolabGuideStep1", site)}</li>
                      <li>{t.format("import.hoyolabGuideStep2", site)}</li>
                      <li>{t.format("import.hoyolabGuideStep3", f1, f2)}</li>
                      <li>{t.ui("import.hoyolabGuideStep4")}</li>
                    </>
                  );
                })()}
              </ol>
            </section>

            <div className="flex items-start gap-2 text-xs px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t.format(
                  "import.hoyolabGuideSecurity",
                  hoyolabRegion === "os"
                    ? "https://www.hoyolab.com"
                    : "https://www.miyoushe.com"
                )}
              </span>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsGuideOpen(false)}
              >
                {t.ui("manager.close")}
              </Button>
            </div>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </ResponsiveDialog>
  );
});
