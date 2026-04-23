import { newsMap } from "@/components/shared/WhatsNew";
import { useLanguage } from "@/contexts/LanguageContext";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useGreetingStore } from "@/stores/useGreetingStore";
import { Suspense, lazy, useMemo, useState } from "react";

// Lazy-load the heavy dialog components
const WelcomeGuide = lazy(() => import("./WelcomeGuide"));
const NewsDialog = lazy(() => import("./NewsDialog"));

type GreetingMode = "welcome" | "news" | null;

function useGreetingMode(): { mode: GreetingMode; latestDate: string } {
  const { language } = useLanguage();
  const onboardingCompleted = useGreetingStore((s) => s.onboardingCompleted);
  const lastSeenUpdate = useGreetingStore((s) => s.lastSeenUpdate);
  const hasAccountData = useAccountStore((s) => {
    const active = getActiveAccount(s);
    return !!active;
  });

  const latestDate = useMemo(() => {
    const news = newsMap[language];
    return news.entries[0]?.date ?? "";
  }, [language]);

  let mode: GreetingMode = null;

  if (!onboardingCompleted && !hasAccountData) {
    mode = "welcome";
  } else if (latestDate && latestDate > (lastSeenUpdate ?? "")) {
    mode = "news";
  }

  return { mode, latestDate };
}

export function GreetingGate() {
  const { mode, latestDate } = useGreetingMode();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !mode) return null;

  return (
    <Suspense fallback={null}>
      {mode === "welcome" && (
        <WelcomeGuide
          latestDate={latestDate}
          onDismiss={() => setDismissed(true)}
        />
      )}
      {mode === "news" && (
        <NewsDialog
          latestDate={latestDate}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </Suspense>
  );
}
