import { newsMap } from "@/components/shared/WhatsNew";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Suspense,
  forwardRef,
  lazy,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

// Lazy-loaded so the welcome guide bundle is only fetched when the user
// actively opens it from the settings menu. Mirrors the lazy import in
// GreetingGate so both code paths can share a single split chunk.
const WelcomeGuide = lazy(() => import("./WelcomeGuide"));

export const WelcomeGuideManual = forwardRef<ControlHandle>(
  function WelcomeGuideManual(_, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const { language } = useLanguage();

    const latestDate = useMemo(() => {
      const news = newsMap[language];
      return news.entries[0]?.date ?? "";
    }, [language]);

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
    }));

    if (!isOpen) return null;

    return (
      <Suspense fallback={null}>
        <WelcomeGuide
          latestDate={latestDate}
          onDismiss={() => setIsOpen(false)}
        />
      </Suspense>
    );
  }
);
