/** True when A2A (or a sibling AI route) refused the call for missing Pro/Enterprise AI. */
export function isAiLicenseDenial(message: string): boolean {
  return /requires a Pro or Enterprise license/i.test(message);
}
