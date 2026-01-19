import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Route, Routes, useLocation } from "react-router-dom";
import AccountDataPage from "./pages/AccountData";
import ArtifactFilterPage from "./pages/ArtifactFilter";
import Home from "./pages/Home";
import TeamBuilderPage from "./pages/TeamBuilder";
import TierListPage from "./pages/TierList";
import WeaponTierListPage from "./pages/WeaponTierList";

function App() {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
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
          <Route path="/artifact-filter" element={<ArtifactFilterPage />} />
          <Route path="/tier-list" element={<TierListPage />} />
          <Route path="/weapon-tier-list" element={<WeaponTierListPage />} />
          <Route path="/team-builder" element={<TeamBuilderPage />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

export default App;
