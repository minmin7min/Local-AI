import { z } from "zod";

const rowSchema = z.object({
  internalEmployeeId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(160),
  workEmail: z.string().trim().email().max(254),
  department: z.string().trim().min(1).max(120),
  position: z.string().trim().min(1).max(120),
  employmentStatus: z.enum(["active", "leave", "ended"]),
  employmentCategory: z.enum(["full_time", "part_time", "contract", "temporary"]),
  startDate: z.iso.date(),
  contractExpirationDate: z.iso.date().optional(),
});
export type EmployeeImportRow = z.infer<typeof rowSchema>;
export interface RowResult { rowNumber: number; value?: EmployeeImportRow; errors: string[] }
export function validateRows(rows: readonly Record<string, unknown>[]): RowResult[] {
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const parsed = rowSchema.safeParse(row);
    if (!parsed.success) return { rowNumber: index + 2, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    const key = parsed.data.internalEmployeeId.toLowerCase();
    if (seen.has(key)) return { rowNumber: index + 2, errors: ["Duplicate internal employee ID in file"] };
    seen.add(key);
    return { rowNumber: index + 2, value: parsed.data, errors: [] };
  });
}
export function neutralizeSpreadsheetFormula(value: unknown): unknown {
  return typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value;
}
