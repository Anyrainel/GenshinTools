import {
  Check,
  CircleUserRound,
  Cloud,
  HeartHandshake,
  Languages,
  LogIn,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquare,
  MoreVertical,
  Palette,
  Settings,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getLogtoAccountCenterSecurityUrl } from "@/cloud/authConfig";
import { AccountFeedbackDialog } from "@/components/layout/AccountFeedbackDialog";
import {
  getNavigationConfig,
  type TabConfig,
} from "@/components/layout/appNavigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { useAppSession } from "@/contexts/AppSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SELECTABLE_THEME_IDS, useTheme } from "@/contexts/ThemeContext";
import type { ThemeId } from "@/data/enums";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getAssetUrl } from "@/lib/utils";

function hashString(value: string): number {
  let hash = 0;
  for (const char of value.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getAccountAvatarMeta(label: string, seed: string) {
  const trimmedLabel = label.trim();
  const initial = (trimmedLabel[0] ?? "?").toLocaleUpperCase();
  const hue = hashString(seed || trimmedLabel) % 360;
  return {
    color: `hsl(${hue} 64% 38%)`,
    initial,
  };
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
  /** If true, preferred as the desktop-visible page action. */
  alwaysShow?: boolean;
  /** Tour step ID for onboarding spotlight */
  tourStepId?: string;
}

export interface AppBarProps {
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
  /** If true, account, theme, and language render as separate header controls. */
  standaloneUtilityActions?: boolean;
  className?: string;
}

/**
 * AppBar - The main navigation header for all pages.
 *
 * Features:
 * - Navigation links collapse to hamburger Sheet on mobile (< lg)
 * - Tabs displayed inline on desktop (md+), collapse into hamburger on mobile
 * - Page actions render as one desktop action plus overflow; mobile uses overflow only
 * - Theme and language switchers live in the More menu by default
 * - Supports both new ActionConfig[] pattern and legacy ReactNode actions
 */
export function AppBar({
  actions,
  tabs,
  activeTab,
  onTabChange,
  legacyActions,
  standaloneUtilityActions = false,
  className,
}: AppBarProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const {
    isAuthenticated,
    isLoading: isAccountLoading,
    account,
    accountError,
    signIn,
    signOut,
  } = useAppSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [_isPending, startTransition] = useTransition();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const isExpandedActionBar = useMediaQuery("(min-width: 640px)");

  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    // Allow default behavior for modifier keys (new tab, etc.)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) {
      setIsMenuOpen(false);
      return;
    }

    e.preventDefault();
    setIsMenuOpen(false);

    startTransition(() => {
      navigate(href);
    });
  };

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

  const pageActions = actions ?? [];
  const desktopAction =
    pageActions.find((action) => action.alwaysShow) ??
    pageActions.find(
      (action) => action.key !== "help" && action.key !== "clear"
    ) ??
    pageActions[0];
  const desktopOverflowActions = desktopAction
    ? pageActions.filter((action) => action !== desktopAction)
    : [];
  const menuActions = isExpandedActionBar
    ? desktopOverflowActions
    : pageActions;
  const hasMoreMenuUtilities = !standaloneUtilityActions;
  const hasMoreMenu = menuActions.length > 0 || hasMoreMenuUtilities;
  const hasPageActionControls =
    pageActions.length > 0 || Boolean(legacyActions);
  const showDesktopAction = isExpandedActionBar && desktopAction;
  const hasTabs = tabs && tabs.length > 0;
  const accountLabel = accountError
    ? t.ui("accountSystem.accountLoadFailed")
    : isAccountLoading && isAuthenticated
      ? t.ui("common.loading")
      : (account?.email ??
        account?.displayName ??
        account?.id ??
        t.ui("accountSystem.accountEmailFallback"));
  const accountAvatar = getAccountAvatarMeta(
    account?.email ?? account?.displayName ?? accountLabel,
    account?.email ?? account?.id ?? accountLabel
  );

  const handleSignIn = async () => {
    try {
      await signIn(`${location.pathname}${location.search}${location.hash}`);
    } catch (signInError) {
      toast.error(
        signInError instanceof Error ? signInError.message : String(signInError)
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (signOutError) {
      toast.error(
        signOutError instanceof Error
          ? signOutError.message
          : String(signOutError)
      );
    }
  };

  // Explicit theme labels for static analysis
  const getThemeLabel = (themeId: ThemeId) => {
    switch (themeId) {
      case "abyss":
        return t.ui("theme.abyss");
      case "mondstadt":
        return t.ui("theme.mondstadt");
      case "liyue":
        return t.ui("theme.liyue");
      case "inazuma":
        return t.ui("theme.inazuma");
      case "sumeru":
        return t.ui("theme.sumeru");
      case "fontaine":
        return t.ui("theme.fontaine");
      case "natlan":
        return t.ui("theme.natlan");
      case "snezhnaya":
        return t.ui("theme.snezhnaya");
      case "nodkrai":
        return t.ui("theme.nodkrai");
    }
  };

  const renderThemeItems = () =>
    SELECTABLE_THEME_IDS.map((themeId: ThemeId) => (
      <DropdownMenuItem
        key={themeId}
        onClick={() => setTheme(themeId)}
        className="gap-2"
      >
        {theme === themeId && <Check className="w-4 h-4" />}
        {theme !== themeId && <span className="w-4" />}
        {getThemeLabel(themeId)}
      </DropdownMenuItem>
    ));

  const renderLanguageItems = () => (
    <>
      <DropdownMenuItem onClick={toggleLanguage} className="gap-2">
        <Check
          className={cn(
            "w-4 h-4",
            language === "en" ? "opacity-100" : "opacity-0"
          )}
        />
        English
      </DropdownMenuItem>
      <DropdownMenuItem onClick={toggleLanguage} className="gap-2">
        <Check
          className={cn(
            "w-4 h-4",
            language === "zh" ? "opacity-100" : "opacity-0"
          )}
        />
        中文
      </DropdownMenuItem>
    </>
  );

  const renderAccountMark = (className = "h-8 w-8") => {
    if (!isAuthenticated) {
      return <CircleUserRound className="w-5 h-5" />;
    }

    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={cn("shrink-0", className)}
      >
        <circle cx="12" cy="12" r="12" fill={accountAvatar.color} />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="white"
        >
          {accountAvatar.initial}
        </text>
      </svg>
    );
  };

  const renderUtilityMenuItems = () => (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <Languages className="w-4 h-4" />
          <span>{t.ui("app.language")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            {renderLanguageItems()}
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <Palette className="w-4 h-4" />
          <span>{t.ui("theme.switcherButton")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>{renderThemeItems()}</DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    </>
  );

  const renderAccountMenu = (trailingMargin = true) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.ui("accountSystem.accountMenu")}
          className={cn(
            "h-9 w-9 rounded-full p-0 hover:bg-transparent",
            isAuthenticated ? "[&_svg]:size-7" : "[&_svg]:size-5",
            trailingMargin && "2xl:mr-4"
          )}
        >
          {renderAccountMark()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          isAuthenticated && "w-max max-w-[min(20rem,calc(100vw-2rem))]"
        )}
      >
        {isAuthenticated ? (
          <>
            <DropdownMenuLabel className="flex min-w-0 max-w-full font-normal">
              <span className="min-w-0 max-w-full truncate text-xs leading-tight">
                {accountLabel}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/account/cloud-backup">
                <Cloud className="w-4 h-4" />
                {t.ui("accountSystem.syncData")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsFeedbackOpen(true)}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {t.ui("accountSystem.feedback")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/account/support">
                <HeartHandshake className="w-4 h-4" />
                {t.ui("accountSystem.supportMe")}
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => void handleSignIn()}
              disabled={isAccountLoading}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              {t.ui("accountSystem.signIn")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsFeedbackOpen(true)}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {t.ui("accountSystem.feedback")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2">
              <Link to="/account/support">
                <HeartHandshake className="w-4 h-4" />
                {t.ui("accountSystem.supportMe")}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        {isAuthenticated && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <a href={getLogtoAccountCenterSecurityUrl()}>
                <Settings className="w-4 h-4" />
                {t.ui("accountSystem.manageAccount")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void handleSignOut()}
              disabled={isAccountLoading}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t.ui("accountSystem.signOut")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderStandaloneUtilityActions = () => (
    <>
      <Button
        variant="outline"
        className="h-9 gap-2 px-3"
        aria-label={t.ui("app.language")}
        onClick={toggleLanguage}
      >
        <Languages className="w-4 h-4" />
        <span>{language === "en" ? "中文" : "EN"}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 px-3">
            <Palette className="w-4 h-4" />
            <span>{t.ui("theme.switcherButton")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {renderThemeItems()}
        </DropdownMenuContent>
      </DropdownMenu>

      {isAuthenticated ? (
        renderAccountMenu()
      ) : (
        <Button
          variant="outline"
          className="h-9 gap-2 px-3 2xl:mr-4"
          onClick={() => void handleSignIn()}
          disabled={isAccountLoading}
        >
          <LogIn className="w-4 h-4" />
          <span>{t.ui("accountSystem.signIn")}</span>
        </Button>
      )}
    </>
  );

  return (
    <>
      <header
        className={cn(
          "bg-card/20 backdrop-blur-sm",
          "flex-shrink-0 z-50 sticky top-0 transition-transform duration-300",
          // Hide on mobile when scrolling down
          isHidden && "md:translate-y-0 -translate-y-full",
          className
        )}
      >
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1 md:gap-4">
            {/* Mobile Menu */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden -ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] flex flex-col">
                <SheetHeader>
                  <SheetTitle className="text-left flex items-center gap-2">
                    <img
                      src={getAssetUrl("/logo_gt.svg")}
                      className="w-6 h-6"
                      alt="Logo"
                    />
                    {t.ui("app.title")}
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1.5 mt-4 overflow-y-auto flex-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.href);
                    const hasChildren =
                      item.children && item.children.length > 0;
                    const targetHref = item.children?.[0]?.href ?? item.href;

                    if (hasChildren) {
                      return (
                        <div key={item.href} className="space-y-0.5">
                          <Button
                            variant="ghost"
                            asChild
                            className={cn(
                              "justify-start gap-2 h-9 text-sm font-semibold w-full pt-1.5 pb-2.5",
                              isActive && "text-primary"
                            )}
                            onClick={(e) => handleLinkClick(e, targetHref)}
                          >
                            <Link to={targetHref}>{item.label}</Link>
                          </Button>
                          <div className="pl-2 space-y-0 border-l ml-2 border-border/50">
                            {item.children?.map((child) => {
                              const isChildActive =
                                location.pathname === child.href ||
                                (location.pathname === item.href &&
                                  activeTab === child.value);
                              return (
                                <Button
                                  key={child.href}
                                  variant={
                                    isChildActive ? "secondary" : "ghost"
                                  }
                                  asChild
                                  className={cn(
                                    "justify-start gap-2 h-8 text-sm w-full pt-1 pb-2",
                                    isChildActive &&
                                      "bg-accent text-accent-foreground"
                                  )}
                                  onClick={(e) =>
                                    handleLinkClick(e, child.href)
                                  }
                                  data-tour-step-id={child.tourStepId}
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
                          "justify-start gap-2 h-9 text-sm font-medium pt-1.5 pb-2.5",
                          isActive &&
                            "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                        onClick={(e) => handleLinkClick(e, item.href)}
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
              className="flex items-center 2xl:pl-4 gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <img
                src={getAssetUrl("/logo_gt.svg")}
                className="w-8 h-8"
                alt="Logo"
              />
              <span className="font-semibold text-lg whitespace-nowrap">
                {t.ui("app.title")}
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden xl:flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const targetHref = item.children?.[0]?.href ?? item.href;
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "secondary" : "ghost"}
                    asChild
                    className={cn(
                      "gap-1 px-3 pt-1.5 pb-2.5",
                      isActive &&
                        "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                    onClick={(e) => handleLinkClick(e, targetHref)}
                  >
                    <Link to={targetHref}>{item.label}</Link>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showDesktopAction && (
              <Button
                variant="outline"
                aria-label={showDesktopAction.label}
                className="h-9 gap-2 px-3 pt-1.5 pb-2.5"
                onClick={showDesktopAction.onTrigger}
                data-tour-step-id={showDesktopAction.tourStepId}
              >
                <showDesktopAction.icon className="w-4 h-4" />
                <span>{showDesktopAction.label}</span>
              </Button>
            )}

            {hasMoreMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t.ui("common.more")}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuActions.map((action) => (
                    <DropdownMenuItem
                      key={action.key}
                      onClick={action.onTrigger}
                      className="gap-2"
                    >
                      <action.icon className="w-4 h-4" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  {menuActions.length > 0 && hasMoreMenuUtilities && (
                    <DropdownMenuSeparator />
                  )}
                  {hasMoreMenuUtilities && renderUtilityMenuItems()}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Legacy actions support */}
            {legacyActions}

            {hasPageActionControls && (
              <div className="h-6 w-px bg-foreground/30" aria-hidden="true" />
            )}

            {standaloneUtilityActions
              ? renderStandaloneUtilityActions()
              : renderAccountMenu()}
          </div>
        </div>
      </header>

      {/* Desktop Tab Bar - rendered below AppBar when tabs are provided */}
      {hasTabs && (
        <div
          className={cn(
            "border-b border-border/50 bg-card/20 backdrop-blur-sm",
            "hidden md:block flex-shrink-0 z-40"
          )}
        >
          <div className="container mx-auto pb-2">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
                {tabs?.map((tab) => (
                  <Button
                    key={tab.value}
                    variant={activeTab === tab.value ? "default" : "ghost"}
                    onClick={() => onTabChange?.(tab.value)}
                    className={cn(
                      "gap-2 h-9 px-4 text-sm pt-1.5 pb-2.5",
                      activeTab === tab.value &&
                        "bg-primary/60 text-primary-foreground"
                    )}
                    data-tour-step-id={tab.tourStepId}
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
      <AccountFeedbackDialog
        open={isFeedbackOpen}
        onOpenChange={setIsFeedbackOpen}
        isAuthenticated={isAuthenticated}
        isAccountLoading={isAccountLoading}
        accountId={account?.id ?? null}
        onSignIn={handleSignIn}
      />
    </>
  );
}
