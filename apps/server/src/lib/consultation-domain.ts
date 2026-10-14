/** Vercel owns project attachment, domain control and DNS readiness proof. */
import type { StudioDomainConfig } from '@revealui/config';
import {
  ConsultationDnsProofSchema,
  ConsultationVerificationSchema,
  SiteConsultationDomainSchema,
} from '@revealui/contracts/entities';
import { z } from 'zod/v4';

const ProjectDomain = z.object({
  name: z.string(),
  projectId: z.string(),
  verified: z.boolean(),
  gitBranch: z.string().nullable().optional(),
  customEnvironmentId: z.string().nullable().optional(),
  redirect: z.string().nullable().optional(),
  verification: ConsultationVerificationSchema.optional(),
});

function providerUrl(config: StudioDomainConfig, path: string) {
  const url = new URL(path, 'https://api.vercel.com');
  if (config.teamId) url.searchParams.set('teamId', config.teamId);
  return url;
}
async function providerRequest(
  config: StudioDomainConfig,
  path: string,
  signal: AbortSignal,
  method = 'GET',
  body?: unknown,
) {
  return fetch(providerUrl(config, path), {
    method,
    cache: 'no-store',
    redirect: 'error',
    signal,
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function assertProject(
  domain: z.infer<typeof ProjectDomain>,
  config: StudioDomainConfig,
  hostname: string,
) {
  if (
    domain.name !== hostname ||
    domain.projectId !== config.projectId ||
    domain.gitBranch != null ||
    domain.customEnvironmentId != null ||
    domain.redirect != null
  ) {
    throw new Error('Provider domain does not match the configured production project');
  }
  return domain;
}

export async function attachVerifiedConsultationDomain(
  config: StudioDomainConfig,
  hostname: string,
) {
  const signal = AbortSignal.timeout(10_000);
  const projectPath = `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(hostname)}`;
  let response = await providerRequest(config, projectPath, signal);
  if (response.status === 404) {
    const attached = await providerRequest(
      config,
      `/v10/projects/${encodeURIComponent(config.projectId)}/domains`,
      signal,
      'POST',
      { name: hostname },
    );
    // An overlapping attach may return already-exists; only a fresh authoritative read can accept it.
    if (!attached.ok && attached.status !== 400) throw new Error('Provider attachment unavailable');
    response = await providerRequest(config, projectPath, signal);
  }
  if (!response.ok) throw new Error('Provider domain unavailable');
  let domain = assertProject(ProjectDomain.parse(await response.json()), config, hostname);
  if (!domain.verified) {
    const verification = await providerRequest(config, `${projectPath}/verify`, signal, 'POST');
    if (!verification.ok && verification.status !== 400)
      throw new Error('Provider verification unavailable');
    const current = await providerRequest(config, projectPath, signal);
    if (!current.ok) throw new Error('Provider domain unavailable');
    domain = assertProject(ProjectDomain.parse(await current.json()), config, hostname);
  }
  const dnsPath = `/v6/domains/${encodeURIComponent(hostname)}/config`;
  const dnsUrl = providerUrl(config, dnsPath);
  dnsUrl.searchParams.set('projectIdOrName', config.projectId);
  dnsUrl.searchParams.set('strict', 'true');
  const dnsResponse = await fetch(dnsUrl, {
    cache: 'no-store',
    redirect: 'error',
    signal,
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!dnsResponse.ok) throw new Error('Provider DNS proof unavailable');
  const dns = ConsultationDnsProofSchema.parse(await dnsResponse.json());
  if (
    !domain.verified ||
    dns.misconfigured ||
    !['A', 'CNAME', 'http'].includes(dns.configuredBy ?? '') ||
    dns.acceptedChallenges.length === 0
  ) {
    return {
      status: 'pending-verification' as const,
      domain: null,
      hostname,
      verification: domain.verification,
      dns,
    };
  }
  return {
    status: 'attached' as const,
    domain: SiteConsultationDomainSchema.parse({
      hostname,
      provider: 'vercel',
      projectId: config.projectId,
      verifiedAt: new Date().toISOString(),
    }),
  };
}

export async function detachConsultationDomain(config: StudioDomainConfig, hostname: string) {
  const signal = AbortSignal.timeout(10_000);
  const path = `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(hostname)}`;
  const current = await providerRequest(config, path, signal);
  if (current.status === 404) return;
  if (!current.ok) throw new Error('Provider domain unavailable');
  assertProject(ProjectDomain.parse(await current.json()), config, hostname);
  const response = await providerRequest(config, path, signal, 'DELETE');
  if (!response.ok && response.status !== 404) throw new Error('Provider detach unavailable');
}
