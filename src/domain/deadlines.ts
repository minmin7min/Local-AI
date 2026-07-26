export type Window = "overdue" | "30" | "60" | "90" | "later";
export function deadlineWindow(due: Date, now: Date): Window {
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return "later";
}
export function reminderKey(tenantId: string, deadlineId: string, window: Exclude<Window, "later">): string {
  return `${tenantId}:deadline:${deadlineId}:${window}`;
}
