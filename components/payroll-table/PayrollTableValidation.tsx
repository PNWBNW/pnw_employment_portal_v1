"use client";

import type { RowValidationResult } from "./types";

type Props = {
  validationResults: RowValidationResult[];
  showAll?: boolean;
};

/**
 * Displays validation errors for the payroll table.
 * Shows a summary of errors per row. Only visible when there are errors.
 */
export function PayrollTableValidation({
  validationResults,
  showAll = false,
}: Props) {
  const errorRows = validationResults
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => !result.valid);

  if (errorRows.length === 0) return null;

  const displayed = showAll ? errorRows : errorRows.slice(0, 5);
  const hasMore = !showAll && errorRows.length > 5;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
      <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
        Validation Errors ({errorRows.length} row
        {errorRows.length !== 1 ? "s" : ""})
      </h3>
      <ul className="mt-2 space-y-1">
        {displayed.map(({ result, index }) => (
          <li key={index} className="text-xs text-red-700 dark:text-red-400">
            <span className="font-medium">Row {index + 1}:</span>{" "}
            {result.errors.map((e) => e.message).join("; ")}
          </li>
        ))}
        {hasMore && (
          <li className="text-xs text-red-600 dark:text-red-500">
            ...and {errorRows.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}
