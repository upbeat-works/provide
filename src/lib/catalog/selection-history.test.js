import { describe, expect, test, vi } from 'vitest';
import { markCatalogSelectionChange, onCatalogSelectionChange } from './selection-history.js';

describe('catalog selection history intent', () => {
  test('reports direct selection changes until the page unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = onCatalogSelectionChange(listener);

    markCatalogSelectionChange();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    markCatalogSelectionChange();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
