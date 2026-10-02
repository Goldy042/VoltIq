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
  uniqueIndex,
  jsonb,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* ENUMS                                                              */
/* ------------------------------------------------------------------ */

// Staff roles: a manager runs the district and assigns each team its lead;
// dispatchers triage and dispatch; team leads and technicians work in the field.
export const userRoleEnum = pgEnum("user_role", [
  "citizen",
  "manager",
  "dispatcher",
  "team_lead",
  "technician",
]);


export const reportStatusEnum = pgEnum("report_status", [
  "reported",
  "confirmed",
  "team_dispatched",
  "resolved",
  "false_report",
]);

// What the citizen is experiencing — dim and unstable supply is tracked, not just outages
export const issueTypeEnum = pgEnum("issue_type", [
  "no_power",
  "low_voltage",
  "fluctuating",
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

// An outage as EEDC sees it: many reports merged into one fault. Mirrors
// IncidentStatus in the app.
export const incidentStatusEnum = pgEnum("incident_status", [
  "reported",
  "confirmed",
  "crew_dispatched",
  "restored",
]);

export const placeLabelEnum = pgEnum("place_label", [
  "home",
  "hostel",
  "shop",
  "work",
  "other",
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
  // Clerk owns sign-in; this row is created the first time a Clerk user hits the API
  clerkUserId: varchar("clerk_user_id", { length: 64 }).unique(),
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
  // Field staff only: the team they work on
  teamId: uuid("team_id").references((): AnyPgColumn => teams.id),
  // Set by a manager; nothing tracks shifts automatically
  onShift: boolean("on_shift").default(false).notNull(),
  // Set when the resident finishes onboarding (at least one saved place)
  onboardedAt: timestamp("onboarded_at"),
  // Which alerts and channels they want — see AlertPrefs in src/lib/profile.tsx
  alertPrefs: jsonb("alert_prefs").$type<Record<string, boolean>>(),
  // 0–100. Starts at 50, rises when reports are corroborated or confirmed,
  // falls when EEDC marks them false. Weights reports and sets rate limits.
  trustScore: integer("trust_score").default(50).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* SAVED PLACES                                                       */
/* ------------------------------------------------------------------ */

// Home, hostel, shop… Always a coordinate; everything people read is derived.
export const savedPlaces = pgTable(
  "saved_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    label: placeLabelEnum("label").notNull(),
    customName: varchar("custom_name", { length: 60 }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    // GPS error when the pin came from the phone; null when placed by hand
    accuracyM: real("accuracy_m"),
    areaId: uuid("area_id").references(() => areas.id),
    directions: text("directions").default("").notNull(),
    plusCode: varchar("plus_code", { length: 32 }).notNull(),
    meterNumber: varchar("meter_number", { length: 20 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("saved_places_user_idx").on(table.userId),
  })
);

/* ------------------------------------------------------------------ */
/* AREAS (neighborhood / feeder zones used to cluster reports)        */
/* ------------------------------------------------------------------ */

export const areas = pgTable("areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Stable id the app uses ("hilltop", "odim"); seeded from src/data/nsukka.ts
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  feeder: varchar("feeder", { length: 80 }),
  // NERC service band A–D
  band: varchar("band", { length: 1 }),
  households: integer("households"),
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
  // The lead's name is what residents see beside the team. Only a manager sets it.
  leadUserId: uuid("lead_user_id").references((): AnyPgColumn => users.id),
  leadAssignedById: uuid("lead_assigned_by_id").references((): AnyPgColumn => users.id),
  leadAssignedAt: timestamp("lead_assigned_at"),
  // Feeders this team covers first, e.g. {"UNN Campus 11kV","Onuiyi 11kV"}
  feeders: text("feeders").array().default([]).notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* INCIDENTS (one fault; many reports merge into it)                  */
/* ------------------------------------------------------------------ */

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    areaId: uuid("area_id")
      .references(() => areas.id)
      .notNull(),
    issueType: issueTypeEnum("issue_type").notNull(),
    status: incidentStatusEnum("status").default("reported").notNull(),
    centerLat: doublePrecision("center_lat").notNull(),
    centerLng: doublePrecision("center_lng").notNull(),
    radiusM: integer("radius_m").default(200).notNull(),
    // Sum of report weights (trust-based; flagged reports count 0)
    weightedReports: real("weighted_reports").default(0).notNull(),
    // Distinct residents who reported it / said their light is back
    reporterCount: integer("reporter_count").default(0).notNull(),
    lightBackCount: integer("light_back_count").default(0).notNull(),
    startedAt: timestamp("started_at").notNull(),
    lastReportAt: timestamp("last_report_at").notNull(),
    confirmedAt: timestamp("confirmed_at"),
    restoredAt: timestamp("restored_at"),
    // "community" when enough residents said the light is back, "eedc" when staff closed it
    restoredBy: varchar("restored_by", { length: 16 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    areaStatusIdx: index("incidents_area_status_idx").on(table.areaId, table.status),
  })
);

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
    // GPS error radius in metres when the pin came from the phone; null if placed by hand
    locationAccuracyM: real("location_accuracy_m"),
    issueType: issueTypeEnum("issue_type").default("no_power").notNull(),
    // Reading from the resident's stabiliser or meter display, when they have one
    voltageReading: integer("voltage_reading"),
    description: text("description"),
    photoUrl: text("photo_url"),
    status: reportStatusEnum("status").default("reported").notNull(),
    outageStartedAt: timestamp("outage_started_at").notNull(),
    resolvedAt: timestamp("resolved_at"),
    incidentId: uuid("incident_id").references(() => incidents.id),
    // Where the phone was when the report was sent (the pin can be dragged elsewhere)
    deviceLat: doublePrecision("device_lat"),
    deviceLng: doublePrecision("device_lng"),
    deviceAccuracyM: real("device_accuracy_m"),
    landmark: varchar("landmark", { length: 160 }),
    // Same person reporting the same outage again: we bump these instead of adding a row
    repeatCount: integer("repeat_count").default(0).notNull(),
    lastConfirmedAt: timestamp("last_confirmed_at").defaultNow().notNull(),
    // The resident told us their light came back
    lightBackAt: timestamp("light_back_at"),
    // Abuse checks: why the report looks off, and how much (0–100+). Flagged
    // reports are kept but carry no weight until EEDC reviews them.
    flags: text("flags").array().default([]).notNull(),
    suspicionScore: integer("suspicion_score").default(0).notNull(),
    flagged: boolean("flagged").default(false).notNull(),
    // Weight this report added to its incident (trust-based)
    weight: real("weight").default(1).notNull(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedById: uuid("reviewed_by_id").references((): AnyPgColumn => users.id),
    // Salted hash of the sender's IP, only for rate limiting
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    areaStatusIdx: index("outage_reports_area_status_idx").on(
      table.areaId,
      table.status
    ),
    userCreatedIdx: index("outage_reports_user_created_idx").on(table.userId, table.createdAt),
    incidentIdx: index("outage_reports_incident_idx").on(table.incidentId),
    ipCreatedIdx: index("outage_reports_ip_created_idx").on(table.ipHash, table.createdAt),
  })
);

/* ------------------------------------------------------------------ */
/* TRUST EVENTS (why a resident's trust score moved)                  */
/* ------------------------------------------------------------------ */

export const trustEvents = pgTable(
  "trust_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    delta: integer("delta").notNull(),
    // corroborated | accepted | false_report | …
    reason: varchar("reason", { length: 32 }).notNull(),
    reportId: uuid("report_id").references(() => outageReports.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("trust_events_user_idx").on(table.userId),
    // One event of each kind per report, so retries can't double-count
    onePerReport: uniqueIndex("trust_events_report_reason_uq").on(table.reportId, table.reason),
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
/* AREA CORRECTIONS                                                   */
/* ------------------------------------------------------------------ */

// "I'm in Hilltop, not Odim Gate": residents correcting the area we guessed
// for a point. Used to fix area boundaries and to answer nearby lookups.
export const areaCorrections = pgTable(
  "area_corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    accuracyM: real("accuracy_m"),
    guessedAreaId: uuid("guessed_area_id").references(() => areas.id),
    areaId: uuid("area_id")
      .references(() => areas.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    areaIdx: index("area_corrections_area_idx").on(table.areaId),
  })
);

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

