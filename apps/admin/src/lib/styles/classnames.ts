type ClassValue = string | number | boolean | undefined | null | { [key: string]: boolean };

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((item): item is Exclude<ClassValue, null | undefined | false | ''> => Boolean(item))
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        // Handle object case - convert to class string
        return Object.entries(item)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key)
          .join(' ');
      }
      return String(item);
    })
    .join(' ')
    .trim();
}
