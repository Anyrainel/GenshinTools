import { Toaster } from "@/components/ui/sonner";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/shared/Layout";
import AccountDataPage from "./pages/AccountData";
import ArtifactFilterPage from "./pages/ArtifactFilter";
import Home from "./pages/Home";
import TeamBuilderPage from "./pages/TeamBuilder";
import TierListPage from "./pages/TierList";
import WeaponTierListPage from "./pages/WeaponTierList";

function App() {
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />
        <Route
          path="/account-data"
          element={
            <Layout>
              <AccountDataPage />
            </Layout>
          }
        />
        <Route
          path="/artifact-filter"
          element={
            <Layout>
              <ArtifactFilterPage />
            </Layout>
          }
        />
        <Route
          path="/tier-list"
          element={
            <Layout>
              <TierListPage />
            </Layout>
          }
        />
        <Route
          path="/weapon-tier-list"
          element={
            <Layout>
              <WeaponTierListPage />
            </Layout>
          }
        />
        <Route
          path="/team-builder"
          element={
            <Layout>
              <TeamBuilderPage />
            </Layout>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
