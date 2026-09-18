CREATE TYPE "dispatch_status" AS ENUM('assigned', 'en_route', 'on_site', 'completed');--> statement-breakpoint
CREATE TYPE "notification_type" AS ENUM('predicted_outage', 'report_confirmed', 'status_update', 'resolved');--> statement-breakpoint
CREATE TYPE "prediction_status" AS ENUM('active', 'confirmed', 'expired', 'false_positive');--> statement-breakpoint
CREATE TYPE "report_status" AS ENUM('reported', 'confirmed', 'team_dispatched', 'resolved', 'false_report');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('citizen', 'distribution_admin', 'field_team');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(150) NOT NULL,
	"city" varchar(100),
	"state" varchar(100),
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"radius_meters" integer DEFAULT 1000,
	"distribution_company_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dispatch_id" uuid NOT NULL,
	"report_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"team_id" uuid NOT NULL,
	"area_id" uuid,
	"status" "dispatch_status" DEFAULT 'assigned'::"dispatch_status" NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "distribution_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(150) NOT NULL,
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"service_region" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"related_report_id" uuid,
	"related_prediction_id" uuid,
	"message" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "outage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"area_id" uuid,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"description" text,
	"photo_url" text,
	"status" "report_status" DEFAULT 'reported'::"report_status" NOT NULL,
	"outage_started_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"area_id" uuid NOT NULL,
	"predicted_start" timestamp NOT NULL,
	"predicted_end" timestamp,
	"confidence_score" real NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"status" "prediction_status" DEFAULT 'active'::"prediction_status" NOT NULL,
	"reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"distribution_company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"current_lat" double precision,
	"current_lng" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"phone" varchar(20),
	"role" "user_role" DEFAULT 'citizen'::"user_role" NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"address_text" text,
	"area_id" uuid,
	"distribution_company_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "outage_reports_area_status_idx" ON "outage_reports" ("area_id","status");--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_distribution_company_id_distribution_companies_id_fkey" FOREIGN KEY ("distribution_company_id") REFERENCES "distribution_companies"("id");--> statement-breakpoint
ALTER TABLE "dispatch_reports" ADD CONSTRAINT "dispatch_reports_dispatch_id_dispatches_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id");--> statement-breakpoint
ALTER TABLE "dispatch_reports" ADD CONSTRAINT "dispatch_reports_report_id_outage_reports_id_fkey" FOREIGN KEY ("report_id") REFERENCES "outage_reports"("id");--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_team_id_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id");--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_report_id_outage_reports_id_fkey" FOREIGN KEY ("related_report_id") REFERENCES "outage_reports"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_prediction_id_predictions_id_fkey" FOREIGN KEY ("related_prediction_id") REFERENCES "predictions"("id");--> statement-breakpoint
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "outage_reports" ADD CONSTRAINT "outage_reports_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_distribution_company_id_distribution_companies_id_fkey" FOREIGN KEY ("distribution_company_id") REFERENCES "distribution_companies"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_distribution_company_id_distribution_companies_id_fkey" FOREIGN KEY ("distribution_company_id") REFERENCES "distribution_companies"("id");