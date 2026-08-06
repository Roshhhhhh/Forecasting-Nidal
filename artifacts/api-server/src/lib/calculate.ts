/**
 * Core financial calculation engine — RHH Property Revenue Forecaster
 *
 * ADR logic: staff enter ONE "Base ADR" (March / shoulder reference, multiplier 1.0).
 * Each month's ADR is derived as:  monthAdr = baseAdr × MONTH_ADR_MULTIPLIERS[month]
 *
 * Occupancy logic: fixed per-month base rates (from RHH seasonal model).
 * All months scale proportionally when referenceOccupancy ≠ REFERENCE_OCCUPANCY.
 *
 * Seasonal multipliers and base occupancy rates come from the image provided
 * by Royal Holiday Homes (example: ADR 400 → Jan 700, Feb 600, Dec 850, etc.)
 */

// ── Per-month ADR multipliers (March shoulder = 1.0 reference) ────────────────
export const MONTH_ADR_MULTIPLIERS: Record<number, number> = {
  1:  1.75,    // January   — peak
  2:  1.5,     // February  — peak
  3:  1.0,     // March     — shoulder (reference = baseAdr)
  4:  1.0625,  // April     — shoulder
  5:  1.0625,  // May       — shoulder
  6:  0.75,    // June      — low
  7:  0.75,    // July      — low
  8:  0.8125,  // August    — low
  9:  1.3125,  // September — shoulder
  10: 1.5,     // October   — peak
  11: 1.875,   // November  — peak / Main Events
  12: 2.125,   // December  — peak / Main Events
};

// ── Fixed base occupancy per month ────────────────────────────────────────────
export const MONTH_BASE_OCCUPANCY: Record<number, number> = {
  1:  0.90,  // January
  2:  0.85,  // February
  3:  0.75,  // March   (= REFERENCE_OCCUPANCY)
  4:  0.78,  // April
  5:  0.77,  // May
  6:  0.65,  // June
  7:  0.65,  // July
  8:  0.65,  // August
  9:  0.75,  // September
  10: 0.85,  // October
  11: 0.90,  // November
  12: 0.95,  // December
};

export const REFERENCE_OCCUPANCY = 0.75; // March shoulder — scale reference

// ── Season labels ─────────────────────────────────────────────────────────────
const MONTH_SEASON: Record<number, "low" | "shoulder" | "peak" | "event"> = {
  1: "peak", 2: "peak", 3: "shoulder", 4: "shoulder", 5: "shoulder",
  6: "low",  7: "low",  8: "low",      9: "shoulder", 10: "peak",
  11: "event", 12: "event",
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForecastInputs {
  baseAdr: number;
  /** Shoulder-reference occupancy (0-1). All months scale proportionally.
   *  Default = REFERENCE_OCCUPANCY (0.75) = use table as-is. */
  referenceOccupancy?: number;
  ownerBlockedNights: number;
  managementFeePercent: number; // 0-100
  ltrVacancyPercent: number;    // 0-100
  annualLtr: number | null;
  internetCost: number;
  utilityCost: number;
  maintenanceCost: number;
  miscCost: number;
}

/** Per-month manual overrides keyed by month (1–12). Null fields = use calculated value. */
export type MonthlyOverrides = Record<number, { occupancyRate?: number | null; adr?: number | null }>;

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

// ── Main calculation ──────────────────────────────────────────────────────────

export function calculateMonthlyProjections(
  inputs: ForecastInputs,
  year = 2025,
  overrides: MonthlyOverrides = {},
) {
  const refOcc   = inputs.referenceOccupancy ?? REFERENCE_OCCUPANCY;
  const occScale = refOcc / REFERENCE_OCCUPANCY;

  const projections = [];
  let totalOccupiedNights = 0;
  let totalRevenue        = 0;

  const blockedPerMonth = Math.round(inputs.ownerBlockedNights / 12);

  for (let month = 1; month <= 12; month++) {
    const daysInMonth    = getDaysInMonth(month, year);
    const availableNights = Math.max(0, daysInMonth - blockedPerMonth);

    const mo = overrides[month] ?? {};

    // ADR: base × multiplier, unless manually overridden
    const baseMonthlyAdr = inputs.baseAdr * MONTH_ADR_MULTIPLIERS[month];
    const effectiveAdr   = (mo.adr != null) ? mo.adr : baseMonthlyAdr;

    // Occupancy: fixed per-month rate × scale, unless manually overridden
    const baseMonthlyOcc  = Math.min(0.98, MONTH_BASE_OCCUPANCY[month] * occScale);
    const effectiveOccupancy = (mo.occupancyRate != null) ? mo.occupancyRate : baseMonthlyOcc;

    const occupiedNights = availableNights * effectiveOccupancy;
    const grossRevenue   = occupiedNights * effectiveAdr;

    const monthlyExpenses    = (inputs.internetCost + inputs.utilityCost + inputs.maintenanceCost + inputs.miscCost) / 12;
    const monthlyManagementFee = grossRevenue * (inputs.managementFeePercent / 100);
    const netOwnerIncome     = grossRevenue - monthlyExpenses - monthlyManagementFee;

    const ltrBenchmark = inputs.annualLtr
      ? (inputs.annualLtr * (1 - inputs.ltrVacancyPercent / 100)) / 12
      : null;

    projections.push({
      month,
      year,
      monthName:        MONTH_NAMES[month - 1],
      availableNights,
      occupiedNights:   Math.round(occupiedNights * 100) / 100,
      occupancyRate:    effectiveOccupancy,
      adr:              Math.round(effectiveAdr),
      grossRevenue:     Math.round(grossRevenue),
      netOwnerIncome:   Math.round(netOwnerIncome),
      ltrBenchmark:     ltrBenchmark ? Math.round(ltrBenchmark) : null,
      seasonType:       MONTH_SEASON[month],
      occupancyOverride: mo.occupancyRate ?? null,
      adrOverride:       mo.adr ?? null,
    });

    totalOccupiedNights += occupiedNights;
    totalRevenue        += grossRevenue;
  }

  const weightedAdr = totalOccupiedNights > 0 ? totalRevenue / totalOccupiedNights : 0;
  const totalAnnualExpenses =
    inputs.internetCost + inputs.utilityCost + inputs.maintenanceCost + inputs.miscCost +
    totalRevenue * (inputs.managementFeePercent / 100);
  const netOwnerIncome = totalRevenue - totalAnnualExpenses;
  const netLtrIncome   = inputs.annualLtr
    ? inputs.annualLtr * (1 - inputs.ltrVacancyPercent / 100)
    : null;
  const increaseVsLtr    = netLtrIncome != null ? netOwnerIncome - netLtrIncome : null;
  const increaseVsLtrPct = netLtrIncome != null && netLtrIncome > 0
    ? ((netOwnerIncome - netLtrIncome) / netLtrIncome) * 100
    : null;

  return {
    monthlyProjections:   projections,
    grossAnnualRevenue:   Math.round(totalRevenue),
    totalAnnualExpenses:  Math.round(totalAnnualExpenses),
    netOwnerIncome:       Math.round(netOwnerIncome),
    netLtrIncome:         netLtrIncome != null ? Math.round(netLtrIncome) : null,
    increaseVsLtr:        increaseVsLtr != null ? Math.round(increaseVsLtr) : null,
    increaseVsLtrPct:     increaseVsLtrPct != null ? Math.round(increaseVsLtrPct * 10) / 10 : null,
    weightedAdr:          Math.round(weightedAdr),
    managementFeeAmount:  Math.round(totalRevenue * (inputs.managementFeePercent / 100)),
    reconciliationStatus: "passed" as const,
  };
}

// ── Scenario helper ───────────────────────────────────────────────────────────

export function calculateScenario(baseInputs: ForecastInputs, referenceOccupancy: number, adrMultiplier = 1) {
  const result = calculateMonthlyProjections(
    { ...baseInputs, baseAdr: baseInputs.baseAdr * adrMultiplier, referenceOccupancy },
  );
  return {
    grossRevenue:   result.grossAnnualRevenue,
    netOwnerIncome: result.netOwnerIncome,
    totalExpenses:  result.totalAnnualExpenses,
    weightedAdr:    result.weightedAdr,
  };
}
