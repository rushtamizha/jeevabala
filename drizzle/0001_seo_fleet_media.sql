CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"district" text,
	"state" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"intro" text,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attractions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"airport_name" text,
	"image_url" text,
	"meta_title" text,
	"meta_description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text NOT NULL,
	"alt" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"rating" smallint DEFAULT 5 NOT NULL,
	"text" text NOT NULL,
	"avatar_url" text,
	"trip_label" text,
	"source" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"from_name" text NOT NULL,
	"to_name" text NOT NULL,
	"from_city_id" uuid,
	"to_city_id" uuid,
	"distance_km" integer NOT NULL,
	"duration_min" integer NOT NULL,
	"description" text,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "category" text DEFAULT 'SEDAN' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "rates" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "travel_routes" ADD CONSTRAINT "travel_routes_from_city_id_cities_id_fk" FOREIGN KEY ("from_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_routes" ADD CONSTRAINT "travel_routes_to_city_id_cities_id_fk" FOREIGN KEY ("to_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_uq" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_active_idx" ON "cities" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "travel_routes_slug_uq" ON "travel_routes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "travel_routes_from_idx" ON "travel_routes" USING btree ("from_city_id");