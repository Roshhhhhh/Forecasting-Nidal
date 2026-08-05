import { Router, type IRouter } from "express";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db, forecastsTable, proposalsTable, ownersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/kpis", requireAuth, async (_req, res): Promise<void> => {
  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    draft: sql<number>`count(*) filter (where status = 'draft')::int`,
    pending: sql<number>`count(*) filter (where status in ('submitted', 'review_required', 'changes_requested'))::int`,
    published: sql<number>`count(*) filter (where status = 'published')::int`,
    viewed: sql<number>`count(*) filter (where status = 'viewed')::int`,
    accepted: sql<number>`count(*) filter (where status = 'accepted')::int`,
    grossRevenue: sql<number>`coalesce(sum(gross_annual_revenue), 0)`,
    managementFee: sql<number>`coalesce(sum(gross_annual_revenue * management_fee_percent / 100), 0)`,
    avgIncrease: sql<number>`coalesce(avg(increase_vs_ltr_pct), 0)`,
  }).from(forecastsTable).where(eq(forecastsTable.isArchived, false));

  const expiringSoon = await db.select({ count: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(and(
      eq(proposalsTable.isLinkActive, true),
      lte(proposalsTable.expiresAt, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      gte(proposalsTable.expiresAt, new Date())
    ));

  const published = totals?.published ?? 0;
  const accepted = totals?.accepted ?? 0;

  res.json({
    totalForecasts: totals?.total ?? 0,
    draftForecasts: totals?.draft ?? 0,
    pendingApproval: totals?.pending ?? 0,
    publishedProposals: published,
    viewedProposals: totals?.viewed ?? 0,
    acceptedProposals: accepted,
    conversionRate: published > 0 ? Math.round((accepted / published) * 100) : 0,
    forecastedGrossRevenue: Math.round(totals?.grossRevenue ?? 0),
    forecastedManagementFee: Math.round(totals?.managementFee ?? 0),
    avgIncreaseVsLtr: Math.round(totals?.avgIncrease ?? 0),
    expiringSoon: expiringSoon[0]?.count ?? 0,
  });
});

router.get("/dashboard/recent", requireAuth, async (_req, res): Promise<void> => {
  const forecasts = await db.select().from(forecastsTable)
    .where(eq(forecastsTable.isArchived, false))
    .orderBy(desc(forecastsTable.updatedAt))
    .limit(10);
  res.json(forecasts.map(f => ({
    id: f.id, referenceNumber: f.referenceNumber, status: f.status,
    grossAnnualRevenue: f.grossAnnualRevenue, netOwnerIncome: f.netOwnerIncome,
    netLtrIncome: f.netLtrIncome, increaseVsLtrPct: f.increaseVsLtrPct,
    weightedAdr: f.weightedAdr, recommendedOccupancy: f.recommendedOccupancy,
    createdAt: f.createdAt, updatedAt: f.updatedAt,
  })));
});

router.get("/dashboard/area-performance", requireAuth, async (_req, res): Promise<void> => {
  // Join forecasts with properties to get area data
  const result = await db.execute(sql`
    SELECT 
      p.area,
      count(f.id)::int as forecast_count,
      coalesce(avg(f.gross_annual_revenue), 0) as avg_gross_revenue,
      coalesce(avg(f.net_owner_income), 0) as avg_net_income,
      coalesce(avg(f.recommended_occupancy), 0) as avg_occupancy,
      coalesce(avg(f.weighted_adr), 0) as avg_adr
    FROM forecasts f
    JOIN properties p ON f.property_id = p.id
    WHERE f.is_archived = false AND p.area IS NOT NULL
    GROUP BY p.area
    ORDER BY avg_gross_revenue DESC
    LIMIT 10
  `);
  res.json((result as any[]).map((r: any) => ({
    area: r.area,
    forecastCount: r.forecast_count,
    avgGrossRevenue: Math.round(r.avg_gross_revenue),
    avgNetIncome: Math.round(r.avg_net_income),
    avgOccupancy: Math.round(r.avg_occupancy * 100) / 100,
    avgAdr: Math.round(r.avg_adr),
  })));
});

router.get("/dashboard/conversion", requireAuth, async (_req, res): Promise<void> => {
  const [counts] = await db.select({
    published: sql<number>`count(*) filter (where status = 'published')::int`,
    viewed: sql<number>`count(*) filter (where status = 'viewed')::int`,
    ownerCalled: sql<number>`count(*) filter (where status = 'owner_called')::int`,
    accepted: sql<number>`count(*) filter (where status = 'accepted')::int`,
    declined: sql<number>`count(*) filter (where status = 'declined')::int`,
    pending: sql<number>`count(*) filter (where status in ('published', 'viewed'))::int`,
  }).from(forecastsTable).where(eq(forecastsTable.isArchived, false));

  res.json({
    published: counts?.published ?? 0,
    viewed: counts?.viewed ?? 0,
    ownerCalled: counts?.ownerCalled ?? 0,
    accepted: counts?.accepted ?? 0,
    declined: counts?.declined ?? 0,
    pending: counts?.pending ?? 0,
  });
});

export default router;
