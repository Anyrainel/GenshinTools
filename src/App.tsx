import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { GreetingGate } from "@/components/home/GreetingGate";
import { useTourLabels, useTours } from "@/components/layout/tourConfig";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TourProvider } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactTextResource,
  weaponTextResource,
} from "@/data/gameDataLoader";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { useHydrateBuildPreset } from "@/hooks/useHydrateBuildPreset";
import { useHydrateTeamPreset } from "@/hooks/useHydrateTeamPreset";
import { cn } from "@/lib/utils";
import Home from "./pages/Home";

const AccountDataPage = lazy(() => import("./pages/AccountData"));
const ArtifactBuildsPage = lazy(() => import("./pages/ArtifactBuilds"));
const TeamCompPage = lazy(() => import("./pages/TeamComp"));
const TierListPage = lazy(() => import("./pages/TierList"));
const ArchivePage = lazy(() => import("./pages/Archive"));
const AccountPage = lazy(() => import("./pages/account/AccountPage"));
const CloudBackupPage = lazy(() => import("./pages/account/CloudBackupPage"));
const AuthCallbackPage = lazy(() => import("./pages/account/AuthCallbackPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

const SITE_NAME = "GGArtifact";

const PAGE_TITLES: Record<string, { en: string; zh: string }> = {
  "/account-data": { en: "Account Data", zh: "账号数据" },
  "/artifact-filter": { en: "Builds", zh: "配装" },
  "/tier-list": { en: "Tier List", zh: "榜单" },
  "/archive": { en: "Archive", zh: "图鉴" },
  "/team-comp": { en: "Team DMG", zh: "队伍伤害" },
  "/account": { en: "Account", zh: "账号" },
};
const NOT_FOUND_TITLE = { en: "Page Not Found", zh: "页面未找到" };

function App() {
  const location = useLocation();
  const { language } = useLanguage();
  const isHomePage = location.pathname === "/";
  useHydrateBuildPreset();
  useHydrateTeamPreset();

  useEffect(() => {
    if (isHomePage) {
      document.title = SITE_NAME;
      return;
    }
    const base = `/${location.pathname.split("/")[1]}`;
    const page = PAGE_TITLES[base];
    document.title = `${(page ?? NOT_FOUND_TITLE)[language]} — ${SITE_NAME}`;
  }, [isHomePage, location.pathname, language]);

  // Tier B preload — fire-and-forget at app boot. Tooltip / table consumers
  // call resource.use() themselves and render skeletons until ready, so this
  // is purely an optimization to start the network requests earlier.
  useEffect(() => {
    void characterStatsResource.preload();
    void weaponStatsResource.preload();
    void weaponTextResource.preload(language);
    void artifactTextResource.preload(language);
  }, [language]);

  const tours = useTours();
  const tourLabels = useTourLabels();

  return (
    <PageErrorBoundary>
      <TourProvider tours={tours} labels={tourLabels}>
        <div className="h-dvh bg-background text-foreground flex flex-col">
          <main
            className={cn(
              "flex-1 flex flex-col",
              isHomePage ? "overflow-y-auto" : "overflow-hidden"
            )}
          >
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/account-data" element={<AccountDataPage />} />
                <Route
                  path="/account-data/:tab"
                  element={<AccountDataPage />}
                />
                <Route
                  path="/artifact-filter"
                  element={<ArtifactBuildsPage />}
                />
                <Route
                  path="/artifact-filter/:tab"
                  element={<ArtifactBuildsPage />}
                />
                <Route path="/tier-list" element={<TierListPage />} />
                <Route path="/tier-list/:tab" element={<TierListPage />} />
                <Route path="/archive" element={<ArchivePage />} />
                <Route path="/archive/:tab" element={<ArchivePage />} />
                <Route path="/team-comp" element={<TeamCompPage />} />
                <Route path="/team-comp/:tab" element={<TeamCompPage />} />
                <Route path="/callback" element={<AuthCallbackPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route
                  path="/account/cloud-backup"
                  element={<CloudBackupPage />}
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <Toaster />
          <GreetingGate />
        </div>
      </TourProvider>
    </PageErrorBoundary>
  );
}

export default App;
