import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  users: {
    area: r.one.areas({
      from: r.users.areaId,
      to: r.areas.id,
    }),
    distributionCompany: r.one.distributionCompanies({
      from: r.users.distributionCompanyId,
      to: r.distributionCompanies.id,
    }),
    reports: r.many.outageReports(),
    notifications: r.many.notifications(),
  },

  distributionCompanies: {
    users: r.many.users(),
    areas: r.many.areas(),
    teams: r.many.teams(),
  },

  areas: {
    distributionCompany: r.one.distributionCompanies({
      from: r.areas.distributionCompanyId,
      to: r.distributionCompanies.id,
    }),
    reports: r.many.outageReports(),
    predictions: r.many.predictions(),
    dispatches: r.many.dispatches(),
  },

  teams: {
    distributionCompany: r.one.distributionCompanies({
      from: r.teams.distributionCompanyId,
      to: r.distributionCompanies.id,
    }),
    dispatches: r.many.dispatches(),
  },

  outageReports: {
    user: r.one.users({
      from: r.outageReports.userId,
      to: r.users.id,
    }),
    area: r.one.areas({
      from: r.outageReports.areaId,
      to: r.areas.id,
    }),
    dispatchLinks: r.many.dispatchReports(),
  },

  dispatches: {
    team: r.one.teams({
      from: r.dispatches.teamId,
      to: r.teams.id,
    }),
    area: r.one.areas({
      from: r.dispatches.areaId,
      to: r.areas.id,
    }),
    reportLinks: r.many.dispatchReports(),
  },

  dispatchReports: {
    dispatch: r.one.dispatches({
      from: r.dispatchReports.dispatchId,
      to: r.dispatches.id,
    }),
    report: r.one.outageReports({
      from: r.dispatchReports.reportId,
      to: r.outageReports.id,
    }),
  },

  predictions: {
    area: r.one.areas({
      from: r.predictions.areaId,
      to: r.areas.id,
    }),
    notifications: r.many.notifications(),
  },

  notifications: {
    user: r.one.users({
      from: r.notifications.userId,
      to: r.users.id,
    }),
    report: r.one.outageReports({
      from: r.notifications.relatedReportId,
      to: r.outageReports.id,
    }),
    prediction: r.one.predictions({
      from: r.notifications.relatedPredictionId,
      to: r.predictions.id,
    }),
  },
}));