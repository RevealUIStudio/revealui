/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Deep merge two objects.
 * @param target
 * @param source
 */
export default function deepMerge<
  T extends Record<string, unknown>,
  R extends Record<string, unknown>,
>(target: T, source: R): T {
  const output = { ...target }; // Creates a shallow copy of the target

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (isObject(sourceValue)) {
        if (!(key in target)) {
          // If the key is not present in the target, assign the source value
          (output as Record<string, unknown>)[key] = sourceValue;
        } else {
          // Recursively merge if the value is an object in both source and target
          (output as Record<string, unknown>)[key] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>,
          );
        }
      } else {
        // If it's not an object, directly assign the source value to the output
        (output as Record<string, unknown>)[key] = sourceValue;
      }
    });
  }

  return output;
}

// /**
//  * Simple object check.
//  * @param item
//  * @returns {boolean}
//  */
// export function isObject(item: unknown): boolean {
//   return item && typeof item === "object" && !Array.isArray(item);
// }

// /**
//  * Deep merge two objects.
//  * @param target
//  * @param ...sources
//  */
// export default function deepMerge<T, R>(target: T, source: R): T {
//   const output = { ...target };
//   if (isObject(target) && isObject(source)) {
//     Object.keys(source).forEach((key) => {
//       if (isObject(source[key])) {
//         if (!(key in target)) {
//           Object.assign(output, { [key]: source[key] });
//         } else {
//           output[key] = deepMerge(target[key], source[key]);
//         }
//       } else {
//         Object.assign(output, { [key]: source[key] });
//       }
//     });
//   }

//   return output;
// }
