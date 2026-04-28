import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type TeamDetailAspect = "damage" | "investment" | "weapon";

interface TeamDetailAspectLinksProps {
  teamId: string;
  currentAspect: TeamDetailAspect;
  showFrozenLink?: boolean;
}

export function TeamDetailAspectLinks({
  teamId,
  currentAspect,
  showFrozenLink,
}: TeamDetailAspectLinksProps) {
  const { t } = useLanguage();
  const encodedTeamId = encodeURIComponent(teamId);
  const links = [
    {
      aspect: "damage" as const,
      to: `/team-comp/damage?team=${encodedTeamId}`,
      label: t.ui("teamComp.detailLinkDamage"),
    },
    {
      aspect: "investment" as const,
      to: `/team-comp/investment?team=${encodedTeamId}`,
      label: t.ui("teamComp.detailLinkInvestment"),
    },
    {
      aspect: "weapon" as const,
      to: `/team-comp/weapon?team=${encodedTeamId}`,
      label: t.ui("teamComp.detailLinkWeaponChoice"),
    },
  ].filter((link) => link.aspect !== currentAspect);

  return (
    <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-6 md:gap-x-12 xl:gap-x-20 gap-y-3 text-center">
      {links.map((link) => (
        <Link
          key={link.aspect}
          to={link.to}
          className="inline-flex items-center gap-1 border-b border-transparent text-base xl:text-lg text-primary hover:border-primary"
        >
          <span>{link.label}</span>
          <ArrowUpRight className="size-4 md:size-5 shrink-0" />
        </Link>
      ))}
      {showFrozenLink && (
        <Link
          to="/team-comp/frozen"
          className="inline-flex items-center gap-1 border-b border-transparent text-base xl:text-lg text-primary hover:border-primary"
        >
          <span>{t.ui("teamComp.detailLinkManageFrozen")}</span>
          <ArrowUpRight className="size-4 md:size-5 shrink-0" />
        </Link>
      )}
    </nav>
  );
}
