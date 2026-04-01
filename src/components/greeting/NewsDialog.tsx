import { SECTION_COLORS, newsMap } from "@/components/shared/WhatsNew";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useGreetingStore } from "@/stores/useGreetingStore";
import { Megaphone } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function NewsDialog({
  latestDate,
  onDismiss,
}: {
  latestDate: string;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const dismissNews = useGreetingStore((s) => s.dismissNews);

  const entry = useMemo(() => {
    const news = newsMap[t.lang];
    return news.entries.find((e) => e.date === latestDate) ?? news.entries[0];
  }, [t.lang, latestDate]);

  const handleClose = () => {
    dismissNews(latestDate);
    onDismiss();
  };

  const handleViewHistory = () => {
    dismissNews(latestDate);
    onDismiss();
    // Navigate to home — the WhatsNew sheet can be opened manually from there
    navigate("/");
  };

  if (!entry) return null;

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && handleClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" />
            {t.ui("greeting.newsTitle")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-4 pb-4 space-y-4">
            {/* Date heading */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-sm font-semibold font-mono text-foreground shrink-0">
                {entry.date}
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>

            {/* Sections */}
            {entry.sections.map((section) => (
              <div key={section.category}>
                <h3
                  className={cn(
                    "text-sm font-semibold mb-1.5",
                    SECTION_COLORS[section.category] ?? "text-foreground"
                  )}
                >
                  {section.category === "features"
                    ? t.ui("whatsNew.features")
                    : section.category === "fixes"
                      ? t.ui("whatsNew.fixes")
                      : section.category}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-foreground/80 leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-muted-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>

        <ResponsiveDialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleViewHistory}>
            {t.ui("greeting.viewFullHistory")}
          </Button>
          <Button onClick={handleClose}>{t.ui("common.gotIt")}</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
