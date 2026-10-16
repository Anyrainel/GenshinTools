import type { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import { useResource } from "@/hooks/useResource";
import {
  artifactTextResource,
  weaponTextResource,
} from "@/providers/reference/gameDataLoader";

/** Resolve shared reference dependencies before mounting synchronous consumers. */
export function RouteGameData({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const { language, t } = useLanguage();
  const workspace = /^\/(account-data|artifact-filter|team-comp)(\/|$)/.test(
    pathname
  );
  const characterStatsNeeded =
    workspace ||
    /^\/tier-list(\/characters)?\/?$/.test(pathname) ||
    /^\/archive(\/characters)?\/?$/.test(pathname);
  const weaponStatsNeeded =
    workspace || /^\/(tier-list|archive)\/weapons\/?$/.test(pathname);
  const weaponTextNeeded = /^\/archive\/weapons\/?$/.test(pathname);
  const artifactTextNeeded = /^\/archive\/artifacts\/?$/.test(pathname);
  const characters = useResource(
    characterStatsResource,
    undefined,
    characterStatsNeeded
  );
  const weapons = useResource(
    weaponStatsResource,
    undefined,
    weaponStatsNeeded
  );
  const weaponText = useResource(
    weaponTextResource,
    language,
    weaponTextNeeded
  );
  const artifactText = useResource(
    artifactTextResource,
    language,
    artifactTextNeeded
  );
  if (
    (characterStatsNeeded && !characters) ||
    (weaponStatsNeeded && !weapons) ||
    (weaponTextNeeded && !weaponText) ||
    (artifactTextNeeded && !artifactText)
  ) {
    return (
      <p role="status" className="p-6">
        {t.ui("common.loading")}
      </p>
    );
  }
  return children;
}
