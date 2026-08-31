// Buyer Vercel one-click listing. SoT for URL fields is
// deployment/vercel/template.json (lockstep-tested). Clone uses the
// existing starter GitHub twin. Not a new SKU.

export interface VercelOneClickEnv {
  readonly key: string;
  readonly required: boolean;
}

export interface VercelOneClickStore {
  readonly type: 'integration';
  readonly integrationSlug: 'neon';
  readonly productSlug: 'neon';
  readonly protocol: 'storage';
}

export interface VercelOneClickMeta {
  readonly name: 'RevealUI starter';
  readonly slug: 'revealui-starter';
  readonly description: string;
  readonly framework: 'nextjs';
  readonly repositoryUrl: 'https://github.com/RevealUIStudio/revealui-template-starter';
  readonly projectName: 'revealui-starter';
  readonly repositoryName: 'revealui-starter';
  readonly envDescription: string;
  readonly envLink: 'https://github.com/RevealUIStudio/revealui-template-starter/blob/main/.env.example';
  readonly env: readonly VercelOneClickEnv[];
  readonly stores: readonly [VercelOneClickStore];
}

export const VERCEL_ONE_CLICK = {
  name: 'RevealUI starter',
  slug: 'revealui-starter',
  description:
    'Clone the starter onto your Vercel account. RevealUI runtime on Vercel and Neon you control. Not managed hosting. Not the Starter Kit. Not a studio invoice.',
  framework: 'nextjs',
  repositoryUrl: 'https://github.com/RevealUIStudio/revealui-template-starter',
  projectName: 'revealui-starter',
  repositoryName: 'revealui-starter',
  envDescription:
    'RevealUI runtime on Vercel and Neon you control. REVEALUI_SECRET must be 32+ characters. Neon injects DATABASE_URL, which RevealUI accepts as a POSTGRES_URL fallback. Set the public URL to this project after the first deploy.',
  envLink: 'https://github.com/RevealUIStudio/revealui-template-starter/blob/main/.env.example',
  env: [
    { key: 'REVEALUI_SECRET', required: true },
    { key: 'REVEALUI_PUBLIC_SERVER_URL', required: true },
    { key: 'NEXT_PUBLIC_SERVER_URL', required: true },
    { key: 'REVEALUI_ADMIN_EMAIL', required: true },
    { key: 'REVEALUI_ADMIN_PASSWORD', required: true },
  ],
  stores: [
    {
      type: 'integration',
      integrationSlug: 'neon',
      productSlug: 'neon',
      protocol: 'storage',
    },
  ],
} as const satisfies VercelOneClickMeta;

export function buildVercelDeployHref(
  meta: Pick<
    VercelOneClickMeta,
    | 'repositoryUrl'
    | 'projectName'
    | 'repositoryName'
    | 'env'
    | 'envDescription'
    | 'envLink'
    | 'stores'
  > = VERCEL_ONE_CLICK,
): string {
  const params = new URLSearchParams();
  params.set('repository-url', meta.repositoryUrl);
  params.set('project-name', meta.projectName);
  params.set('repository-name', meta.repositoryName);
  params.set('env', meta.env.map((item) => item.key).join(','));
  params.set('envDescription', meta.envDescription);
  params.set('envLink', meta.envLink);
  params.set('stores', JSON.stringify(meta.stores));
  return `https://vercel.com/new/clone?${params.toString()}`;
}
