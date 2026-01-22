import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getNavigationConfig } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { THEME_IDS, type ThemeId, useTheme } from "@/contexts/ThemeContext";
import { THEME } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  Check,
  Languages,
  type LucideIcon,
  Menu,
  MoreVertical,
  Palette,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Handle interface for control components that can be opened programmatically.
 * Controls expose `.open()` via ref using forwardRef + useImperativeHandle.
 */
export interface ControlHandle {
  open: () => void;
}

/**
 * Configuration for an action button in the AppBar.
 * Actions open dialogs managed by the page, not the AppBar itself.
 */
export interface ActionConfig {
  key: string;
  icon: LucideIcon;
  label: string;
  onTrigger: () => void;
  /** If true, always visible; otherwise collapses into overflow menu on mobile (< md) */
  alwaysShow?: boolean;
}

/**
 * Configuration for a tab in the AppBar.
 * Tabs are displayed inline on desktop and collapse into the hamburger menu on mobile.
 */
export interface TabConfig {
  value: string;
  label: string;
  icon?: LucideIcon;
}

interface AppBarProps {
  /** Action buttons rendered in the header. See ActionConfig. */
  actions?: ActionConfig[];
  /** Tab configuration for pages with multiple views */
  tabs?: TabConfig[];
  /** Currently active tab value */
  activeTab?: string;
  /** Callback when tab changes */
  onTabChange?: (tab: string) => void;
  /** Additional custom actions as ReactNode (legacy support) */
  legacyActions?: React.ReactNode;
  className?: string;
}

/**
 * AppBar - The main navigation header for all pages.
 *
 * Features:
 * - Navigation links collapse to hamburger Sheet on mobile (< lg)
 * - Tabs displayed inline on desktop (md+), collapse into hamburger on mobile
 * - Actions collapse to overflow DropdownMenu on mobile (< md)
 * - Theme and language switchers in overflow menu on mobile
 * - Supports both new ActionConfig[] pattern and legacy ReactNode actions
 */
export function AppBar({
  actions,
  tabs,
  activeTab,
  onTabChange,
  legacyActions,
  className,
}: AppBarProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  // Hide-on-scroll behavior for mobile
  useEffect(() => {
    const SCROLL_THRESHOLD = 10; // Minimum scroll distance to trigger hide/show

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // Only trigger if scroll exceeds threshold
      if (Math.abs(scrollDelta) > SCROLL_THRESHOLD) {
        // Hide when scrolling down, show when scrolling up
        setIsHidden(scrollDelta > 0 && currentScrollY > 56); // 56px = h-14
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = getNavigationConfig(t);

  // Split actions into always visible and collapsible
  const alwaysShowActions = actions?.filter((a) => a.alwaysShow) ?? [];
  const collapsibleActions = actions?.filter((a) => !a.alwaysShow) ?? [];
  const hasCollapsibleActions = collapsibleActions.length > 0;
  const hasTabs = tabs && tabs.length > 0;

  const handleTabClick = (tabValue: string) => {
    onTabChange?.(tabValue);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header
        className={cn(
          THEME.layout.headerBorder,
          "flex-shrink-0 z-50 sticky top-0 transition-transform duration-300",
          // Hide on mobile when scrolling down
          isHidden && "md:translate-y-0 -translate-y-full",
          className
        )}
      >
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            {/* Mobile Menu */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden -ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle className="text-left flex items-center gap-2">
                    <img src="/logo_gt.svg" className="w-6 h-6" alt="Logo" />
                    {t.ui("app.title")}
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1.5 mt-6">
                  {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    const hasChildren =
                      item.children && item.children.length > 0;

                    if (hasChildren) {
                      return (
                        <div key={item.href} className="space-y-1">
                          <Button
                            variant="ghost"
                            asChild
                            className={cn(
                              "justify-start gap-2 h-10 text-sm font-semibold w-full",
                              isActive && "text-primary"
                            )}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <Link to={item.href}>{item.label}</Link>
                          </Button>
                          <div className="pl-4 space-y-1 border-l ml-4 border-border/50">
                            {item.children?.map((child) => {
                              const isChildActive =
                                location.pathname === item.href &&
                                activeTab === child.value;
                              return (
                                <Button
                                  key={child.href}
                                  variant={
                                    isChildActive ? "secondary" : "ghost"
                                  }
                                  asChild
                                  className={cn(
                                    "justify-start gap-2 h-9 text-sm w-full",
                                    isChildActive &&
                                      "bg-accent text-accent-foreground"
                                  )}
                                  onClick={() => setIsMenuOpen(false)}
                                >
                                  <Link to={child.href}>
                                    {child.icon && (
                                      <child.icon className="h-4 w-4" />
                                    )}
                                    {child.label}
                                  </Link>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Button
                        key={item.href}
                        variant={isActive ? "secondary" : "ghost"}
                        asChild
                        className={cn(
                          "justify-start gap-2 h-10 text-sm font-medium",
                          isActive &&
                            "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Link to={item.href}>{item.label}</Link>
                      </Button>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <Link
              to="/"
              className="flex items-center lg:pl-4 gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <img src="/logo_gt.svg" className="w-8 h-8" alt="Logo" />
              <span className="font-semibold text-lg whitespace-nowrap hidden md:block">
                {t.ui("app.title")}
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "secondary" : "ghost"}
                    asChild
                    className={cn(
                      "gap-2",
                      isActive &&
                        "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    <Link to={item.href}>{item.label}</Link>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Always show actions */}
            {alwaysShowActions.map((action) => (
              <Button
                key={action.key}
                variant="outline"
                size="sm"
                onClick={action.onTrigger}
                className="gap-2"
              >
                <action.icon className="w-4 h-4" />
                <span>{action.label}</span>
              </Button>
            ))}

            {/* Desktop-only collapsible actions */}
            <div className="hidden md:flex items-center gap-2">
              {collapsibleActions.map((action) => (
                <Button
                  key={action.key}
                  variant="outline"
                  size="sm"
                  onClick={action.onTrigger}
                  className="gap-2"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </Button>
              ))}
            </div>

            {/* Legacy actions support */}
            {legacyActions}

            {/* Mobile "More" Menu - contains collapsible actions + theme/language */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                    <span className="sr-only">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Collapsible actions in dropdown on mobile */}
                  {collapsibleActions.map((action) => (
                    <DropdownMenuItem
                      key={action.key}
                      onClick={action.onTrigger}
                      className="gap-2"
                    >
                      <action.icon className="w-4 h-4" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  {hasCollapsibleActions && <DropdownMenuSeparator />}

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <Palette className="w-4 h-4" />
                      <span>{t.ui("theme.switcherButton")}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {THEME_IDS.map((themeId: ThemeId) => (
                          <DropdownMenuItem
                            key={themeId}
                            onClick={() => setTheme(themeId)}
                            className="gap-2"
                          >
                            {theme === themeId && <Check className="w-4 h-4" />}
                            {theme !== themeId && <span className="w-4" />}
                            {t.ui(`theme.${themeId}`)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <Languages className="w-4 h-4" />
                      <span>{t.ui("app.language")}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onClick={toggleLanguage}
                          className="gap-2"
                        >
                          <Check
                            className={cn(
                              "w-4 h-4",
                              language === "en" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          English
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={toggleLanguage}
                          className="gap-2"
                        >
                          <Check
                            className={cn(
                              "w-4 h-4",
                              language === "zh" ? "opacity-100" : "opacity-0"
                            )}
                          />
                          中文
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Theme/Language Switchers */}
            <div className="hidden md:flex items-center gap-2 lg:pr-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Palette className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {t.ui("theme.switcherButton")}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-0">
                  {THEME_IDS.map((themeId: ThemeId) => (
                    <DropdownMenuItem
                      key={themeId}
                      onClick={() => setTheme(themeId)}
                      className="gap-2"
                    >
                      {theme === themeId && <Check className="w-4 h-4" />}
                      {theme !== themeId && <span className="w-4" />}
                      {t.ui(`theme.${themeId}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleLanguage}
                className="gap-2 w-16"
              >
                <Languages className="w-4 h-4" />
                {language === "en" ? "中文" : "EN"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Tab Bar - rendered below AppBar when tabs are provided */}
      {hasTabs && (
        <div
          className={cn(
            THEME.layout.headerBorder,
            "hidden md:block flex-shrink-0 z-40"
          )}
        >
          <div className="container mx-auto py-2">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
                {tabs?.map((tab) => (
                  <Button
                    key={tab.value}
                    variant={activeTab === tab.value ? "default" : "ghost"}
                    onClick={() => onTabChange?.(tab.value)}
                    className={cn(
                      "gap-2 h-11 px-5 text-base",
                      activeTab === tab.value &&
                        "bg-primary text-primary-foreground"
                    )}
                  >
                    {tab.icon && <tab.icon className="h-5 w-5" />}
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
