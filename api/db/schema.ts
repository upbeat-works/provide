import { pgTable, text, integer, boolean, primaryKey } from 'drizzle-orm/pg-core';

export const geographyTypes = pgTable('geography_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  labelSingular: text('label_singular'),
  order: integer('order'),
  isAvailable: boolean('is_available').default(true),
  // Continents are grouping headers, not pickable data geographies.
  isSelectable: boolean('is_selectable').default(true),
});

// Simple primary key on `id`. Geography ids are globally unique. Where the same
// "place" exists across types and the bare id would collide (country vs. its
// EEZ), the EEZ row carries a ` (EEZ)` suffix by convention.
export const geographies = pgTable('geographies', {
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

// Additive indicator enrichment: curated facts ixmp4 cannot tag onto variables
// (it tags runs, not variables). A row ADDS fields to the convention indicator
// whose id matches (id = the ixmp4 variable's first segment); a missing row
// leaves that indicator unchanged. Curated columns only — `project` comes from
// the ixmp4 instance, not from here.
export const indicators = pgTable('indicators', {
  id: text('id').primaryKey(),
  sector: text('sector'),
  legacyUid: text('legacy_uid'),
});

// Single source of truth for the geography hierarchy. Many-to-many so a
// trans-boundary river basin / shared EEZ can belong to several countries, and
// a country belongs to exactly one continent.
export const geographyParents = pgTable(
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
