export function isHipaaComplianceProfile(): boolean {
  const raw = import.meta.env.VITE_COMPLIANCE_PROFILE as string | undefined;
  return raw?.trim().toLowerCase() === 'hipaa';
}
