export const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase();

export const formatSlugHook =
  (fallback: string) =>
  ({
    data,
    operation,
    originalDoc,
    value,
  }: {
    data?: Record<string, unknown>;
    operation?: string;
    originalDoc?: Record<string, unknown>;
    value?: unknown;
  }) => {
    if (typeof value === 'string') {
      return formatSlug(value);
    }

    if (operation === 'create' || !data?.slug) {
      const fallbackData = data?.[fallback] ?? originalDoc?.[fallback];

      if (fallbackData && typeof fallbackData === 'string') {
        return formatSlug(fallbackData);
      }
    }

    return value;
  };
