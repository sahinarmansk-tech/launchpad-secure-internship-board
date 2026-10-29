import { z } from "zod";
const fields = {
 title: z.string().trim().min(2).max(120),
 domain: z.string().trim().min(2).max(80),
 mode: z.enum(["Remote", "Hybrid", "On-site"]),
 location: z.string().trim().min(2).max(100),
 skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
 openings: z.number().int().min(0).max(100000),
 duration_weeks: z.number().int().positive().max(520).nullable().optional(),
 applications_open: z.boolean().optional()
};
export const createSchema = z.object({
 id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
 ...fields
}).strict();
export const updateSchema = z.object(fields).partial().strict().refine(v => Object.keys(v).length > 0, "Provide at least one field to update");
export function pagination(query) {
 const page = Number(query.page ?? 1), limit = Number(query.limit ?? 10);
 if (!Number.isInteger(page) || page < 1) return { error: "page must be a positive integer" };
 if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: "limit must be an integer from 1 to 100" };
 return { page, limit, offset: (page - 1) * limit };
}

const httpUrl = z.string().trim().url().max(500).refine(
  value => /^https?:\/\//i.test(value),
  "URL must begin with http:// or https://"
);
export const applicationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  internshipId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  resumeUrl: httpUrl.optional()
}).strict();
