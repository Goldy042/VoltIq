ALTER TABLE "dispatches" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "dispatches" ADD COLUMN "assigned_by_id" uuid;--> statement-breakpoint
CREATE INDEX "dispatches_incident_idx" ON "dispatches" ("incident_id");--> statement-breakpoint
CREATE INDEX "dispatches_team_status_idx" ON "dispatches" ("team_id","status");--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_incident_id_incidents_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id");--> statement-breakpoint
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_assigned_by_id_users_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id");