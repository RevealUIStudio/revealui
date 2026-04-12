/**
 * LoginScreen  -  Device Authentication Flow
 *
 * Two-step flow:
 * 1. Enter email → OTP sent to inbox
 * 2. Enter 6-digit OTP code → bearer token issued
 *
 * Matches the Studio visual style (dark theme, orange accent).
 */

import { useState } from 'react';
import { useAuthContext } from '../../hooks/use-auth';
import { useSettingsContext } from '../../hooks/use-settings';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function LoginScreen() {
  const { step, loading, error, sendOtp, submitOtp } = useAuthContext();
  const { settings } = useSettingsContext();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await sendOtp(settings.apiUrl, email.trim());
    if (ok) {
      setOtpSent(true);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || code.length !== 6) return;
    await submitOtp(settings.apiUrl, email.trim(), code.trim());
  }

  async function handleResend() {
    setCode('');
    await sendOtp(settings.apiUrl, email.trim());
  }

  const showOtp = step === 'otp' || otpSent;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-neutral-800 bg-neutral-900 p-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-lg font-semibold text-neutral-100">RevealUI Studio</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {showOtp ? 'Enter verification code' : 'Sign in to your account'}
          </p>
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        ) : null}

        {/* Email Step */}
        {showOtp ? null : (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Send verification code
            </Button>
          </form>
        )}

        {/* OTP Step */}
        {showOtp ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-xs text-neutral-500">
              We sent a 6-digit code to <span className="text-neutral-300">{email}</span>
            </p>
            <Input
              id="otp-code"
              label="Verification code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              mono
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={code.length !== 6}
              className="w-full"
            >
              Verify
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-neutral-500 hover:text-orange-400 disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setCode('');
                }}
                className="text-neutral-500 hover:text-neutral-300"
              >
                Use different email
              </button>
            </div>
          </form>
        ) : null}

        {/* Footer */}
        <p className="text-center text-[11px] text-neutral-600">Connecting to {settings.apiUrl}</p>
      </div>
    </div>
  );
}
