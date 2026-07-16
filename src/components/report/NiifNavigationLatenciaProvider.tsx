"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNiifDelayedLoader } from "@/hooks/useNiifDelayedLoader";
import { niifNavPresetForPath } from "@/lib/niif/navigation-latency";
import { NiifNavegacionOverlay } from "@/components/report/NiifNavegacionOverlay";

function isInternalHref(href: string, origin: string): boolean {
  if (!href || href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    const url = new URL(href, origin);
    return url.origin === origin && url.pathname.startsWith("/");
  } catch {
    return href.startsWith("/");
  }
}

function NiifNavigationLatenciaInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [navPending, setNavPending] = useState(false);
  const [targetPath, setTargetPath] = useState(pathname);

  useEffect(() => {
    setNavPending(false);
  }, [routeKey]);

  useEffect(() => {
    const origin = window.location.origin;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !isInternalHref(href, origin)) return;

      const next = new URL(href, origin);
      const nextKey = `${next.pathname}${next.search}`;
      const currentKey = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      if (nextKey === currentKey) return;

      setTargetPath(next.pathname);
      setNavPending(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, searchParams]);

  const showOverlay = useNiifDelayedLoader(navPending);
  const preset = useMemo(() => niifNavPresetForPath(targetPath), [targetPath]);

  return (
    <>
      {children}
      {showOverlay ? <NiifNavegacionOverlay open {...preset} /> : null}
    </>
  );
}

/** Provider global Report — NIIF-NAV-LAT-500 en cada navegación interna. */
export function NiifNavigationLatenciaProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <NiifNavigationLatenciaInner>{children}</NiifNavigationLatenciaInner>
    </Suspense>
  );
}
