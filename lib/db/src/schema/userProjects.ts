import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const userProjectsTable = pgTable("user_projects", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.projectId] })]);

export type UserProject = typeof userProjectsTable.$inferSelect;
