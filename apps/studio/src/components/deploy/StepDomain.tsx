import { useState } from 'react';
import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepDomainProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onUpdateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepDomain({
  config,
  data,
  onUpdateData,
  onUpdateConfig,
  onNext,
}: StepDomainProps) {
  const [domain, setDomain] = useState(data.domain || '');
  const [signupOpen, setSignupOpen] = useState(data.signupOpen ?? true);
  const [brandName, setBrandName] = useState(data.brandName || '');
  const [signupWhitelist, setSignupWhitelist] = useState(data.signupWhitelist || '');
  const [brandColor, setBrandColor] = useState(data.brandColor || '');
  const [brandLogo, setBrandLogo] = useState(data.brandLogo || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanDomain = domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const apiUrl = cleanDomain ? `api.${cleanDomain}` : '';
  const adminUrl = cleanDomain ? `admin.${cleanDomain}` : '';
  const marketingUrl = cleanDomain || '';

  async function handleSave() {
    if (!cleanDomain) return;

    setSaving(true);
    setError(null);

    try {
      onUpdateData({
        domain: cleanDomain,
        signupOpen,
        brandName: brandName.trim() || undefined,
        signupWhitelist: signupWhitelist.trim() || undefined,
        brandColor: brandColor.trim() || undefined,
        brandLogo: brandLogo.trim() || undefined,
      });
      await onUpdateConfig({
        deploy: {
          ...config.deploy,
          domain: cleanDomain,
          supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardStep
      title="Domain & CORS"
      description="Configure your domain and security settings."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <Input
          id="domain"
          label="Domain"
          hint="e.g. example.com"
          placeholder="example.com"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setSaved(false);
          }}
          disabled={saved}
        />

        {cleanDomain && (
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4">
            <p className="mb-2 text-xs font-medium text-neutral-400">Derived URLs</p>
            <div className="flex flex-col gap-1 text-sm font-mono">
              <DerivedUrl label="API" url={`https://${apiUrl}`} />
              <DerivedUrl label="Admin" url={`https://${adminUrl}`} />
              <DerivedUrl label="Marketing" url={`https://${marketingUrl}`} />
            </div>
          </div>
        )}

        {cleanDomain && (
          <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-4">
            <p className="mb-2 text-xs font-medium text-neutral-400">DNS Records</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="pb-1 pr-4">Type</th>
                  <th className="pb-1 pr-4">Name</th>
                  <th className="pb-1">Value</th>
                </tr>
              </thead>
              <tbody className="font-mono text-neutral-300">
                <tr>
                  <td className="pr-4 py-0.5">CNAME</td>
                  <td className="pr-4 py-0.5">{apiUrl}</td>
                  <td className="py-0.5">cname.vercel-dns.com</td>
                </tr>
                <tr>
                  <td className="pr-4 py-0.5">CNAME</td>
                  <td className="pr-4 py-0.5">{adminUrl}</td>
                  <td className="py-0.5">cname.vercel-dns.com</td>
                </tr>
                <tr>
                  <td className="pr-4 py-0.5">CNAME</td>
                  <td className="pr-4 py-0.5">{marketingUrl}</td>
                  <td className="py-0.5">cname.vercel-dns.com</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={signupOpen}
            onChange={(e) => {
              setSignupOpen(e.target.checked);
              setSaved(false);
            }}
            disabled={saved}
            className="rounded border-neutral-600 bg-neutral-800 text-orange-500 focus:ring-orange-500"
          />
          Allow public signups (REVEALUI_SIGNUP_OPEN)
        </label>

        <Input
          id="brand-name"
          label="Brand Name"
          hint="optional"
          placeholder="My Company"
          value={brandName}
          onChange={(e) => {
            setBrandName(e.target.value);
            setSaved(false);
          }}
          disabled={saved}
        />

        <Input
          id="signup-whitelist"
          label="Signup Whitelist"
          hint="optional  -  comma-separated emails"
          placeholder="user@example.com, admin@example.com"
          value={signupWhitelist}
          onChange={(e) => {
            setSignupWhitelist(e.target.value);
            setSaved(false);
          }}
          disabled={saved}
        />

        <Input
          id="brand-color"
          label="Brand Color"
          hint="optional  -  hex color"
          placeholder="#ea580c"
          value={brandColor}
          onChange={(e) => {
            setBrandColor(e.target.value);
            setSaved(false);
          }}
          disabled={saved}
        />

        <Input
          id="brand-logo"
          label="Brand Logo URL"
          hint="optional  -  URL to logo image"
          placeholder="https://example.com/logo.png"
          value={brandLogo}
          onChange={(e) => {
            setBrandLogo(e.target.value);
            setSaved(false);
          }}
          disabled={saved}
        />

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!cleanDomain || saving || saved}
          >
            Save Configuration
          </Button>
          {saved && <span className="text-sm text-green-400">Configuration saved</span>}
        </div>

        <Button variant="primary" onClick={onNext} disabled={!saved} className="mt-2 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}

function DerivedUrl({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-neutral-500">{label}:</span>
      <span className="text-neutral-200">{url}</span>
    </div>
  );
}
