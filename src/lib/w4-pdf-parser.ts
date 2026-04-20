/**
 * W-4 PDF Field Parser
 *
 * Reads IRS Form W-4 fillable PDF (AcroForm) field values and maps
 * them to our W4Data type. Supports the 2020+ W-4 revision.
 *
 * The IRS W-4 PDF uses AcroForm fields with specific names. This
 * parser reads those fields from an uploaded PDF using pdf-lib,
 * extracts the values, and returns structured data for the tax engine.
 *
 * If the PDF isn't a fillable form (e.g. a scanned copy), the parser
 * returns null and the worker can fall back to manual entry.
 *
 * Runs entirely in the browser — no server processing.
 */

import { PDFDocument } from "pdf-lib";
import type { W4Data } from "@/src/stores/w4_store";
import type { FilingStatus } from "@/src/lib/tax-engine";

// ---------------------------------------------------------------------------
// IRS W-4 field name patterns
//
// The official IRS W-4 fillable PDF uses AcroForm field names. These
// vary slightly between tax years but follow a consistent pattern.
// We try multiple known patterns to maximize compatibility.
// ---------------------------------------------------------------------------

/** Try to find a field value by checking multiple possible field names */
function findField(
  fields: Map<string, string>,
  candidates: string[],
): string | undefined {
  for (const name of candidates) {
    const val = fields.get(name);
    if (val !== undefined && val !== "") return val;
    // Also try case-insensitive
    for (const [key, v] of fields) {
      if (key.toLowerCase().includes(name.toLowerCase()) && v) return v;
    }
  }
  return undefined;
}

/** Check if a checkbox/radio field indicates "checked" */
function isChecked(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  return v === "yes" || v === "on" || v === "true" || v === "1" || v === "/yes" || v === "x";
}

/** Parse a dollar amount string, stripping $, commas, etc. */
function parseDollar(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export type W4ParseResult = {
  /** Whether parsing succeeded (form fields were found) */
  success: boolean;
  /** Extracted W-4 data (null if parsing failed) */
  data: W4Data | null;
  /** Raw field dump for debugging */
  rawFields: Record<string, string>;
  /** Number of form fields found in the PDF */
  fieldCount: number;
  /** Human-readable parse notes */
  notes: string[];
};

/**
 * Parse a W-4 PDF file and extract form field values.
 *
 * @param pdfBytes — the raw PDF file bytes (from FileReader.readAsArrayBuffer)
 * @returns parsed W-4 data or null if the PDF isn't a fillable form
 */
export async function parseW4Pdf(
  pdfBytes: ArrayBuffer,
): Promise<W4ParseResult> {
  const notes: string[] = [];

  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const form = pdfDoc.getForm();
    const pdfFields = form.getFields();

    if (pdfFields.length === 0) {
      return {
        success: false,
        data: null,
        rawFields: {},
        fieldCount: 0,
        notes: ["No form fields found. This may be a scanned or non-fillable PDF."],
      };
    }

    // Dump all fields into a map for lookup
    const fields = new Map<string, string>();
    const rawFields: Record<string, string> = {};

    for (const field of pdfFields) {
      const name = field.getName();
      let value = "";

      try {
        // Different field types have different value accessors
        if ("getText" in field && typeof (field as any).getText === "function") {
          value = (field as any).getText() ?? "";
        } else if ("isChecked" in field && typeof (field as any).isChecked === "function") {
          value = (field as any).isChecked() ? "Yes" : "No";
        } else if ("getSelected" in field && typeof (field as any).getSelected === "function") {
          const selected = (field as any).getSelected();
          value = Array.isArray(selected) ? selected.join(", ") : String(selected ?? "");
        }
      } catch {
        // Some fields may not be readable — skip
      }

      fields.set(name, value);
      rawFields[name] = value;
    }

    notes.push(`Found ${pdfFields.length} form fields`);

    // --- Extract filing status ---
    let filingStatus: FilingStatus = "single";

    // Try common W-4 field name patterns for filing status
    const singleChecked = isChecked(
      findField(fields, ["c1_1", "Single", "Filing Status Single", "step1_single"]),
    );
    const mfjChecked = isChecked(
      findField(fields, ["c1_2", "Married", "Filing Status MFJ", "step1_mfj", "Married filing jointly"]),
    );
    const hohChecked = isChecked(
      findField(fields, ["c1_3", "HOH", "Head of household", "step1_hoh"]),
    );

    if (mfjChecked) {
      filingStatus = "married_filing_jointly";
      notes.push("Filing status: Married Filing Jointly");
    } else if (hohChecked) {
      filingStatus = "head_of_household";
      notes.push("Filing status: Head of Household");
    } else {
      notes.push("Filing status: Single (default)");
    }

    // --- Step 2: Multiple jobs ---
    const multipleJobs = isChecked(
      findField(fields, ["c2_1", "Step 2 checkbox", "step2", "Multiple Jobs"]),
    );

    // --- Step 3: Dependents ---
    const childrenAmount = parseDollar(
      findField(fields, ["f3_1", "Step 3 Line 1", "step3_children", "Qualifying children"]),
    );
    const otherDepsAmount = parseDollar(
      findField(fields, ["f3_2", "Step 3 Line 2", "step3_other", "Other dependents"]),
    );
    const totalDependentCredit = parseDollar(
      findField(fields, ["f3_3", "Step 3 Total", "step3_total"]),
    );

    // Derive counts from dollar amounts (children = amount / 2000, other = amount / 500)
    const qualifyingChildren = childrenAmount > 0 ? Math.round(childrenAmount / 2000) : 0;
    const otherDependents = otherDepsAmount > 0 ? Math.round(otherDepsAmount / 500) : 0;

    if (qualifyingChildren > 0 || otherDependents > 0) {
      notes.push(
        `Dependents: ${qualifyingChildren} children ($${childrenAmount}), ${otherDependents} other ($${otherDepsAmount})`,
      );
    }

    // --- Step 4: Other adjustments ---
    const otherIncome = parseDollar(
      findField(fields, ["f4a", "Step 4a", "step4a", "Other income"]),
    );
    const extraDeductions = parseDollar(
      findField(fields, ["f4b", "Step 4b", "step4b", "Deductions"]),
    );
    const extraWithholding = parseDollar(
      findField(fields, ["f4c", "Step 4c", "step4c", "Extra withholding"]),
    );

    if (otherIncome > 0) notes.push(`Other income: $${otherIncome}`);
    if (extraDeductions > 0) notes.push(`Extra deductions: $${extraDeductions}`);
    if (extraWithholding > 0) notes.push(`Extra withholding: $${extraWithholding}/period`);

    const data: W4Data = {
      filingStatus,
      multipleJobsOrSpouseWorks: multipleJobs,
      qualifyingChildren,
      otherDependents,
      totalDependentCredit:
        totalDependentCredit > 0
          ? totalDependentCredit
          : qualifyingChildren * 2000 + otherDependents * 500,
      otherIncome,
      extraDeductions,
      extraWithholding,
      updatedAt: Date.now(),
      completed: true,
    };

    return {
      success: true,
      data,
      rawFields,
      fieldCount: pdfFields.length,
      notes,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      rawFields: {},
      fieldCount: 0,
      notes: [
        `PDF parsing failed: ${err instanceof Error ? err.message : String(err)}`,
        "Try downloading a fresh copy of the IRS W-4 from irs.gov.",
      ],
    };
  }
}
