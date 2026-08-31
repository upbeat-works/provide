import { keyBy } from 'lodash-es';

// Case-insensitive name matching. ixmp4 exposes entity names (scenarios) that can
// differ only in casing across runs/datapoints — the `SSP5-3.4-OS`/`SSP5-3.4-Os`
// duplicate whose data is split across the two. These keep every scenario-name
// comparison tolerant so a casing mismatch never silently drops a selection.
// Leaf module (lodash only) so it can be imported anywhere without import cycles.
const lc = (v) => String(v).toLowerCase();

/** keyBy that lowercases the key field, for case-insensitive lookups. Read with ciGet. */
export const ciKeyBy = (items, field = 'uid') => keyBy(items ?? [], (item) => lc(item[field]));

/** Case-insensitive lookup into a dict built by ciKeyBy. */
export const ciGet = (dict, key) => (dict == null ? undefined : dict[lc(key)]);

/** Case-insensitive string equality. */
export const ciEquals = (a, b) => lc(a) === lc(b);
