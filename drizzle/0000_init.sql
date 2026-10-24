CREATE TYPE "public"."channel_type" AS ENUM('site', 'kyero', 'telegram', 'mock_portal');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'handled');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('es', 'en', 'uk');--> statement-breakpoint
CREATE TYPE "public"."operation" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('draft', 'active', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('flat', 'chalet', 'bungalow', 'country_house', 'land', 'shop');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('queued', 'published', 'failed', 'removed');--> statement-breakpoint
CREATE TYPE "public"."sync_action" AS ENUM('publish', 'update', 'unpublish');--> statement-breakpoint
CREATE TYPE "public"."sync_result" AS ENUM('success', 'error');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'demo');--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "channel_type" NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" integer NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"type" "property_type" NOT NULL,
	"operation" "operation" NOT NULL,
	"status" "property_status" DEFAULT 'draft' NOT NULL,
	"price" integer NOT NULL,
	"bedrooms" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"area" integer NOT NULL,
	"town" text NOT NULL,
	"province" text DEFAULT 'Alicante' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "property_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" "publication_status" DEFAULT 'queued' NOT NULL,
	"external_id" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"action" "sync_action" NOT NULL,
	"result" "sync_result" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_translations" ADD CONSTRAINT "property_translations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_status_created_at_index" ON "leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "photos_property_id_position_index" ON "photos" USING btree ("property_id","position");--> statement-breakpoint
CREATE INDEX "properties_status_index" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_created_by_id_index" ON "properties" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_translations_property_id_locale_index" ON "property_translations" USING btree ("property_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_property_id_channel_id_index" ON "publications" USING btree ("property_id","channel_id");--> statement-breakpoint
CREATE INDEX "sync_logs_publication_id_created_at_index" ON "sync_logs" USING btree ("publication_id","created_at");