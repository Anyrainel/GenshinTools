import type { ControlHandle } from "@/components/layout/AppBar";
import { newsMap } from "@/components/shared/WhatsNew";
import { useLanguage } from "@/contexts/LanguageContext";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import WelcomeGuide from "./WelcomeGuide";

export const WelcomeGuideManual = forwardRef<ControlHandle>(
  function WelcomeGuideManual(_, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useLanguage();

    const latestDate = useMemo(() => {
      const news = newsMap[t.lang];
      return news.entries[0]?.date ?? "";
    }, [t.lang]);

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
    }));

    if (!isOpen) return null;

    return (
      <WelcomeGuide
        latestDate={latestDate}
        onDismiss={() => setIsOpen(false)}
      />
    );
  }
);
