"use client";

/**
 * Worker W-4 Form — tax withholding elections.
 *
 * Mirrors the IRS Form W-4 (2020+ revision). Workers must complete
 * this before receiving payroll. The data feeds into the employer's
 * tax engine to auto-compute per-period withholding based on the
 * worker's filing status, dependents, and adjustments.
 *
 * All data stays in localStorage keyed by wallet address. Never
 * transmitted unencrypted.
 */

import { useEffect, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useW4Store, type W4Data } from "@/src/stores/w4_store";
import type { FilingStatus } from "@/src/lib/tax-engine";

const FILING_OPTIONS: { value: FilingStatus; label: string; desc: string }[] = [
  { value: "single", label: "Single", desc: "or Married filing separately" },
  { value: "married_filing_jointly", label: "Married Filing Jointly", desc: "or Qualifying surviving spouse" },
  { value: "head_of_household", label: "Head of Household", desc: "Check only if you're unmarried and pay more than half the costs of keeping up a home for yourself and a qualifying individual" },
];

export default function WorkerW4Page() {
  const { address } = useAleoSession();
  const { w4, initForWallet, updateW4, submitW4, reset } = useW4Store();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (address) initForWallet(address);
  }, [address, initForWallet]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitW4();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const dependentCredit =
    w4.qualifyingChildren * 2000 + w4.otherDependents * 500;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Form W-4 — Tax Withholding
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete this form so your employer can withhold the correct federal
          income tax from your pay. This mirrors the IRS Form W-4.
        </p>
        {w4.completed && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">
            W-4 on file — last updated{" "}
            {new Date(w4.updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Filing Status */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 1: Filing Status
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the statement that best describes your situation.
          </p>
          <div className="mt-4 space-y-3">
            {FILING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  w4.filingStatus === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="filing_status"
                  value={opt.value}
                  checked={w4.filingStatus === opt.value}
                  onChange={() => updateW4({ filingStatus: opt.value })}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {opt.label}
                  </span>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Step 2: Multiple Jobs */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 2: Multiple Jobs or Spouse Works
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete this step if you (1) hold more than one job at a time, or
            (2) are married filing jointly and your spouse also works.
          </p>
          <label className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={w4.multipleJobsOrSpouseWorks}
              onChange={(e) =>
                updateW4({ multipleJobsOrSpouseWorks: e.target.checked })
              }
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">
              I have more than one job, or my spouse also works
            </span>
          </label>
        </div>

        {/* Step 3: Dependents */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 3: Claim Dependents
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            If your total income will be $200,000 or less ($400,000 or less if
            married filing jointly), you can claim dependent credits.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Qualifying children under 17
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={w4.qualifyingChildren}
                  onChange={(e) =>
                    updateW4({
                      qualifyingChildren: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">
                  × $2,000 = ${(w4.qualifyingChildren * 2000).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Other dependents
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={w4.otherDependents}
                  onChange={(e) =>
                    updateW4({
                      otherDependents: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">
                  × $500 = ${(w4.otherDependents * 500).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">
              Total dependent credit: ${dependentCredit.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              This amount reduces your annual federal income tax withholding.
            </p>
          </div>
        </div>

        {/* Step 4: Other Adjustments */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Step 4: Other Adjustments (optional)
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                4(a) Other income (not from jobs) — annual amount
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={w4.otherIncome || ""}
                  onChange={(e) =>
                    updateW4({ otherIncome: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  placeholder="0"
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Interest, dividends, retirement income — added to your projected annual income.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                4(b) Deductions beyond standard deduction — annual amount
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={w4.extraDeductions || ""}
                  onChange={(e) =>
                    updateW4({ extraDeductions: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  placeholder="0"
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only if you plan to itemize deductions or claim adjustments to income.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                4(c) Extra withholding per pay period
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={w4.extraWithholding || ""}
                  onChange={(e) =>
                    updateW4({ extraWithholding: Math.max(0, parseFloat(e.target.value) || 0) })
                  }
                  placeholder="0"
                  className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Additional amount you want withheld each pay period.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {w4.completed ? "Update W-4" : "Submit W-4"}
          </button>
          {w4.completed && (
            <button
              type="button"
              onClick={() => {
                reset();
                setSaved(false);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Reset
            </button>
          )}
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              W-4 saved successfully
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Your W-4 data is stored locally in your browser and shared with your
          employer only through the encrypted agreement channel. It is never
          stored on the blockchain or any server in plaintext.
        </p>
      </form>
    </div>
  );
}
