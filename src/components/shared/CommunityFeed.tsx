import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type CommunityPage,
  loadCommunityPage,
} from "@/providers/community/community";

export function CommunityFeed<T extends { id: string }>({
  path,
  revision = 0,
  includeOwn = false,
  compact = false,
  renderItem,
}: {
  path: string;
  revision?: number;
  includeOwn?: boolean;
  compact?: boolean;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <FeedPage<T>
      key={`${path}:${revision}:${includeOwn}`}
      path={path}
      includeOwn={includeOwn}
      compact={compact}
      renderItem={renderItem}
    />
  );
}

function FeedPage<T extends { id: string }>({
  path,
  renderItem,
  includeOwn,
  compact,
}: {
  path: string;
  renderItem: (item: T) => React.ReactNode;
  includeOwn: boolean;
  compact: boolean;
}) {
  const { t } = useLanguage();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [request, setRequest] = useState({
    page: 0,
    cursor: null as string | null,
  });
  const [data, setData] = useState<CommunityPage<T> | null>(null);
  const [error, setError] = useState(false);
  const page = request.page;
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    const signal = controller.signal;
    loadCommunityPage<T>(path, request.cursor, signal, includeOwn).then(
      (result) => {
        if (!controller.signal.aborted) setData(result);
      },
      () => {
        if (!controller.signal.aborted) setError(true);
      }
    );
    return () => controller.abort();
  }, [path, request, includeOwn]);
  return (
    <div className="space-y-3" aria-live="polite">
      {error ? (
        <div role="alert" className="flex items-center gap-3">
          <p>{t.ui("community.loadFailed")}</p>
          <Button variant="outline" onClick={() => setRequest({ ...request })}>
            {t.ui("community.retry")}
          </Button>
        </div>
      ) : !data ? (
        <p role="status">{t.ui("community.loading")}</p>
      ) : data.items.length === 0 ? (
        <p>{t.ui("community.empty")}</p>
      ) : (
        data.items.map((item) => (
          <article
            key={item.id}
            className={
              compact
                ? "min-w-0 space-y-2 break-words py-2"
                : "rounded-lg border border-border bg-gradient-card p-4 space-y-2 break-words"
            }
          >
            {renderItem(item)}
          </article>
        ))
      )}
      {(page > 0 || data?.nextCursor) && (
        <nav
          className="flex items-center justify-between gap-3"
          aria-label={t.ui("community.pagination")}
        >
          <Button
            variant="outline"
            disabled={page === 0 || !data}
            onClick={() =>
              setRequest({ page: page - 1, cursor: cursors[page - 1] })
            }
          >
            {t.ui("community.previous")}
          </Button>
          <span>{page + 1}</span>
          <Button
            variant="outline"
            disabled={!data?.nextCursor}
            onClick={() => {
              if (!data?.nextCursor) return;
              setCursors((values) => [
                ...values.slice(0, page + 1),
                data.nextCursor,
              ]);
              setRequest({ page: page + 1, cursor: data.nextCursor });
            }}
          >
            {t.ui("community.next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
