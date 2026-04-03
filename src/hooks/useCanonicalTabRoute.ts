import { useCallback, useEffect } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

interface UseCanonicalTabRouteOptions<T extends string> {
  basePath: string;
  defaultTab: T;
  isValidTab: (tab: string | null) => tab is T;
  preserveSearchOnTabChange?: boolean;
}

export function useCanonicalTabRoute<T extends string>({
  basePath,
  defaultTab,
  isValidTab,
  preserveSearchOnTabChange = false,
}: UseCanonicalTabRouteOptions<T>) {
  const { tab: routeTab } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const legacyTab = searchParams.get("tab");
  const activeTab = isValidTab(routeTab ?? null)
    ? routeTab
    : isValidTab(legacyTab)
      ? legacyTab
      : defaultTab;

  useEffect(() => {
    const canonicalPath = `${basePath}/${activeTab}`;
    if (location.pathname === canonicalPath && !searchParams.has("tab")) return;

    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.delete("tab");
    const nextSearchString = nextSearch.toString();

    navigate(
      {
        pathname: canonicalPath,
        search: nextSearchString ? `?${nextSearchString}` : "",
      },
      { replace: true }
    );
  }, [activeTab, basePath, location.pathname, navigate, searchParams]);

  const setActiveTab = useCallback(
    (tab: string) => {
      const nextTab = isValidTab(tab) ? tab : defaultTab;
      const nextSearch = preserveSearchOnTabChange
        ? new URLSearchParams(searchParams)
        : new URLSearchParams();
      nextSearch.delete("tab");
      const nextSearchString = nextSearch.toString();

      navigate(
        {
          pathname: `${basePath}/${nextTab}`,
          search: nextSearchString ? `?${nextSearchString}` : "",
        },
        { replace: true }
      );
    },
    [
      basePath,
      defaultTab,
      isValidTab,
      navigate,
      preserveSearchOnTabChange,
      searchParams,
    ]
  );

  return { activeTab, setActiveTab };
}
