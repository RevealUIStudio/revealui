/**
 * Utility function for conditionally joining classNames together.
 * Drop-in replacement for clsx.
 */
type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | { [key: string]: boolean }
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs.flat(Infinity) as Exclude<ClassValue, ClassValue[]>[]) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
      continue;
    }

    if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(' ').trim();
}
