import * as React from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * Width in pixels at which to switch from Drawer (mobile) to Dialog (desktop).
   * Default: 768
   */
  triggerWidth?: number;
}

interface ResponsiveDialogContentProps {
  className?: string;
  children: React.ReactNode;
  closeLabel?: string;
}

interface ResponsiveDialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
  asChild?: boolean;
}

interface ResponsiveDialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

const ResponsiveDialogContext = React.createContext<{
  isDesktop: boolean;
}>({ isDesktop: true });

/**
 * ResponsiveDialog - A dialog that renders as a Dialog on desktop and a Drawer on mobile.
 *
 * Usage matches the standard Dialog pattern, but automatically adapts for mobile.
 * On mobile (< 768px), it renders as a bottom Drawer with horizontally centered
 * content. Width constraints apply to the content, while the drawer stays full width.
 * On desktop (>= 768px), it renders as a centered Dialog.
 *
 * @example
 * ```tsx
 * <ResponsiveDialog open={open} onOpenChange={setOpen}>
 *   <ResponsiveDialogContent>
 *     <ResponsiveDialogHeader>
 *       <ResponsiveDialogTitle>Title</ResponsiveDialogTitle>
 *       <ResponsiveDialogDescription>Description</ResponsiveDialogDescription>
 *     </ResponsiveDialogHeader>
 *     <div>Content...</div>
 *     <ResponsiveDialogFooter>
 *       <Button>Action</Button>
 *     </ResponsiveDialogFooter>
 *   </ResponsiveDialogContent>
 * </ResponsiveDialog>
 * ```
 */
function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  triggerWidth = 768,
}: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery(`(min-width: ${triggerWidth}px)`);

  if (isDesktop) {
    return (
      <ResponsiveDialogContext.Provider value={{ isDesktop: true }}>
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isDesktop: false }}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    </ResponsiveDialogContext.Provider>
  );
}

function ResponsiveDialogContent({
  className,
  children,
  closeLabel,
}: ResponsiveDialogContentProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext);

  if (isDesktop) {
    return (
      <DialogContent className={cn("max-h-[90dvh] overflow-y-auto", className)} showCloseButton={closeLabel ? false : undefined}>
        {closeLabel && (
          <DialogClose type="button" className="absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">{closeLabel}</span>
          </DialogClose>
        )}
        {children}
      </DialogContent>
    );
  }

  return (
    <DrawerContent>
      <div className={cn("relative mx-auto flex w-full flex-col h-full max-h-[85vh] overflow-y-auto px-4 pb-6 safe-area-bottom", className)}>
        {closeLabel && (
          <DrawerClose type="button" className="absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">{closeLabel}</span>
          </DrawerClose>
        )}
        {children}
      </div>
    </DrawerContent>
  );
}

function ResponsiveDialogHeader({
  className,
  children,
}: ResponsiveDialogHeaderProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext);

  if (isDesktop) {
    return <DialogHeader className={className}>{children}</DialogHeader>;
  }

  return <DrawerHeader className={className}>{children}</DrawerHeader>;
}

function ResponsiveDialogTitle({
  className,
  children,
}: ResponsiveDialogTitleProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext);

  if (isDesktop) {
    return <DialogTitle className={className}>{children}</DialogTitle>;
  }

  return <DrawerTitle className={className}>{children}</DrawerTitle>;
}

function ResponsiveDialogDescription({
  className,
  children,
  asChild,
}: ResponsiveDialogDescriptionProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext);

  if (isDesktop) {
    return (
      <DialogDescription className={className} asChild={asChild}>
        {children}
      </DialogDescription>
    );
  }

  return (
    <DrawerDescription className={className} asChild={asChild}>
      {children}
    </DrawerDescription>
  );
}

function ResponsiveDialogFooter({
  className,
  children,
}: ResponsiveDialogFooterProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext);

  if (isDesktop) {
    return <DialogFooter className={className}>{children}</DialogFooter>;
  }

  return <DrawerFooter className={className}>{children}</DrawerFooter>;
}

/**
 * Hook to get the current dialog context mode
 */
function useResponsiveDialogContext() {
  return React.useContext(ResponsiveDialogContext);
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  useResponsiveDialogContext,
};
