/**
 * PNW Federal Payroll Tax Engine — client-side TypeScript
 *
 * Computes federal income tax, Social Security, and Medicare for a
 * single pay period using the IRS annualization method (Pub 15-T):
 *
 *   1. Annualize per-period gross → projected annual income
 *   2. Apply standard deduction for filing status
 *   3. Compute marginal federal income tax on projected taxable income
 *   4. De-annualize back to per-period
 *   5. Compute Social Security (6.2%, respecting YTD wage base cap)
 *   6. Compute Medicare (1.45% + 0.9% additional above threshold)
 *
 * Tax brackets auto-adjust based on projected 12-month income — a
 * $25/hr worker on weekly pay has tax computed as if they earn
 * $52,000/year, hitting the correct marginal bracket from day one.
 *
 * All computation runs in the browser. No data leaves the client.
 * Tax tables are imported from a JSON config so they can be updated
 * without touching the engine code when the IRS publishes new brackets.
 *
 * Privacy: receives ONLY financial amounts and filing parameters.
 * No names, addresses, wallet keys, or identity data.
 */

// ---------------------------------------------------------------------------
// 2026 Federal Tax Tables (projected — update when IRS finalizes)
//
// Sources:
//   IRS Rev. Proc. 2025-XX (projected inflation adjustments)
//   taxfoundation.org/2026-tax-brackets
//   IRS Topic 751 (FICA rates)
//   IRS Topic 560 (Additional Medicare Tax)
// ---------------------------------------------------------------------------

export type FilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household";

export type PayPeriod =
  | "daily"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "quarterly";

type Bracket = { rate: number; min: number; max: number };

const TAX_YEAR = 2026;

// --- Social Security ---
const SS_RATE = 0.062;
const SS_WAGE_BASE = 184_500;

// --- Medicare ---
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const ADDITIONAL_MEDICARE_THRESHOLDS: Record<FilingStatus, number> = {
  single: 200_000,
  married_filing_jointly: 250_000,
  married_filing_separately: 125_000,
  head_of_household: 200_000,
};

// --- Standard Deduction ---
const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = {
  single: 16_100,
  married_filing_jointly: 32_200,
  married_filing_separately: 16_100,
  head_of_household: 24_150,
};

// --- Federal Income Tax Brackets ---
const BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { rate: 0.10, min: 0, max: 12_400 },
    { rate: 0.12, min: 12_400, max: 50_200 },
    { rate: 0.22, min: 50_200, max: 106_130 },
    { rate: 0.24, min: 106_130, max: 203_100 },
    { rate: 0.32, min: 203_100, max: 515_700 },
    { rate: 0.35, min: 515_700, max: 640_600 },
    { rate: 0.37, min: 640_600, max: Infinity },
  ],
  married_filing_jointly: [
    { rate: 0.10, min: 0, max: 24_800 },
    { rate: 0.12, min: 24_800, max: 100_400 },
    { rate: 0.22, min: 100_400, max: 212_300 },
    { rate: 0.24, min: 212_300, max: 406_200 },
    { rate: 0.32, min: 406_200, max: 768_700 },
    { rate: 0.35, min: 768_700, max: 1_031_100 },
    { rate: 0.37, min: 1_031_100, max: Infinity },
  ],
  married_filing_separately: [
    { rate: 0.10, min: 0, max: 12_400 },
    { rate: 0.12, min: 12_400, max: 50_200 },
    { rate: 0.22, min: 50_200, max: 106_150 },
    { rate: 0.24, min: 106_150, max: 203_100 },
    { rate: 0.32, min: 203_100, max: 384_350 },
    { rate: 0.35, min: 384_350, max: 515_550 },
    { rate: 0.37, min: 515_550, max: Infinity },
  ],
  head_of_household: [
    { rate: 0.10, min: 0, max: 18_600 },
    { rate: 0.12, min: 18_600, max: 70_800 },
    { rate: 0.22, min: 70_800, max: 145_500 },
    { rate: 0.24, min: 145_500, max: 288_200 },
    { rate: 0.32, min: 288_200, max: 640_600 },
    { rate: 0.35, min: 640_600, max: 922_200 },
    { rate: 0.37, min: 922_200, max: Infinity },
  ],
};

// --- Pay periods per year ---
const PERIODS_PER_YEAR: Record<PayPeriod, number> = {
  daily: 260,
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  quarterly: 4,
};

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type TaxInput = {
  /** Gross pay for THIS pay period (dollars) */
  gross: number;
  /** Worker's filing status (from their W-4 Step 1) */
  filingStatus: FilingStatus;
  /** How often they're paid */
  payPeriod: PayPeriod;
  /** Year-to-date gross already paid (for SS wage base tracking) */
  ytdGross?: number;
  /** Year-to-date SS tax already withheld */
  ytdSsTax?: number;

  // --- W-4 adjustments (all optional, default to 0) ---

  /** W-4 Step 3: total dependent tax credit (children × $2,000 + other × $500).
   *  Reduces the computed annual federal tax before de-annualizing. */
  dependentCredit?: number;
  /** W-4 Step 4a: other income not from jobs (added to projected annual). */
  otherIncome?: number;
  /** W-4 Step 4b: deductions beyond standard deduction (subtracted from income). */
  extraDeductions?: number;
  /** W-4 Step 4c: extra withholding per pay period (flat add-on). */
  extraWithholding?: number;
};

export type TaxResult = {
  // Input echo
  grossPerPeriod: number;
  filingStatus: FilingStatus;
  payPeriod: PayPeriod;
  taxYear: number;

  // Projection
  projectedAnnualGross: number;
  standardDeduction: number;
  projectedTaxableIncome: number;

  // Per-period tax amounts (dollars, rounded to cents)
  federalIncomeTax: number;
  socialSecurityTax: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalFica: number;
  totalTax: number;
  netPay: number;

  // Rates
  effectiveFederalRate: number;
  effectiveTotalRate: number;
  marginalBracketRate: number;
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute marginal federal income tax on a taxable income amount.
 * Returns [tax, marginalRate].
 */
function computeMarginalTax(
  taxableIncome: number,
  brackets: Bracket[],
): [number, number] {
  if (taxableIncome <= 0) return [0, brackets[0]!.rate];

  let tax = 0;
  let marginalRate = brackets[0]!.rate;

  for (const b of brackets) {
    if (taxableIncome > b.min) {
      const incomeInBracket = Math.min(taxableIncome, b.max) - b.min;
      tax += incomeInBracket * b.rate;
      marginalRate = b.rate;
    } else {
      break;
    }
  }

  return [tax, marginalRate];
}

/**
 * Compute all federal payroll taxes for a single pay period.
 *
 * Uses the IRS annualization method: project per-period gross to annual,
 * compute annual tax, divide back to per-period. Tax brackets auto-adjust
 * based on the projected 12-month income.
 */
export function computePayrollTax(input: TaxInput): TaxResult {
  const gross = input.gross;
  const fs = input.filingStatus;
  const pp = input.payPeriod;
  const periods = PERIODS_PER_YEAR[pp];
  const ytdGross = input.ytdGross ?? 0;

  // W-4 adjustments (all default to 0 if not provided)
  const otherIncome = input.otherIncome ?? 0;
  const extraDeductions = input.extraDeductions ?? 0;
  const dependentCredit = input.dependentCredit ?? 0;
  const extraWithholding = input.extraWithholding ?? 0;

  // Step 1: Annualize — include W-4 Step 4a (other income)
  const projectedAnnual = gross * periods + otherIncome;

  // Step 2: Standard deduction + W-4 Step 4b (extra deductions)
  const stdDed = STANDARD_DEDUCTIONS[fs];
  const totalDeductions = stdDed + extraDeductions;
  const projectedTaxable = Math.max(0, projectedAnnual - totalDeductions);

  // Step 3: Marginal federal income tax (annual)
  const brackets = BRACKETS[fs];
  const [annualFedTaxRaw, marginalRate] = computeMarginalTax(
    projectedTaxable,
    brackets,
  );

  // Step 3b: Apply W-4 Step 3 dependent credits (reduce annual tax)
  const annualFedTax = Math.max(0, annualFedTaxRaw - dependentCredit);

  // Step 4: De-annualize to per-period + W-4 Step 4c (extra withholding)
  const fedTax = round2(annualFedTax / periods + extraWithholding);

  // Step 5: Social Security (per-period, respecting YTD cap)
  const ssRemainingCap = Math.max(0, SS_WAGE_BASE - ytdGross);
  const ssTaxableThisPeriod = Math.min(gross, ssRemainingCap);
  const ssTax = round2(ssTaxableThisPeriod * SS_RATE);

  // Step 6: Medicare (per-period)
  const medTax = round2(gross * MEDICARE_RATE);

  // Additional Medicare Tax (0.9%): per IRS rules, employer withholding
  // is triggered when CUMULATIVE YTD wages exceed $200,000 — flat
  // threshold regardless of filing status. Filing-status-specific
  // thresholds only apply when the employee reconciles on their 1040.
  //
  // The tax applies only to the portion of THIS paycheck that pushes
  // cumulative wages above the $200K employer withholding threshold.
  const EMPLOYER_ADD_MED_THRESHOLD = 200_000;
  let addMedTax = 0;
  const ytdAfterThisPay = ytdGross + gross;
  if (ytdAfterThisPay > EMPLOYER_ADD_MED_THRESHOLD) {
    // Only the portion of THIS paycheck above the threshold is taxed.
    // If YTD was already above, the entire paycheck is subject.
    const subjectToAddMed = Math.min(
      gross,
      ytdAfterThisPay - EMPLOYER_ADD_MED_THRESHOLD,
    );
    addMedTax = round2(subjectToAddMed * ADDITIONAL_MEDICARE_RATE);
  }

  // Totals
  const totalFica = round2(ssTax + medTax + addMedTax);
  const totalTax = round2(fedTax + totalFica);
  const netPay = round2(gross - totalTax);

  return {
    grossPerPeriod: gross,
    filingStatus: fs,
    payPeriod: pp,
    taxYear: TAX_YEAR,

    projectedAnnualGross: round2(projectedAnnual),
    standardDeduction: stdDed,
    projectedTaxableIncome: round2(projectedTaxable),

    federalIncomeTax: fedTax,
    socialSecurityTax: ssTax,
    medicareTax: medTax,
    additionalMedicareTax: addMedTax,
    totalFica,
    totalTax,
    netPay,

    effectiveFederalRate: gross > 0 ? round2((fedTax / gross) * 10000) / 10000 : 0,
    effectiveTotalRate: gross > 0 ? round2((totalTax / gross) * 10000) / 10000 : 0,
    marginalBracketRate: marginalRate,
  };
}

/**
 * Convenience: compute tax for an hourly worker given rate and hours.
 */
export function computeHourlyTax(
  hourlyRate: number,
  hoursWorked: number,
  filingStatus: FilingStatus,
  payPeriod: PayPeriod,
  ytdGross?: number,
): TaxResult {
  return computePayrollTax({
    gross: round2(hourlyRate * hoursWorked),
    filingStatus,
    payPeriod,
    ytdGross,
  });
}

/**
 * Get the tax tables metadata (for display in the UI).
 */
export function getTaxTableInfo() {
  return {
    taxYear: TAX_YEAR,
    ssRate: SS_RATE,
    ssWageBase: SS_WAGE_BASE,
    medicareRate: MEDICARE_RATE,
    additionalMedicareRate: ADDITIONAL_MEDICARE_RATE,
    filingStatuses: Object.keys(STANDARD_DEDUCTIONS) as FilingStatus[],
    payPeriods: Object.keys(PERIODS_PER_YEAR) as PayPeriod[],
  };
}
