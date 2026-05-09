import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAssetUrl } from "@/lib/utils";

export default function NotFoundPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <PageLayout>
      <ScrollLayout bodyClassName="flex items-center justify-center px-4">
        <section className="w-full max-w-xl rounded-xl bg-gradient-card border border-border overflow-hidden shadow-lg">
          <div className="bg-gradient-select border-b border-border/70 px-5 py-4 flex items-center gap-3">
            <img
              src={getAssetUrl("logo_gt.svg")}
              alt="GGArtifact"
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-primary">
                GGArtifact
              </div>
              <h1 className="text-xl md:text-2xl font-bold">
                {t.ui("notFound.title")}
              </h1>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-border p-2 shrink-0">
                <SearchX className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold">
                  {t.ui("notFound.status")}
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.ui("notFound.description")}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-4 w-4" />
                {t.ui("notFound.goBack")}
              </Button>
              <Button asChild>
                <Link to="/">
                  <Home className="h-4 w-4" />
                  {t.ui("notFound.homeCta")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </ScrollLayout>
    </PageLayout>
  );
}
