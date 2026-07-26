const forbiddenKeys = /password|secret|token|content|salary|medical|sin|bank|passport/i;
export function redactAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !forbiddenKeys.test(key))
      .map(([key, item]) => [key, redactAuditMetadata(item)]));
  }
  return typeof value === "string" && value.length > 500 ? `${value.slice(0, 500)}…` : value;
}
