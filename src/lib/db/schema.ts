import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  doublePrecision,
  integer,
  real,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* ENUMS                                                              */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", [
  "citizen",
  "distribution_admin",
  "field_team",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "reported",
  "confirmed",
  "team_dispatched",
  "resolved",
  "false_report",
]);

export const predictionStatusEnum = pgEnum("prediction_status", [
  "active",
  "confirmed",
  "expired",
  "false_positive",
]);

export const dispatchStatusEnum = pgEnum("dispatch_status", [
  "assigned",
  "en_route",
  "on_site",
  "completed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "predicted_outage",
  "report_confirmed",
  "status_update",
  "resolved",
]);

/* ------------------------------------------------------------------ */
/* USERS                                                              */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  role: userRoleEnum("role").notNull().default("citizen"),
  // Home location, used to auto-attach reports/predictions to an area
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  addressText: text("address_text"),
  areaId: uuid("area_id").references(() => areas.id),
  distributionCompanyId: uuid("distribution_company_id").references(
    () => distributionCompanies.id
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* AREAS (neighborhood / feeder zones used to cluster reports)        */
/* ------------------------------------------------------------------ */

export const areas = pgTable("areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  // Simple centroid + radius model to start; can migrate to PostGIS geometry later
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  radiusMeters: integer("radius_meters").default(1000),
  distributionCompanyId: uuid("distribution_company_id").references(
    () => distributionCompanies.id
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* DISTRIBUTION COMPANIES + FIELD TEAMS                               */
/* ------------------------------------------------------------------ */

export const distributionCompanies = pgTable("distribution_companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  serviceRegion: varchar("service_region", { length: 150 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  distributionCompanyId: uuid("distribution_company_id")
    .references(() => distributionCompanies.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* OUTAGE REPORTS (citizen-submitted)                                 */
/* ------------------------------------------------------------------ */

export const outageReports = pgTable(
  "outage_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    areaId: uuid("area_id").references(() => areas.id),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    description: text("description"),
    photoUrl: text("photo_url"),
    status: reportStatusEnum("status").default("reported").notNull(),
    outageStartedAt: timestamp("outage_started_at").notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    areaStatusIdx: index("outage_reports_area_status_idx").on(
      table.areaId,
      table.status
    ),
  })
);

/* ------------------------------------------------------------------ */
/* DISPATCHES (a team assigned to fix a cluster of reports)           */
/* ------------------------------------------------------------------ */

export const dispatches = pgTable("dispatches", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id)
    .notNull(),
  areaId: uuid("area_id").references(() => areas.id),
  status: dispatchStatusEnum("status").default("assigned").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Join table: which reports a given dispatch is addressing (one dispatch can
// resolve several overlapping reports in the same area at once)
export const dispatchReports = pgTable("dispatch_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  dispatchId: uuid("dispatch_id")
    .references(() => dispatches.id)
    .notNull(),
  reportId: uuid("report_id")
    .references(() => outageReports.id)
    .notNull(),
});

/* ------------------------------------------------------------------ */
/* AI PREDICTIONS                                                     */
/* ------------------------------------------------------------------ */

export const predictions = pgTable("predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  areaId: uuid("area_id")
    .references(() => areas.id)
    .notNull(),
  predictedStart: timestamp("predicted_start").notNull(),
  predictedEnd: timestamp("predicted_end"),
  confidenceScore: real("confidence_score").notNull(), // 0.0–1.0
  modelVersion: varchar("model_version", { length: 50 }).notNull(),
  status: predictionStatusEnum("status").default("active").notNull(),
  reasoning: text("reasoning"), // short human-readable explanation, optional
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* NOTIFICATIONS                                                      */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    type: notificationTypeEnum("type").notNull(),
    relatedReportId: uuid("related_report_id").references(
      () => outageReports.id
    ),
    relatedPredictionId: uuid("related_prediction_id").references(
      () => predictions.id
    ),
    message: text("message").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.readAt
    ),
  })
);

