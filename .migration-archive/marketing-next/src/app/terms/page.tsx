import type { Metadata } from 'next';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service | RevealUI',
  description: 'Terms of service for RevealUI and RevealUI Studio.',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'March 4, 2026';
  return (
    <div className="min-h-screen bg-white">
      <article className="mx-auto max-w-3xl px-6 py-24 lg:px-8 prose prose-gray">
        <h1>Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of the RevealUI platform
          provided by RevealUI Studio (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating
          an account or using the Service, you agree to these Terms.
        </p>

        <h2>1. Service Description</h2>
        <p>
          RevealUI is an open-source agentic business runtime for software companies. It includes a
          content engine, authentication, billing integration, AI agents, and UI components. The
          Service is available in four tiers: Free (OSS), Pro, Max, and Forge.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must be at least 13 years old to use the Service.</li>
          <li>One person or organization may not maintain more than one free account.</li>
        </ul>

        <h2>3. Free Tier (OSS)</h2>
        <p>
          The Free tier is licensed under the MIT License. You may use, modify, and distribute the
          open-source code freely, subject to the MIT License terms. The Free tier includes limited
          features (1 site, 3 users, community support).
        </p>

        <h2>4. Paid Tiers (Pro, Max &amp; Forge)</h2>
        <h3>Billing</h3>
        <ul>
          <li>Pro: $49/month, billed monthly. Includes a 7-day free trial.</li>
          <li>Max: $149/month, billed monthly. Includes a 7-day free trial.</li>
          <li>Forge: $299/month, billed monthly. Contact sales for annual pricing.</li>
          <li>All prices are in USD and exclude applicable taxes.</li>
          <li>Payment is processed by Stripe. You agree to Stripe&apos;s terms of service.</li>
        </ul>
        <h3>Trial</h3>
        <p>
          The Pro tier includes a 7-day free trial. You will not be charged during the trial period.
          If you do not cancel before the trial ends, your subscription will automatically begin and
          you will be charged the applicable monthly rate.
        </p>
        <h3>Cancellation</h3>
        <p>
          You may cancel your subscription at any time through the Stripe billing portal or by
          contacting us. Cancellation takes effect at the end of your current billing period. You
          retain access to paid features until then.
        </p>
        <h3>Refunds</h3>
        <p>
          We offer a full refund if requested within 14 days of your first paid charge (not
          including the trial period). After 14 days, no refunds are issued for partial billing
          periods. Contact support@revealui.com for refund requests.
        </p>

        <h2>5. Commercial License</h2>
        <p>
          Pro packages (@revealui/ai and @revealui/harnesses) are commercially licensed. The license
          is granted per-subscription and is non-transferable. See LICENSE.commercial in the
          repository for full terms.
        </p>

        <h2>6. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>Attempt to gain unauthorized access to the Service or its infrastructure</li>
          <li>Distribute malware, spam, or harmful content through the Service</li>
          <li>Exceed reasonable usage limits or abuse API rate limits</li>
          <li>Resell Pro/Max/Forge features without a valid license</li>
          <li>Reverse-engineer, decompile, or circumvent license key validation</li>
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate these terms.</p>

        <h2>7. Data and Content</h2>
        <ul>
          <li>You retain ownership of all content you create using the Service.</li>
          <li>We do not claim any intellectual property rights over your content.</li>
          <li>
            You are responsible for maintaining backups of your data. While we use reliable hosting
            providers, we do not guarantee against data loss.
          </li>
          <li>
            For self-hosted deployments, you are responsible for your own data security and
            compliance.
          </li>
        </ul>

        <h2>8. Service Availability</h2>
        <p>
          We strive for high availability but do not guarantee uninterrupted service. The Service is
          provided &quot;as is&quot; without warranty of any kind, express or implied. We are not
          liable for any downtime, data loss, or damages resulting from use of the Service.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, RevealUI Studio shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, including but not
          limited to loss of profits, data, or business opportunities. Our total liability under
          these Terms shall not exceed the amount paid by you to us in the 12 months preceding the
          claim.
        </p>

        <h2>10. Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify registered users of material
          changes via email at least 30 days before they take effect. Continued use of the Service
          after changes take effect constitutes acceptance of the new Terms.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the United States. Any disputes shall be resolved
          in the courts of the state where RevealUI Studio is incorporated.
        </p>

        <h2>12. Contact</h2>
        <p>
          For questions about these Terms, contact us at{' '}
          <a href="mailto:support@revealui.com">support@revealui.com</a>.
        </p>
      </article>
      <Footer />
    </div>
  );
}
