import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccountDataHelpButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export function AccountDataHelpButton({
  label,
  onClick,
  className,
}: AccountDataHelpButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-7 w-7 shrink-0 text-amber-400 hover:text-amber-300",
        className
      )}
    >
      <CircleHelp className="size-4" />
    </Button>
  );
}
