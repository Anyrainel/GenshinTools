import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Routes, Route } from 'react-router-dom';
import ArtifactFilterPage from './pages/ArtifactFilter';
import TierListPage from './pages/TierList';
import WeaponTierListPage from './pages/WeaponTierList';
import Home from './pages/Home';
import { Layout } from './components/shared/Layout';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/artifact-filter" element={<Layout><ArtifactFilterPage /></Layout>} />
        <Route path="/tier-list" element={<Layout><TierListPage /></Layout>} />
        <Route path="/weapon-tier-list" element={<Layout><WeaponTierListPage /></Layout>} />
      </Routes>
      <Toaster />
      <Sonner />
    </>
  );
}

export default App;