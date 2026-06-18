import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const geographyTypes = sqliteTable('geography_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  labelSingular: text('label_singular'),
  order: integer('order'),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
});

// Simple primary key on `id`. Geography ids are globally unique. Where the same
// "place" exists across types and the bare id would collide (country ISO3 vs.
// its EEZ), the EEZ row carries a `-eez` suffix by convention.
export const geographies = sqliteTable('geographies', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  geographyType: text('geography_type')
    .notNull()
    .references(() => geographyTypes.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  parentId: text('parent_id').references((): any => geographies.id),
});
