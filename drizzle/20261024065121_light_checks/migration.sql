ALTER TYPE "notification_type" ADD VALUE 'light_check';--> statement-breakpoint
CREATE TABLE "light_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"incident_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"answer" varchar(8),
	"token" varchar(48) NOT NULL UNIQUE,
	"asked_at" timestamp,
	"answered_at" timestamp,
	"via" varchar(8),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "light_checks_incident_user_uq" ON "light_checks" ("incident_id","user_id");--> statement-breakpoint
CREATE INDEX "light_checks_user_asked_idx" ON "light_checks" ("user_id","asked_at");--> statement-breakpoint
ALTER TABLE "light_checks" ADD CONSTRAINT "light_checks_incident_id_incidents_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id");--> statement-breakpoint
ALTER TABLE "light_checks" ADD CONSTRAINT "light_checks_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;