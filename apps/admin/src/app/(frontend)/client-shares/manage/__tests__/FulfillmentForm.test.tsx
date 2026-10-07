import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

const call = vi.fn();
function requestBody(index = 0) {
  const body = call.mock.calls[index]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('Expected a captured JSON request body');
  return JSON.parse(body);
}
vi.mock('@/lib/utils/csrf', () => ({ apiFetch: (...args: unknown[]) => call(...args) }));

import { FulfillmentForm } from '../FulfillmentForm';

beforeEach(() => {
  vi.clearAllMocks();
});
it('prepares notes and uses the persisted returned session for publication', async () => {
  const user = userEvent.setup();
  call
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'draft',
          siteId: 'delivery',
          sessionId: 'saved-session',
          delivered: false,
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'published',
          siteId: 'delivery',
          sessionId: 'saved-session',
          delivered: true,
        }),
      ),
    );
  render(<FulfillmentForm />);
  await user.type(screen.getByLabelText('Booking ID'), 'booking');
  await user.type(screen.getByLabelText('Buyer user ID'), 'buyer');
  await user.type(screen.getByLabelText('Session notes'), 'Consultation notes');
  await user.type(screen.getByLabelText('Recommended next step'), 'Next step');
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Draft prepared');
  expect(screen.getByRole('link', { name: 'Review saved session' })).toHaveAttribute(
    'href',
    '/edit-sessions/saved-session',
  );
  await user.selectOptions(screen.getByLabelText('Action'), 'publish');
  expect(screen.getByLabelText('Saved session ID')).toHaveValue('saved-session');
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Delivery published');
  const body = requestBody(1);
  expect(body).toEqual({
    action: 'publish',
    bookingId: 'booking',
    buyerUserId: 'buyer',
    sessionId: 'saved-session',
  });
});

it('offers an explicit refund review decision while retaining notes', async () => {
  const user = userEvent.setup();
  call.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'domain-pack-review-resolved',
        siteId: 'delivery',
        decision: 'revoked',
        delivered: false,
      }),
    ),
  );
  render(<FulfillmentForm />);
  await user.type(screen.getByLabelText('Booking ID'), 'booking');
  await user.type(screen.getByLabelText('Buyer user ID'), 'buyer');
  await user.selectOptions(screen.getByLabelText('Action'), 'resolve-domain-pack');
  await user.type(screen.getByLabelText('Refunded Stripe charge ID'), 'ch_verified123');
  await user.selectOptions(screen.getByLabelText('Domain pack decision'), 'revoked');
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Domain pack access revoked');
  expect(requestBody()).toEqual({
    action: 'resolve-domain-pack',
    bookingId: 'booking',
    buyerUserId: 'buyer',
    chargeId: 'ch_verified123',
    decision: 'revoked',
  });
});

it('prepares all purchased domain pack fields through the accessible checkbox control', async () => {
  const user = userEvent.setup();
  call.mockResolvedValue(
    new Response(
      JSON.stringify({ status: 'draft', siteId: 'delivery', sessionId: 'saved-session' }),
    ),
  );
  render(<FulfillmentForm />);
  await user.type(screen.getByLabelText('Booking ID'), 'booking');
  await user.type(screen.getByLabelText('Buyer user ID'), 'buyer');
  await user.type(screen.getByLabelText('Session notes'), 'Consultation notes');
  await user.type(screen.getByLabelText('Recommended next step'), 'Next step');
  await user.click(screen.getByLabelText('Include purchased domain pack'));
  expect(screen.getByRole('checkbox', { name: 'Include purchased domain pack' })).toBeChecked();
  for (const label of ['dns', 'path', 'proof-gap', 'stack', 'onboarding', 'walkthrough']) {
    await user.type(screen.getByLabelText(label), `Material for ${label}`);
  }
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Draft prepared');
  expect(requestBody()).toMatchObject({
    domainPack: {
      dns: 'Material for dns',
      path: 'Material for path',
      'proof-gap': 'Material for proof-gap',
      stack: 'Material for stack',
      onboarding: 'Material for onboarding',
      walkthrough: 'Material for walkthrough',
    },
  });
});

it('keeps hostname verification pending and shows actionable DNS records', async () => {
  const user = userEvent.setup();
  call.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'domain-pending-verification',
        siteId: 'delivery',
        delivered: false,
        customDomainAttached: false,
        domain: null,
        hostname: 'client.customer.com',
        verification: [
          { type: 'TXT', domain: '_vercel.client.customer.com', value: 'control-proof' },
        ],
        dns: {
          recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns.com' }],
          recommendedIPv4: [],
        },
      }),
      { status: 202 },
    ),
  );
  render(<FulfillmentForm />);
  await user.type(screen.getByLabelText('Booking ID'), 'booking');
  await user.type(screen.getByLabelText('Buyer user ID'), 'buyer');
  await user.selectOptions(screen.getByLabelText('Action'), 'attach-domain');
  await user.type(screen.getByLabelText('Client hostname'), 'client.customer.com');
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('verification is pending');
  expect(screen.getByRole('list', { name: 'Required DNS records' })).toHaveTextContent(
    'TXT _vercel.client.customer.com: control-proof',
  );
  expect(screen.queryByRole('link', { name: 'Verified client hostname' })).not.toBeInTheDocument();
  expect(requestBody()).toEqual({
    action: 'attach-domain',
    bookingId: 'booking',
    buyerUserId: 'buyer',
    hostname: 'client.customer.com',
  });
});

it('shows only verified attachment and removes its link after maintained detach', async () => {
  const user = userEvent.setup();
  call
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'domain-attached',
          siteId: 'delivery',
          delivered: false,
          customDomainAttached: true,
          domain: {
            hostname: 'client.customer.com',
            provider: 'vercel',
            projectId: 'prj_studio',
            verifiedAt: '2026-10-05T12:00:00Z',
          },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'domain-detached',
          siteId: 'delivery',
          delivered: false,
          customDomainAttached: false,
          domain: null,
        }),
      ),
    );
  render(<FulfillmentForm />);
  await user.type(screen.getByLabelText('Booking ID'), 'booking');
  await user.type(screen.getByLabelText('Buyer user ID'), 'buyer');
  await user.selectOptions(screen.getByLabelText('Action'), 'attach-domain');
  await user.type(screen.getByLabelText('Client hostname'), 'client.customer.com');
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Verified hostname attached');
  expect(screen.getByRole('link', { name: 'Verified client hostname' })).toHaveAttribute(
    'href',
    'https://client.customer.com',
  );
  await user.selectOptions(screen.getByLabelText('Action'), 'detach-domain');
  await user.click(screen.getByRole('button', { name: 'Update delivery' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Hostname detached');
  expect(screen.queryByRole('link', { name: 'Verified client hostname' })).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Required DNS records' })).not.toBeInTheDocument();
  expect(requestBody(1)).toEqual({
    action: 'detach-domain',
    bookingId: 'booking',
    buyerUserId: 'buyer',
  });
});
