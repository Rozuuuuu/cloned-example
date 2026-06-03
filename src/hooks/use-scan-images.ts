import { useEffect, useState } from "react";
import { resolveScanImage, type ScanRecord } from "@/lib/habi";

/** Resolves signed/inline image URLs for a list of scans, keyed by scan id. */
export const useScanImages = (scans: ScanRecord[]) => {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        scans.map(async (s) => [s.id, await resolveScanImage(s)] as const)
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of entries) if (url) next[id] = url;
      setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [scans]);

  return urls;
};