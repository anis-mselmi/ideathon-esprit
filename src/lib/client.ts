"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Small typed fetch wrapper. Throws a friendly error on non-2xx. */
export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Something went wrong. Please try again.");
  }
  return res.json();
}

/** Data-fetching hook with loading/error and a refetch. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const refetch = useCallback(async () => {
    if (!pathRef.current) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(pathRef.current));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, loading, error, refetch, setData };
}
