import { Router } from "express";
import { db, companiesTable, insertCompanySchema } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(companiesTable).orderBy(companiesTable.name);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const parsed = insertCompanySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const rows = await db.insert(companiesTable).values(parsed.data).returning();
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
