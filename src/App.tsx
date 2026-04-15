import { GreetingGate } from "@/components/greeting/GreetingGate";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TourProvider } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTours } from "@/lib/tourConfig";
import { cn } from "@/lib/utils";
import { Suspense, lazy, useEffect, useMemo } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";

const AccountDataPage = lazy(() => import("./pages/AccountData"));
const ArtifactBuildsPage = lazy(() => import("./pages/ArtifactBuilds"));
const TeamCompPage = lazy(() => import("./pages/TeamComp"));
const TierListPage = lazy(() => import("./pages/TierList"));
const ArchivePage = lazy(() => import("./pages/Archive"));
const ERCalcPage = lazy(() => import("./pages/ERCalc"));

const SITE_NAME = "GGArtifact";

const PAGE_TITLES: Record<string, { en: string; zh: string }> = {
  "/account-data": { en: "Account Data", zh: "账号数据" },
  "/artifact-filter": { en: "Builds", zh: "配装" },
  "/tier-list": { en: "Tier List", zh: "榜单" },
  "/archive": { en: "Archive", zh: "图鉴" },
  "/team-comp": { en: "Team DMG", zh: "队伍伤害" },
  "/er-calc": { en: "ER Calculator", zh: "充能计算" },
};

function App() {
  const location = useLocation();
  const { t, language } = useLanguage();
  const isHomePage = location.pathname === "/";

  useEffect(() => {
    const base = `/${location.pathname.split("/")[1]}`;
    const page = PAGE_TITLES[base];
    document.title = page ? `${page[language]} — ${SITE_NAME}` : SITE_NAME;
  }, [location.pathname, language]);

  // Memoize tours to avoid recreating on every render
  const tours = useMemo(() => getTours(t), [t]);

  return (
    <PageErrorBoundary>
      <TourProvider tours={tours}>
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
                {import.meta.env.DEV && (
                  <Route path="/er-calc" element={<ERCalcPage />} />
                )}
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
