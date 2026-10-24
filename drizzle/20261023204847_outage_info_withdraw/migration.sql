ALTER TABLE "incidents" ADD COLUMN "eta_at" timestamp;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "cause" varchar(32);--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "public_note" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "public_note_at" timestamp;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "withdrawn_at" timestamp;