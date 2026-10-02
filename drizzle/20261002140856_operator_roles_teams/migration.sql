CREATE TYPE "issue_type" AS ENUM('no_power', 'low_voltage', 'fluctuating');--> statement-breakpoint
CREATE TABLE "area_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_m" real,
	"guessed_area_id" uuid,
	"area_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "location_accuracy_m" real;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "issue_type" "issue_type" DEFAULT 'no_power'::"issue_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "outage_reports" ADD COLUMN "voltage_reading" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "lead_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "lead_assigned_by_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "lead_assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "feeders" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "on_shift" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
-- Map the old roles onto the new ones before the cast back to the enum.
UPDATE "users" SET "role" = 'manager' WHERE "role" = 'distribution_admin';--> statement-breakpoint
UPDATE "users" SET "role" = 'technician' WHERE "role" = 'field_team';--> statement-breakpoint
DROP TYPE "user_role";--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('citizen', 'manager', 'dispatcher', 'team_lead', 'technician');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "user_role" USING "role"::"user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'citizen'::"user_role";--> statement-breakpoint
CREATE INDEX "area_corrections_area_idx" ON "area_corrections" ("area_id");--> statement-breakpoint
ALTER TABLE "area_corrections" ADD CONSTRAINT "area_corrections_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "area_corrections" ADD CONSTRAINT "area_corrections_guessed_area_id_areas_id_fkey" FOREIGN KEY ("guessed_area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "area_corrections" ADD CONSTRAINT "area_corrections_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_user_id_users_id_fkey" FOREIGN KEY ("lead_user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_assigned_by_id_users_id_fkey" FOREIGN KEY ("lead_assigned_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");