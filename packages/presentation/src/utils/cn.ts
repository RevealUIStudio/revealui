/**
 * Utility function for conditionally joining classNames together.
 * Drop-in replacement for clsx  -  supports strings, numbers, booleans,
 * objects, and arbitrarily nested arrays.
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

  for (const input of (inputs as readonly unknown[]).flat(Infinity) as Exclude<
    ClassValue,
    ClassValue[]
  >[]) {
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

/**
 * Lightweight class-variance-authority replacement.
 * Supports base classes, variants, and defaultVariants.
 */
type VariantValues = Record<string, string>;
type VariantConfig = Record<string, VariantValues>;

interface CvaConfig<V extends VariantConfig> {
  variants: V;
  defaultVariants?: { [K in keyof V]?: keyof V[K] };
}

type VariantProps<T> = T extends (props?: infer P) => string ? P : never;

function cva<V extends VariantConfig>(base: string, config: CvaConfig<V>) {
  type Props = { [K in keyof V]?: keyof V[K] | null } & { className?: string };

  const fn = (props?: Props): string => {
    const parts: string[] = [base];

    for (const key of Object.keys(config.variants)) {
      const propValue = props?.[key as keyof Props];
      const selected = propValue === null ? null : (propValue ?? config.defaultVariants?.[key]);
      if (selected != null) {
        const value = config.variants[key]?.[selected as string];
        if (value) parts.push(value);
      }
    }

    if (props?.className) parts.push(props.className);
    return parts.filter(Boolean).join(' ');
  };

  return fn;
}

export { cva, type VariantProps };
