/** RFC 4180-style bounded CSV reader. Quoted commas, escaped quotes and line breaks survive. */
export function parseCrmCsv(text: string, entity: 'organizations' | 'contacts' = 'organizations') {
  if (text.length > 1000000) throw new Error('CSV exceeds 1 MB');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error('Unexpected CSV quote');
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
      closed = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      closed = false;
    } else {
      if (closed) throw new Error('Unexpected text after quoted CSV field');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((v) => v.trim().replace(/^\uFEFF/, ''));
  const allowed =
    entity === 'organizations'
      ? ['name', 'website', 'industry', 'location', 'sourceUrl', 'sourceVerifiedAt']
      : ['organizationId', 'name', 'role', 'businessEmail', 'contactSourceUrl', 'consent'];
  if (
    !(
      headers?.includes(entity === 'organizations' ? 'name' : 'businessEmail') &&
      headers.includes(entity === 'organizations' ? 'sourceUrl' : 'contactSourceUrl')
    ) ||
    new Set(headers).size !== headers.length ||
    headers.some((v) => !allowed.includes(v))
  )
    throw new Error('Use unique headers and required identity/source columns');
  if (rows.length < 1 || rows.length > 500) throw new Error('Import between 1 and 500 records');
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(`CSV row ${index + 2} has the wrong number of fields`);
    return Object.fromEntries(
      headers.flatMap((header, i) => (values[i]?.trim() ? [[header, values[i]?.trim()]] : [])),
    );
  });
}
