const listeners = new Set();

export function markCatalogSelectionChange() {
  for (const listener of listeners) listener();
}

export function onCatalogSelectionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
