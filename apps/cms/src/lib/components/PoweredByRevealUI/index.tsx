/**
 * PoweredByRevealUI — shown in the admin dashboard footer.
 *
 * Hidden when:
 *   - REVEALUI_SHOW_POWERED_BY=false (explicit Enterprise white-label opt-out)
 *   - The license JWT contains tier=enterprise or features.whiteLabel=true
 *
 * The brand name is customizable via REVEALUI_BRAND_NAME for white-label deployments.
 */

function shouldShowBadge(): boolean {
  // Explicit env var opt-out (Enterprise white-label)
  if (process.env.REVEALUI_SHOW_POWERED_BY === 'false') return false;

  // License JWT check — Enterprise tier or explicit whiteLabel feature
  const key = process.env.REVEALUI_LICENSE_KEY;
  if (key) {
    try {
      const parts = key.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64').toString('utf8')) as {
          tier?: string;
          features?: Record<string, boolean>;
        };
        if (payload.tier === 'enterprise' || payload.features?.whiteLabel === true) return false;
      }
    } catch {
      // Malformed JWT — fall through to show badge
    }
  }

  return true;
}

const PoweredByRevealUI = () => {
  if (!shouldShowBadge()) return null;

  const brandName = process.env.REVEALUI_BRAND_NAME ?? 'RevealUI';

  return (
    <p className="mt-6 text-xs text-gray-400">
      Built with{' '}
      <a
        href="https://revealui.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 underline hover:text-gray-200"
      >
        {brandName}
      </a>
    </p>
  );
};

export default PoweredByRevealUI;
