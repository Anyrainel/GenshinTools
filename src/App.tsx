import { Toaster } from "@/components/ui/sonner";
import { TourProvider } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTours } from "@/lib/tourConfig";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AccountDataPage from "./pages/AccountData";
import ArtifactBuildsPage from "./pages/ArtifactBuilds";
import Home from "./pages/Home";
import TeamBuilderPage from "./pages/TeamBuilder";
import TierListPage from "./pages/TierList";
import WeaponBrowserPage from "./pages/WeaponBrowser";
import WeaponTierListPage from "./pages/WeaponTierList";

function App() {
  const location = useLocation();
  const { t } = useLanguage();
  const isHomePage = location.pathname === "/";

  // Memoize tours to avoid recreating on every render
  const tours = useMemo(() => getTours(t), [t]);

  return (
    <TourProvider tours={tours}>
      <div className="h-dvh bg-background text-foreground flex flex-col">
        <main
          className={cn(
            "flex-1 flex flex-col",
            isHomePage ? "overflow-y-auto" : "overflow-hidden"
          )}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/account-data" element={<AccountDataPage />} />
            <Route path="/artifact-filter" element={<ArtifactBuildsPage />} />
            <Route path="/tier-list" element={<TierListPage />} />
            <Route path="/weapon-tier-list" element={<WeaponTierListPage />} />
            <Route path="/weapon-browser" element={<WeaponBrowserPage />} />
            <Route path="/team-builder" element={<TeamBuilderPage />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </TourProvider>
  );
}

export default App;
