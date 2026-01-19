import { Toaster } from "@/components/ui/sonner";
import { Route, Routes } from "react-router-dom";
import AccountDataPage from "./pages/AccountData";
import ArtifactFilterPage from "./pages/ArtifactFilter";
import Home from "./pages/Home";
import TeamBuilderPage from "./pages/TeamBuilder";
import TierListPage from "./pages/TierList";
import WeaponTierListPage from "./pages/WeaponTierList";

function App() {
  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 overflow-hidden flex flex-col">
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
