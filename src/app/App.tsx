import "@/providers/reference/statLoaders";
import { type CSSProperties, lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { GreetingGate } from "@/app/home/GreetingGate";
import { useTourLabels, useTours } from "@/app/tourConfig";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TourProvider } from "@/components/ui/tour";
import { SCANNER_DOWNLOAD_PAGE } from "@/config/scannerDownloads";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHydrateBuildPreset } from "@/hooks/useHydrateBuildPreset";
import { useHydrateTeamPreset } from "@/hooks/useHydrateTeamPreset";
import { cn } from "@/lib/utils";
import Home from "../pages/home/HomePage";
import { RouteGameData } from "./RouteGameData";

const AccountDataPage = lazy(
  () => import("../pages/game-account/AccountDataPage")
);
const ArtifactBuildsPage = lazy(() => import("../pages/builds/BuildsPage"));
const TeamCompPage = lazy(() => import("../pages/teams/TeamAnalysisPage"));
const TierListPage = lazy(() => import("../pages/tier-list/TierListPage"));
const ArchivePage = lazy(() => import("../pages/archive/ArchivePage"));
const AccountPage = lazy(() => import("../pages/profile/AccountPage"));
const CloudBackupPage = lazy(() => import("../pages/profile/CloudBackupPage"));
const SupportMePage = lazy(() => import("../pages/profile/SupportMePage"));
const FeedbackPage = lazy(() => import("../pages/profile/FeedbackPage"));
const ScannerDownloadPage = lazy(() => import("../pages/ScannerDownload"));
const AuthCallbackPage = lazy(
  () => import("../pages/profile/AuthCallbackPage")
);
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));

const SITE_NAME = "GGArtifact";

const PAGE_TITLES: Record<string, { en: string; zh: string }> = {
  "/account-data": { en: "Account Data", zh: "账号数据" },
  "/account/feedback": { en: "Feedback", zh: "反馈" },
  "/feedback": { en: "Feedback", zh: "反馈" },
  "/artifact-filter": { en: "Builds", zh: "配装" },
  "/tier-list": { en: "Tier List", zh: "榜单" },
  "/archive": { en: "Archive", zh: "图鉴" },
  "/team-comp": { en: "Team DMG", zh: "队伍伤害" },
  "/account": { en: "Account", zh: "账号" },
  "/download-scanner": { en: "Download GGScanner", zh: "下载 GGScanner" },
};
const NOT_FOUND_TITLE = { en: "Page Not Found", zh: "页面未找到" };

function App() {
  const location = useLocation();
  const { language, t } = useLanguage();
  const isHomePage = location.pathname === "/";
  const isScannerDownloadPage = location.pathname === SCANNER_DOWNLOAD_PAGE;
  useHydrateBuildPreset();
  useHydrateTeamPreset();

  const homeTitle = t.ui("seo.homeTitle");
  const description = isScannerDownloadPage
    ? t.ui("scannerDownload.introduction")
    : t.ui("seo.description");
  useEffect(() => {
    const base = `/${location.pathname.split("/")[1]}`;
    const page = PAGE_TITLES[location.pathname] ?? PAGE_TITLES[base];
    const pageTitle = (page ?? NOT_FOUND_TITLE)[language];
    document.title = isHomePage ? homeTitle : `${pageTitle} — ${SITE_NAME}`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", description);
  }, [isHomePage, location.pathname, language, homeTitle, description]);

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
              <RouteGameData pathname={location.pathname}>
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
                  <Route path="/account/support" element={<SupportMePage />} />
                  <Route path="/account/feedback" element={<FeedbackPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route
                    path={SCANNER_DOWNLOAD_PAGE}
                    element={<ScannerDownloadPage />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </RouteGameData>
            </Suspense>
          </main>
          <Toaster
            style={
              {
                "--normal-bg": "hsl(var(--popover))",
                "--normal-text": "hsl(var(--popover-foreground))",
                "--normal-border": "hsl(var(--border))",
                "--border-radius": "var(--radius)",
              } as CSSProperties
            }
          />
          {!isScannerDownloadPage && <GreetingGate />}
        </div>
      </TourProvider>
    </PageErrorBoundary>
  );
}

export default App;
