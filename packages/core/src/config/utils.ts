export function deepMerge<T extends object>(target: Partial<T>, source: T): T {
  const result = { ...target } as T;
  for (const key of Object.keys(source) as (keyof T)[]) {
    // Guard against prototype pollution via __proto__, constructor, or prototype keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (!Object.hasOwn(source, key)) continue;
    const s = source[key];
    const t = (target as T)[key];
    if (Array.isArray(s)) {
      result[key] = s as T[keyof T];
    } else if (
      s !== null &&
      typeof s === 'object' &&
      t !== null &&
      typeof t === 'object' &&
      !Array.isArray(t)
    ) {
      result[key] = deepMerge(
        t as Partial<T[keyof T] & object>,
        s as T[keyof T] & object,
      ) as T[keyof T];
    } else {
      result[key] = s;
    }
  }
  return result;
}
