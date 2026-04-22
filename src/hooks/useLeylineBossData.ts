import { loadLeylineBossData } from "@/data/gameDataLoader";
import type { LeylineBossData } from "@/data/types";
import { useEffect, useState } from "react";

/**
 * Load leyline boss data lazily. Returns ``null`` until the JSON bundles have
 * loaded. The underlying promise is cached so repeated calls share the same
 * data without re-fetching.
 */
export function useLeylineBossData(): LeylineBossData | null {
  const [data, setData] = useState<LeylineBossData | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadLeylineBossData().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
