'use client';
import {
  Button,
  CheckboxCVA,
  ControlLabel,
  Field,
  Input,
  Label,
  Select,
  Textarea,
} from '@revealui/presentation/client';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

const packFields = ['dns', 'path', 'proof-gap', 'stack', 'onboarding', 'walkthrough'] as const;
type Action =
  | 'prepare'
  | 'publish'
  | 'revoke'
  | 'reconcile'
  | 'resolve-domain-pack'
  | 'attach-domain'
  | 'detach-domain';
export function FulfillmentForm() {
  const [action, setAction] = useState<Action>('prepare');
  const [sessionId, setSessionId] = useState('');
  const [withPack, setWithPack] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [siteId, setSiteId] = useState('');
  const [hostname, setHostname] = useState('');
  const [dnsInstructions, setDnsInstructions] = useState<string[]>([]);
  return (
    <form
      className="mt-8 grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage('');
        setSiteId('');
        setHostname('');
        setDnsInstructions([]);
        const fields = new FormData(event.currentTarget);
        const text = (key: string) => String(fields.get(key) ?? '');
        const body = {
          action,
          bookingId: text('bookingId'),
          buyerUserId: text('buyerUserId'),
          ...(action === 'prepare'
            ? {
                notes: text('notes'),
                nextStep: text('nextStep'),
                ...(withPack
                  ? { domainPack: Object.fromEntries(packFields.map((key) => [key, text(key)])) }
                  : {}),
              }
            : {}),
          ...(action === 'publish' ? { sessionId } : {}),
          ...(action === 'attach-domain' ? { hostname: text('hostname') } : {}),
          ...(action === 'resolve-domain-pack'
            ? { chargeId: text('chargeId'), decision: text('decision') }
            : {}),
        };
        try {
          const result = await apiFetch('/api/studio/consultation-fulfillment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = (await result.json()) as {
            error?: string;
            status?: string;
            siteId?: string;
            sessionId?: string;
            decision?: 'retained' | 'revoked';
            customDomainAttached?: boolean;
            domain?: { hostname: string } | null;
            verification?: { type: string; domain: string; value: string }[];
            dns?: {
              recommendedCNAME: { rank: number; value: string }[];
              recommendedIPv4: { rank: number; value: string[] }[];
            };
          };
          if (!result.ok) setMessage(data.error ?? 'The delivery could not be updated.');
          else {
            if (data.sessionId) setSessionId(data.sessionId);
            if (data.siteId) setSiteId(data.siteId);
            if (data.customDomainAttached && data.domain) setHostname(data.domain.hostname);
            if (data.status === 'domain-pending-verification')
              setDnsInstructions([
                ...(data.verification ?? []).map(
                  (record) => `${record.type} ${record.domain}: ${record.value}`,
                ),
                ...(data.dns?.recommendedCNAME ?? [])
                  .filter((record) => record.rank === 1)
                  .map((record) => `CNAME target: ${record.value}`),
                ...(data.dns?.recommendedIPv4 ?? [])
                  .filter((record) => record.rank === 1)
                  .flatMap((record) => record.value.map((value) => `A record: ${value}`)),
              ]);
            setMessage(
              data.status === 'draft'
                ? 'Draft prepared. Review the session, then publish it.'
                : data.status === 'published'
                  ? 'Delivery published for the buyer.'
                  : data.status === 'revoked'
                    ? 'Delivery access revoked.'
                    : data.status === 'domain-pack-review-resolved'
                      ? data.decision === 'retained'
                        ? 'Domain pack retained after review. Publish the material explicitly when ready.'
                        : 'Domain pack access revoked. Session notes stay available.'
                      : data.status === 'domain-attached'
                        ? 'Verified hostname attached. Clients sign in through the delivery link.'
                        : data.status === 'domain-pending-verification'
                          ? 'Hostname verification is pending. Complete the DNS records, then retry attachment.'
                          : data.status === 'domain-detached'
                            ? 'Hostname detached. The central delivery link remains governed by buyer access.'
                            : 'Delivery reconciled with the booking.',
            );
          }
        } catch {
          setMessage('The delivery service is unavailable.');
        } finally {
          setPending(false);
        }
      }}
    >
      <Field>
        <Label>Action</Label>
        <Select
          aria-label="Action"
          value={action}
          onChange={(event) => setAction(event.target.value as Action)}
          className="mt-1"
        >
          <option value="prepare">Prepare draft</option>
          <option value="publish">Publish delivery</option>
          <option value="revoke">Revoke delivery</option>
          <option value="reconcile">Reconcile booking status</option>
          <option value="resolve-domain-pack">Resolve domain pack refund review</option>
          <option value="attach-domain">Attach client hostname</option>
          <option value="detach-domain">Detach client hostname</option>
        </Select>
      </Field>
      <Field>
        <Label>Booking ID</Label>
        <Input name="bookingId" required maxLength={100} className="mt-1" />
      </Field>
      <Field>
        <Label>Buyer user ID</Label>
        <Input name="buyerUserId" required maxLength={100} className="mt-1" />
      </Field>
      {action === 'prepare' && (
        <>
          <Field>
            <Label>Session notes</Label>
            <Textarea name="notes" required maxLength={30000} rows={6} className="mt-1" />
          </Field>
          <Field>
            <Label>Recommended next step</Label>
            <Textarea name="nextStep" required maxLength={30000} rows={3} className="mt-1" />
          </Field>
          <ControlLabel className="flex items-center gap-2">
            <CheckboxCVA
              checked={withPack}
              onCheckedChange={(checked) => setWithPack(checked === true)}
            />{' '}
            Include purchased domain pack
          </ControlLabel>
          {withPack &&
            packFields.map((key) => (
              <Field key={key}>
                <Label>{key}</Label>
                <Textarea name={key} required maxLength={30000} rows={3} className="mt-1" />
              </Field>
            ))}
        </>
      )}
      {action === 'publish' && (
        <Field>
          <Label>Saved session ID</Label>
          <Input
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            required
            maxLength={100}
            className="mt-1"
          />
        </Field>
      )}
      {action === 'attach-domain' && (
        <Field>
          <Label>Client hostname</Label>
          <Input
            name="hostname"
            required
            maxLength={253}
            placeholder="client.your-domain.com"
            className="mt-1"
          />
        </Field>
      )}
      {action === 'resolve-domain-pack' && (
        <>
          <Field>
            <Label>Refunded Stripe charge ID</Label>
            <Input name="chargeId" required className="mt-1" />
          </Field>
          <Field>
            <Label>Domain pack decision</Label>
            <Select name="decision" className="mt-1">
              <option value="retained">Retain domain pack after review</option>
              <option value="revoked">Revoke domain pack</option>
            </Select>
          </Field>
          <p>
            Session notes stay available. Retained material requires explicit publication before
            clients can read it.
          </p>
        </>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Updating delivery…' : 'Update delivery'}
      </Button>
      {message && <p role="status">{message}</p>}
      {dnsInstructions.length > 0 && (
        <ul aria-label="Required DNS records">
          {dnsInstructions.map((record) => (
            <li key={record}>
              <code>{record}</code>
            </li>
          ))}
        </ul>
      )}
      {hostname && (
        <a href={`https://${hostname}`} className="underline">
          Verified client hostname
        </a>
      )}
      {sessionId && (
        <Link href={`/edit-sessions/${encodeURIComponent(sessionId)}`} className="underline">
          Review saved session
        </Link>
      )}
      {siteId && (
        <Link href={`/client-shares/${encodeURIComponent(siteId)}`} className="underline">
          Client delivery link
        </Link>
      )}
    </form>
  );
}
