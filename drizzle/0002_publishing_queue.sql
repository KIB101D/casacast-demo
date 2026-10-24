ALTER TABLE "publications" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publications" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
CREATE INDEX "publications_status_next_attempt_at_index" ON "publications" USING btree ("status","next_attempt_at");