CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sending', 'sent', 'failed', 'simulated', 'received');--> statement-breakpoint
CREATE TABLE "lead_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"status" "message_status" NOT NULL,
	"body" text NOT NULL,
	"subject" text,
	"from_address" text,
	"message_id" text,
	"in_reply_to" text,
	"error" text,
	"sent_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_messages_messageId_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "mail_sync_state" (
	"mailbox" text PRIMARY KEY NOT NULL,
	"uid_validity" text,
	"last_uid" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reply_token" text;--> statement-breakpoint
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_messages" ADD CONSTRAINT "lead_messages_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_messages_lead_id_created_at_index" ON "lead_messages" USING btree ("lead_id","created_at");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_replyToken_unique" UNIQUE("reply_token");