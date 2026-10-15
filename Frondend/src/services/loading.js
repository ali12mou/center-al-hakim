// Chargements de page en cours : l’animation du logo reste visible tant qu’ils durent.
let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener(pending));

export function trackLoading(promise) {
  pending += 1;
  emit();
  return promise.finally(() => {
    pending -= 1;
    emit();
  });
}
export const loadingCount = () => pending;
export function onLoadingChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
