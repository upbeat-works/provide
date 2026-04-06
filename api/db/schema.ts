import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const geographyTypes = sqliteTable('geography_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  labelSingular: text('label_singular'),
  order: integer('order'),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
});

export const geographies = sqliteTable('geographies', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  geographyType: text('geography_type')
    .notNull()
    .references(() => geographyTypes.id),
  parentId: text('parent_id').references((): any => geographies.id),
  sharedId: text('shared_id'),
});
