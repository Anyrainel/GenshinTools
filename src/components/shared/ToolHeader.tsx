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
import { useLanguage } from "@/contexts/LanguageContext";
import { THEME_IDS, type ThemeId, useTheme } from "@/contexts/ThemeContext";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  Check,
  Home,
  Languages,
  Menu,
  MoreVertical,
  Palette,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface ToolHeaderProps {
  actions?: React.ReactNode;
  mobileMenuItems?: React.ReactNode;
  className?: string;
}

export function ToolHeader({
  actions,
  mobileMenuItems,
  className,
}: ToolHeaderProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isArtifactFilter = location.pathname.includes("/artifact-filter");
  const isTierList = location.pathname.includes("/tier-list");
  const isWeaponTierList = location.pathname.includes("/weapon-tier-list");
  const isTeamBuilder = location.pathname.includes("/team-builder");

  const navItems = [
    {
      label: t.ui("app.navArtifactFilter"),
      href: "/artifact-filter",
      isActive: isArtifactFilter,
    },
    {
      label: t.ui("app.navAccountData"),
      href: "/account-data",
      isActive: location.pathname.includes("/account-data"),
    },
    {
      label: t.ui("app.navTierList"),
      href: "/tier-list",
      isActive: isTierList && !isWeaponTierList,
    },
    {
      label: t.ui("app.navWeaponTierList"),
      href: "/weapon-tier-list",
      isActive: isWeaponTierList,
    },
    {
      label: t.ui("app.navTeamBuilder"),
      href: "/team-builder",
      isActive: isTeamBuilder,
    },
  ];

  return (
    <header
      className={cn(THEME.layout.headerBorder, "flex-shrink-0 z-50", className)}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Menu */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="xl:hidden -ml-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[50%]">
              <SheetHeader>
                <SheetTitle className="text-left flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  {t.ui("app.title")}
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1.5 mt-6">
                {navItems.map((item) => (
                  <Button
                    key={item.href}
                    variant={item.isActive ? "secondary" : "ghost"}
                    asChild
                    className={cn(
                      "justify-start gap-2 h-10 text-sm font-medium",
                      item.isActive &&
                        "bg-primary/10 text-primary hover:bg-primary/20 top-2"
                    )}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Link to={item.href}>{item.label}</Link>
                  </Button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link
            to="/"
            className="flex items-center xl:pl-4 gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="font-semibold text-lg whitespace-nowrap">
              {t.ui("app.title")}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden xl:flex items-center gap-2">
            {navItems.map((item) => (
              <Button
                key={item.href}
                variant={item.isActive ? "secondary" : "ghost"}
                asChild
                className={cn(
                  "gap-2",
                  item.isActive &&
                    "bg-primary/10 text-primary hover:bg-primary/20"
                )}
              >
                <Link to={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}

          {/* Mobile "More" Menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mobileMenuItems}
                {mobileMenuItems && <DropdownMenuSeparator />}

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
          <div className="hidden md:flex items-center gap-2 xl:pr-4">
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
  );
}
