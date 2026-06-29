import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const geographyTypes = sqliteTable('geography_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  labelSingular: text('label_singular'),
  order: integer('order'),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
  // Continents are grouping headers, not pickable data geographies.
  isSelectable: integer('is_selectable', { mode: 'boolean' }).default(true),
});

// Simple primary key on `id`. Geography ids are globally unique. Where the same
// "place" exists across types and the bare id would collide (country vs. its
// EEZ), the EEZ row carries a ` (EEZ)` suffix by convention.
export const geographies = sqliteTable('geographies', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  geographyType: text('geography_type')
    .notNull()
    .references(() => geographyTypes.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  // Optional external geo id used by the map geo-shapes and flag assets (ISO
  // 3166-1 alpha-3 for countries; can hold the source id for other admin levels
  // too). Bridges the name-based catalog to id-keyed external data.
  geoId: text('geo_id'),
});

// Single source of truth for the geography hierarchy. Many-to-many so a
// trans-boundary river basin / shared EEZ can belong to several countries, and
// a country belongs to exactly one continent.
export const geographyParents = sqliteTable(
  'geography_parents',
  {
    geographyId: text('geography_id')
      .notNull()
      .references(() => geographies.id, { onDelete: 'cascade' }),
    parentId: text('parent_id')
      .notNull()
      .references(() => geographies.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.geographyId, t.parentId] }) }),
);
