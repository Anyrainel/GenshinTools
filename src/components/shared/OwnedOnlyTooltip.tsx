import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";

export function OwnedOnlyTooltip({
  children,
}: {
  children: React.ReactElement;
}) {
  const { t } = useLanguage();

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <p>{t.ui("filters.ownedOnlyAccountDataTooltip")}</p>
      </TooltipContent>
    </Tooltip>
  );
}
