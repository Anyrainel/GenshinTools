import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PinnedHoverCardProps {
  children: ReactElement;
  content: ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  className?: string;
}

export function PinnedHoverCard({
  children,
  content,
  side = "right",
  className,
}: PinnedHoverCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearTimers = useCallback(() => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const openOnHover = () => {
    clearTimers();
    openTimer.current = setTimeout(() => setIsHovering(true), 200);
  };

  const closeOnLeave = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setIsHovering(false), 300);
  };

  return (
    <Popover
      open={isHovering || isPinned}
      onOpenChange={(open) => {
        if (!open) {
          clearTimers();
          setIsHovering(false);
          setIsPinned(false);
        }
      }}
    >
      <PopoverTrigger
        asChild
        ref={triggerRef}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") openOnHover();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") closeOnLeave();
        }}
        onFocus={openOnHover}
        onBlur={closeOnLeave}
        onClick={(event) => {
          // Prevent the Popover trigger from toggling an already-hovered card shut.
          event.preventDefault();
          clearTimers();
          setIsHovering(false);
          setIsPinned(true);
        }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className={className}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") openOnHover();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") closeOnLeave();
        }}
        onOpenAutoFocus={(event) => {
          if (!isPinned) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => {
          if (isPinned) triggerRef.current?.focus();
        }}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
