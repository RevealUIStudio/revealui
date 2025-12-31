/* eslint-disable @typescript-eslint/no-explicit-any */

import { isObject } from "./isObject";

export default function deepMerge<
  T extends Record<string, any>,
  R extends Record<string, any>,
>(target: T, source: R): T & R {
  const output = { ...target } as T & R;
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          const keyType = key as keyof T & keyof R;
          output[keyType] = isObject(target[key])
            ? deepMerge(
                target[key] as Record<string, any>,
                source[key] as Record<string, any>,
              )
            : source[key];
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

// export default function deepMerge<
//   T extends Record<string, any>,
//   R extends Record<string, any>,
// >(target: T, source: R): T & R {
//   const output = { ...target } as T & R;
//   if (isObject(target) && isObject(source)) {
//     Object.keys(source).forEach((key) => {
//       if (isObject(source[key])) {
//         if (!(key in target)) {
//           Object.assign(output, { [key]: source[key] });
//         } else {
//           const keyType = key as keyof T & keyof R;
//           output[keyType] = isObject(target[key])
//             ? deepMerge(
//                 target[key] as Record<string, any>,
//                 source[key] as Record<string, any>,
//               )
//             : source[key];
//         }
//       } else {
//         Object.assign(output, { [key]: source[key] });
//       }
//     });
//   }
//   return output;
// }
