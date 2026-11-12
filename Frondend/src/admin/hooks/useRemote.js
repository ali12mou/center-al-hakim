import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../services/adminApi.js";

// Lecture d’une adresse de l’API, relancée quand elle change ou sur `reload()`.
// Pendant un rechargement, les données précédentes restent affichées.
export function useRemote(path, { delay = 0 } = {}) {
  const [state, setState] = useState({ data: null, error: "", busy: Boolean(path) });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    setState((current) => ({ ...current, busy: true }));
    const timer = setTimeout(() => {
      adminApi(path)
        .then((data) => live && setState({ data, error: "", busy: false }))
        .catch((failure) => live && setState((current) => ({ ...current, error: failure.message, busy: false })));
    }, delay);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [path, version, delay]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}

// Listes de choix (personnel, formations, comptes…) gardées une minute.
const cache = new Map();
export function invalidateLookup(name) {
  for (const key of cache.keys()) if (key.startsWith(`/lookups/${name}`)) cache.delete(key);
}
export function useLookup(name, query = "") {
  const key = name ? `/lookups/${name}${query ? `?${query}` : ""}` : null;
  const [items, setItems] = useState(() => cache.get(key)?.items || []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (!key) return undefined;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < 60_000) {
      cached.promise.then((list) => mounted.current && setItems(list));
      return () => {
        mounted.current = false;
      };
    }
    const promise = adminApi(key)
      .then((data) => data.items || [])
      .catch(() => []);
    cache.set(key, { at: Date.now(), promise });
    promise.then((list) => {
      cache.set(key, { at: Date.now(), promise, items: list });
      if (mounted.current) setItems(list);
    });
    return () => {
      mounted.current = false;
    };
  }, [key]);
  return items;
}
