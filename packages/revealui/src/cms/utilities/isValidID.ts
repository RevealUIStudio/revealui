/**
 * Validates if an ID is valid based on the ID type
 */
export const isValidID = (id: unknown, idType: 'number' | 'text' = 'text'): boolean => {
  if (idType === 'number') {
    return typeof id === 'number' && !isNaN(id) && isFinite(id);
  }

  // For text IDs, allow strings and convert numbers to strings
  if (typeof id === 'number') {
    return !isNaN(id) && isFinite(id);
  }

  return typeof id === 'string' && id.length > 0;
};