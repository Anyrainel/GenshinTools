import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Languages, Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";

interface ToolHeaderProps {
  actions?: React.ReactNode;
  className?: string;
}

const ToolHeader: React.FC<ToolHeaderProps> = ({ actions, className }) => {
  const { language, toggleLanguage, t } = useLanguage();
  const location = useLocation();

  const isArtifactFilter = location.pathname.includes("/artifact-filter");
  const isTierList = location.pathname.includes("/tier-list");
  const isWeaponTierList = location.pathname.includes("/weapon-tier-list");
  const isTeamBuilder = location.pathname.includes("/team-builder");

  return (
    <header
      className={cn(THEME.layout.headerBorder, "flex-shrink-0 z-50", className)}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="hidden md:inline font-semibold">
              {t.ui("app.title")}
            </span>
          </Link>

          <div className="h-6 w-px bg-border/50 hidden md:block" />

          <div className="flex items-center gap-2">
            <Button
              variant={isArtifactFilter ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                isArtifactFilter &&
                  "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <Link to="/artifact-filter">{t.ui("app.navArtifactFilter")}</Link>
            </Button>
            <Button
              variant={isTierList && !isWeaponTierList ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                isTierList &&
                  !isWeaponTierList &&
                  "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <Link to="/tier-list">{t.ui("app.navTierList")}</Link>
            </Button>
            <Button
              variant={isWeaponTierList ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                isWeaponTierList &&
                  "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <Link to="/weapon-tier-list">
                {t.ui("app.navWeaponTierList")}
              </Link>
            </Button>
            <Button
              variant={isTeamBuilder ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                isTeamBuilder &&
                  "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <Link to="/team-builder">{t.ui("app.navTeamBuilder")}</Link>
            </Button>
            <Button
              variant={
                location.pathname.includes("/account-data")
                  ? "secondary"
                  : "ghost"
              }
              asChild
              className={cn(
                "gap-2",
                location.pathname.includes("/account-data") &&
                  "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <Link to="/account-data">{t.ui("app.navAccountData")}</Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actions}

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
    </header>
  );
};

export { ToolHeader };
