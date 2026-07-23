CREATE TABLE "geographies" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"geography_type" text NOT NULL,
	"geo_id" text
);
--> statement-breakpoint
CREATE TABLE "geography_parents" (
	"geography_id" text NOT NULL,
	"parent_id" text NOT NULL,
	CONSTRAINT "geography_parents_geography_id_parent_id_pk" PRIMARY KEY("geography_id","parent_id")
);
--> statement-breakpoint
CREATE TABLE "geography_types" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"label_singular" text,
	"order" integer,
	"is_available" boolean DEFAULT true,
	"is_selectable" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "indicators" (
	"id" text PRIMARY KEY NOT NULL,
	"sector" text,
	"legacy_uid" text
);
--> statement-breakpoint
ALTER TABLE "geographies" ADD CONSTRAINT "geographies_geography_type_geography_types_id_fk" FOREIGN KEY ("geography_type") REFERENCES "geography_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "geography_parents" ADD CONSTRAINT "geography_parents_geography_id_geographies_id_fk" FOREIGN KEY ("geography_id") REFERENCES "geographies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geography_parents" ADD CONSTRAINT "geography_parents_parent_id_geographies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "geographies"("id") ON DELETE cascade ON UPDATE no action;