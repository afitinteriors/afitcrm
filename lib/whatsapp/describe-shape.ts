/**
 * Reduces an arbitrary JSON value to its structure only — key names,
 * nesting, and value *types* — never the actual values. Used for one-time
 * webhook payload discovery so we can learn a third-party sender's field
 * names without ever logging phone numbers, names, or message content.
 */
export function describeShape(value: unknown): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, items: value.length > 0 ? describeShape(value[0]) : "unknown" };
  }
  if (typeof value === "object") {
    const shape: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      shape[key] = describeShape((value as Record<string, unknown>)[key]);
    }
    return shape;
  }
  return typeof value; // "string" | "number" | "boolean" | "undefined"
}
