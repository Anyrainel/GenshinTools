import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAssetUrl } from "@/lib/utils";

const SUPPORT_IMAGE_PATHS = ["/assets/imga.JPG", "/assets/imgv.JPG"] as const;

export default function SupportMePage() {
  const { t } = useLanguage();

  return (
    <PageLayout>
      <ScrollLayout bodyClassName="px-4 py-8 md:py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
          <header className="max-w-xl space-y-2 text-center">
            <h1 className="text-2xl font-semibold md:text-3xl">
              {t.ui("accountSystem.supportTitle")}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">
              {t.ui("accountSystem.supportDesc")}
            </p>
          </header>

          <div className="grid w-full max-w-2xl grid-cols-1 items-start justify-items-center gap-4 md:grid-cols-2">
            {SUPPORT_IMAGE_PATHS.map((path) => (
              <div
                key={path}
                className="w-full max-w-xs overflow-hidden rounded-lg border border-border bg-card/40"
              >
                <img
                  src={getAssetUrl(path)}
                  alt=""
                  className="block h-auto w-full max-w-full"
                />
              </div>
            ))}
          </div>
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}
