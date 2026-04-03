import { GreetingGate } from "@/components/greeting/GreetingGate";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { TourProvider } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTours } from "@/lib/tourConfig";
import { cn } from "@/lib/utils";
import { Suspense, lazy, useMemo } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";

const AccountDataPage = lazy(() => import("./pages/AccountData"));
const ArtifactBuildsPage = lazy(() => import("./pages/ArtifactBuilds"));
const TeamCompPage = lazy(() => import("./pages/TeamComp"));
const TierListPage = lazy(() => import("./pages/TierList"));
const ArchivePage = lazy(() => import("./pages/Archive"));

function App() {
  const location = useLocation();
  const { t } = useLanguage();
  const isHomePage = location.pathname === "/";

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
