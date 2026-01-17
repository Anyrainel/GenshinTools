import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "./contexts/LanguageContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { HashRouter } from "react-router-dom";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider delayDuration={200}>
          <HashRouter>
            <App />
          </HashRouter>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>,
);
