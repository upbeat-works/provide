import { onCatalogSelectionChange } from '$lib/catalog/selection-history.js';
import { replaceCatalogUrlSelection } from '$lib/utils/url.js';

function sameUrl(left, right) {
  if (left.origin !== right.origin || left.pathname !== right.pathname || left.hash !== right.hash) return false;
  const entries = (url) => [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  return JSON.stringify(entries(left)) === JSON.stringify(entries(right));
}

export function createExploreUrlSync({ selectionStore, getUrl, getPageState, push, replace, restore, events }) {
  const pathname = getUrl().pathname;
  let active = true;
  let ready = false;
  let restoring = false;
  let pushNext = false;
  let latestSelection;
  let restoreRevision = 0;

  function write(mode) {
    const current = getUrl();
    if (!latestSelection || current.pathname !== pathname) return;
    const next = replaceCatalogUrlSelection(current, latestSelection);
    if (sameUrl(next, current)) return;
    const state = { ...getPageState(), explorerSelection: latestSelection };
    if (mode === 'push') {
      push(next, state);
      return;
    }
    replace(next, state);
  }

  const stopSelection = selectionStore.subscribe((selection) => {
    latestSelection = selection;
    if (!ready || restoring) return;
    const mode = pushNext ? 'push' : 'replace';
    pushNext = false;
    write(mode);
  });

  const stopSelectionChanges = onCatalogSelectionChange(() => {
    pushNext = true;
    queueMicrotask(() => {
      if (ready) pushNext = false;
    });
  });

  async function restoreHistory() {
    const url = getUrl();
    if (url.pathname !== pathname) {
      ready = false;
      return;
    }
    const revision = ++restoreRevision;
    restoring = true;
    ready = false;
    const restored = await restore(url);
    if (!active || revision !== restoreRevision) return;
    restoring = false;
    if (!restored) return;
    ready = true;
    if (pushNext) {
      pushNext = false;
      write('push');
    }
  }

  events.addEventListener('popstate', restoreHistory);

  return {
    ready() {
      ready = true;
      const mode = pushNext ? 'push' : 'replace';
      pushNext = false;
      write(mode);
    },
    destroy() {
      active = false;
      restoreRevision += 1;
      stopSelection();
      stopSelectionChanges();
      events.removeEventListener('popstate', restoreHistory);
    },
  };
}
