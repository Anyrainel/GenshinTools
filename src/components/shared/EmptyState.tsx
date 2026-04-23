import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface EmptyStateCta {
  label: string;
  icon?: LucideIcon;
  /** Click handler — mutually exclusive with `href` */
  onClick?: () => void;
  /** Navigation link — mutually exclusive with `onClick` */
  href?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  /** Tailwind text color class for the icon. @default "text-primary" */
  iconColor?: string;
  /** Tailwind bg class for the glow behind the icon. @default "bg-primary/20" */
  glowColor?: string;
  title: string;
  description?: string;
  /** Primary call-to-action button */
  action?: EmptyStateCta;
  /** Secondary (outline) call-to-action button */
  secondaryAction?: EmptyStateCta;
  /** Outline button rendered before the primary action (e.g. Help) */
  helpAction?: EmptyStateCta;
  /** Extra content rendered below the standard layout */
  children?: ReactNode;
}

function CtaButton({
  cta,
  variant,
}: {
  cta: EmptyStateCta;
  variant: "default" | "outline";
}) {
  const Icon = cta.icon;
  const inner = (
    <>
      {Icon && <Icon className="w-4 h-4" />}
      {cta.label}
    </>
  );

  if (cta.href) {
    return (
      <Button asChild variant={variant} size="lg" className="gap-2">
        <Link to={cta.href}>{inner}</Link>
      </Button>
    );
  }

  return (
    <Button variant={variant} size="lg" className="gap-2" onClick={cta.onClick}>
      {inner}
    </Button>
  );
}

/**
 * Standardized page-level empty state.
 *
 * Renders a featured icon with glow, title, description,
 * up to two CTA buttons, and optional custom content below.
 */
export function EmptyState({
  icon: Icon,
  iconColor = "text-primary",
  glowColor = "bg-primary/20",
  title,
  description,
  action,
  secondaryAction,
  helpAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center pt-16 md:pt-24 px-4 pb-4">
      <div className="flex flex-col items-center space-y-6 max-w-lg">
        {/* Featured icon with glow */}
        <div className="relative">
          <div
            className={`absolute inset-0 ${glowColor} rounded-full blur-xl`}
          />
          <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
            <Icon className={`w-12 h-12 ${iconColor} opacity-80`} />
          </div>
        </div>

        {/* Title + description */}
        <div className="space-y-2">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-muted-foreground text-base max-w-md mx-auto">
              {description}
            </p>
          )}
        </div>

        {/* CTAs */}
        {(action || secondaryAction || helpAction) && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {helpAction && <CtaButton cta={helpAction} variant="outline" />}
            {action && <CtaButton cta={action} variant="default" />}
            {secondaryAction && (
              <CtaButton cta={secondaryAction} variant="outline" />
            )}
          </div>
        )}

        {/* Custom content */}
        {children}
      </div>
    </div>
  );
}
