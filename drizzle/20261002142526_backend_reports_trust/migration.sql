CREATE TYPE "incident_status" AS ENUM('reported', 'confirmed', 'crew_dispatched', 'restored');--> statement-breakpoint
CREATE TYPE "place_label" AS ENUM('home', 'hostel', 'shop', 'work', 'other');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"area_id" uuid NOT NULL,
	"issue_type" "issue_type" NOT NULL,
	"status" "incident_status" DEFAULT 'reported'::"incident_status" NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"radius_m" integer DEFAULT 200 NOT NULL,
	"weighted_reports" real DEFAULT 0 NOT NULL,
	"reporter_count" integer DEFAULT 0 NOT NULL,
	"light_back_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp NOT NULL,
	"last_report_at" timestamp NOT NULL,
	"confirmed_at" timestamp,
	"restored_at" timestamp,
	"restored_by" varchar(16),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"label" "place_label" NOT NULL,
	"custom_name" varchar(60),
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_m" real,
	"area_id" uuid,
	"directions" text DEFAULT '' NOT NULL,
	"plus_code" varchar(32) NOT NULL,
	"meter_number" varchar(20),
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"report_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "slug" varchar(40);--> statement-breakpoint
-- Existing areas get a slug from their name; the seed script updates them to the app's ids.
UPDATE "areas" SET "slug" = left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 31) || '-' || left("id"::text, 8) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "areas" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "feeder" varchar(80);--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "band" varchar(1);--> statement-breakpoint
ALTER TABLE "areas" ADD COLUMN "households" integer;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "device_lat" double precision;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "device_lng" double precision;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "device_accuracy_m" real;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "landmark" varchar(160);--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "repeat_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "last_confirmed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "light_back_at" timestamp;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "flags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "suspicion_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "weight" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "reviewed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "ip_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_user_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alert_prefs" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trust_score" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_slug_key" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clerk_user_id_key" UNIQUE("clerk_user_id");--> statement-breakpoint
CREATE INDEX "incidents_area_status_idx" ON "incidents" ("area_id","status");--> statement-breakpoint
CREATE INDEX "outage_reports_user_created_idx" ON "outage_reports" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "outage_reports_incident_idx" ON "outage_reports" ("incident_id");--> statement-breakpoint
CREATE INDEX "outage_reports_ip_created_idx" ON "outage_reports" ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "saved_places_user_idx" ON "saved_places" ("user_id");--> statement-breakpoint
CREATE INDEX "trust_events_user_idx" ON "trust_events" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trust_events_report_reason_uq" ON "trust_events" ("report_id","reason");--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_incident_id_incidents_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id");--> statement-breakpoint
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_reviewed_by_id_users_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_report_id_outage_reports_id_fkey" FOREIGN KEY ("report_id") REFERENCES "outage_reports"("id");