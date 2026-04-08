import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — RevealUI',
  description: 'Privacy policy for RevealUI and RevealUI Studio.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'March 4, 2026';
  return (
    <div className="min-h-screen bg-white">
      <article className="mx-auto max-w-3xl px-6 py-24 lg:px-8 prose prose-gray">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>

        <p>
          RevealUI Studio (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the RevealUI
          platform, including revealui.com, admin.revealui.com, api.revealui.com, and
          docs.revealui.com (the &quot;Service&quot;). This Privacy Policy describes how we collect,
          use, and protect your personal information.
        </p>

        <h2>1. Information We Collect</h2>
        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your email address, name, and password (stored as a
          bcrypt hash). If you sign up via OAuth (Google, GitHub), we receive your provider profile
          information.
        </p>
        <h3>Payment Information</h3>
        <p>
          Payment processing is handled entirely by Stripe. We never store credit card numbers. We
          store your Stripe customer ID to link your account to your subscription.
        </p>
        <h3>Usage Data</h3>
        <p>
          We collect server logs (IP address, request path, user agent) for security monitoring and
          debugging. Logs are retained only as long as necessary for security and operational
          purposes.
        </p>
        <h3>Content Data</h3>
        <p>
          Any content you create through the CMS (posts, pages, media) is stored in your database.
          For hosted plans, this data is stored in NeonDB (PostgreSQL) and Supabase.
        </p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain the Service</li>
          <li>To process payments and manage subscriptions</li>
          <li>
            To send transactional emails (password resets, billing notifications, license delivery)
          </li>
          <li>To detect and prevent fraud, abuse, and security incidents</li>
          <li>To respond to support requests</li>
        </ul>
        <p>We do not sell your personal information. We do not use your data for advertising.</p>

        <h2>3. Data Sharing</h2>
        <p>We share data only with:</p>
        <ul>
          <li>
            <strong>Stripe</strong> — for payment processing (
            <a href="https://stripe.com/privacy">Stripe Privacy Policy</a>)
          </li>
          <li>
            <strong>NeonDB</strong> — database hosting (
            <a href="https://neon.tech/privacy">Neon Privacy Policy</a>)
          </li>
          <li>
            <strong>Vercel</strong> — application hosting (
            <a href="https://vercel.com/legal/privacy-policy">Vercel Privacy Policy</a>)
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery (
            <a href="https://resend.com/legal/privacy-policy">Resend Privacy Policy</a>)
          </li>
        </ul>

        <h2>4. Data Retention</h2>
        <p>
          Account data is retained while your account is active. After account deletion, we
          permanently remove your personal data within 30 days. Server logs are retained only as
          long as necessary for security and operational purposes. Billing records are retained as
          required by tax law (typically 7 years).
        </p>

        <h2>5. Your Rights (GDPR / CCPA)</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> your personal data — available via your account settings or by
            contacting us
          </li>
          <li>
            <strong>Export</strong> your data — use the GDPR export endpoint in the CMS
          </li>
          <li>
            <strong>Delete</strong> your account and all associated data — use the account deletion
            feature or contact us
          </li>
          <li>
            <strong>Correct</strong> inaccurate data — update your profile in the CMS admin
          </li>
          <li>
            <strong>Object</strong> to processing — contact us at the email below
          </li>
        </ul>
        <p>
          California residents: Under the CCPA, you have the right to know what personal information
          we collect and to request its deletion. We do not sell personal information.
        </p>

        <h2>6. Security</h2>
        <p>
          We protect your data using: bcrypt password hashing, session-based authentication with
          secure cookies, rate limiting and brute force protection, HTTPS/TLS encryption in transit,
          and encrypted database connections.
        </p>

        <h2>7. Cookies</h2>
        <p>
          We use essential cookies only: a session cookie for authentication. We do not use tracking
          cookies, analytics cookies, or advertising cookies.
        </p>

        <h2>8. Children</h2>
        <p>
          The Service is not intended for children under 13. We do not knowingly collect personal
          information from children under 13.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify registered users of
          material changes via email.
        </p>

        <h2>10. Contact</h2>
        <p>
          For privacy-related questions or to exercise your data rights, contact us at{' '}
          <a href="mailto:support@revealui.com">support@revealui.com</a>.
        </p>
      </article>
      <Footer />
    </div>
  );
}
