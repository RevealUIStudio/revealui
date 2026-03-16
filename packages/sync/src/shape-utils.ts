/**
 * Cast ElectricSQL shape data to a typed record array.
 *
 * ElectricSQL's `useShape` returns `Row[]` (i.e. `Record<string, Value>[]`).
 * Our record interfaces describe the exact same shape but lack the index
 * signature that `Row` carries, so TypeScript rejects a direct assignment.
 * This helper encapsulates the boundary cast in one place and returns an
 * empty array when data is falsy.
 */
export function toRecords<T>(data: unknown[] | undefined): T[] {
  if (!Array.isArray(data)) return [];
  return data as T[];
}
