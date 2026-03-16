import { useState } from 'react';
import { resendSendTest, smtpSendTest } from '../../lib/deploy';
import type { StudioConfig, WizardData } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

type EmailProvider = 'resend' | 'smtp';

interface StepEmailProps {
  config: StudioConfig;
  data: WizardData;
  onUpdateData: (updates: Partial<WizardData>) => void;
  onUpdateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepEmail({
  config,
  data,
  onUpdateData,
  onUpdateConfig,
  onNext,
}: StepEmailProps) {
  const [provider, setProvider] = useState<EmailProvider>(data.emailProvider || 'resend');
  const [resendApiKey, setResendApiKey] = useState(data.resendApiKey || '');
  const [smtpHost, setSmtpHost] = useState(data.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(data.smtpPort || '587');
  const [smtpUser, setSmtpUser] = useState(data.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState(data.smtpPass || '');
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendTest() {
    if (!testEmail.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (provider === 'resend') {
        if (!resendApiKey.trim()) {
          setError('Resend API key is required');
          return;
        }
        await resendSendTest(resendApiKey.trim(), testEmail.trim());
      } else {
        if (!(smtpHost.trim() && smtpUser.trim() && smtpPass.trim())) {
          setError('SMTP host, username, and password are required');
          return;
        }
        await smtpSendTest(
          smtpHost.trim(),
          Number.parseInt(smtpPort, 10) || 587,
          smtpUser.trim(),
          smtpPass.trim(),
          testEmail.trim(),
        );
      }

      setTestSent(true);

      const updates: Partial<WizardData> = { emailProvider: provider };
      if (provider === 'resend') {
        updates.resendApiKey = resendApiKey.trim();
      } else {
        updates.smtpHost = smtpHost.trim();
        updates.smtpPort = smtpPort.trim();
        updates.smtpUser = smtpUser.trim();
        updates.smtpPass = smtpPass.trim();
      }
      onUpdateData(updates);
      await onUpdateConfig({
        deploy: {
          ...config.deploy,
          supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
          emailProvider: provider,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email');
      setTestSent(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardStep
      title="Connect Email"
      description="Set up email delivery for notifications."
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setProvider('resend')}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              provider === 'resend'
                ? 'bg-orange-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Resend
          </button>
          <button
            type="button"
            onClick={() => setProvider('smtp')}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              provider === 'smtp'
                ? 'bg-orange-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            SMTP
          </button>
        </div>

        {provider === 'resend' ? (
          <Input
            id="resend-api-key"
            label="Resend API Key"
            hint="resend.com/api-keys"
            type="password"
            placeholder="re_..."
            value={resendApiKey}
            onChange={(e) => setResendApiKey(e.target.value)}
            disabled={loading}
            mono
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-neutral-700 bg-neutral-900/50 p-4">
            <Input
              id="smtp-host"
              label="SMTP Host"
              type="text"
              placeholder="smtp.example.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              disabled={loading}
              mono
            />
            <Input
              id="smtp-port"
              label="Port"
              type="text"
              placeholder="587"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              disabled={loading}
              mono
            />
            <Input
              id="smtp-user"
              label="Username"
              type="text"
              placeholder="user@example.com"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              disabled={loading}
              mono
            />
            <Input
              id="smtp-pass"
              label="Password"
              type="password"
              placeholder="SMTP password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              disabled={loading}
              mono
            />
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              id="test-email"
              label="Test Email Address"
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleSendTest}
            loading={loading}
            disabled={!testEmail.trim() || loading}
          >
            Send Test Email
          </Button>
        </div>

        {testSent && <p className="text-sm text-green-400">Test email sent — check your inbox.</p>}

        <Button variant="primary" onClick={onNext} disabled={!testSent} className="mt-2 self-end">
          Next
        </Button>
      </div>
    </WizardStep>
  );
}
