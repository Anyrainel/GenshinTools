import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Languages, Home } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface ToolHeaderProps {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
}

const ToolHeader: React.FC<ToolHeaderProps> = ({ actions, className }) => {
  const { language, toggleLanguage, t } = useLanguage();
  const location = useLocation();

  const isArtifactFilter = location.pathname.includes('/artifact-filter');
  const isTierList = location.pathname.includes('/tier-list');
  const isWeaponTierList = location.pathname.includes('/weapon-tier-list');

  return (
    <header className={cn("border-b border-border/50 bg-card/20 backdrop-blur-sm flex-shrink-0 z-50", className)}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Navigation */}
        <div className="flex items-center gap-6">
          {/* Home Link */}
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Home className="w-5 h-5" />
            <span className="hidden md:inline font-semibold">
              {language === 'en' ? 'Genshin Tools' : '原神工具箱'}
            </span>
          </Link>

          <div className="h-6 w-px bg-border/50 hidden md:block" />

          {/* Tool Links */}
          <div className="flex items-center gap-2">
            <Button
              variant={isArtifactFilter ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                isArtifactFilter && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <Link to="/artifact-filter">
                {t.ui('app.navArtifactFilter')}
              </Link>
            </Button>
            <Button
              variant={isTierList && !isWeaponTierList ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                (isTierList && !isWeaponTierList) && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <Link to="/tier-list">
                {t.ui('app.navTierList')}
              </Link>
            </Button>
            <Button
              variant={isWeaponTierList ? "secondary" : "ghost"}
              asChild
              className={cn(
                "gap-2",
                isWeaponTierList && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <Link to="/weapon-tier-list">
                {t.ui('app.navWeaponTierList')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {actions}
          
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2 w-16"
          >
            <Languages className="w-4 h-4" />
            {language === 'en' ? '中文' : 'EN'}
          </Button>
        </div>
      </div>
    </header>
  );
};

export { ToolHeader };