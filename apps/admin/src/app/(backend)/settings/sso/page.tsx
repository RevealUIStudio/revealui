/**
 * Settings · Enterprise SSO — server shell.
 *
 * Client page owns list/create/edit/test-connection. LicenseGate (feature sso)
 * hides the panel without Enterprise entitlement; API still fail-closes.
 */

import SsoSettingsClient from './sso-settings-client';

export default function SsoSettingsPage() {
  return <SsoSettingsClient />;
}
