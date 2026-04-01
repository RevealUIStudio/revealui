import { useSetup } from '../../hooks/use-setup';
import Button from '../ui/Button';
import ErrorAlert from '../ui/ErrorAlert';
import PanelHeader from '../ui/PanelHeader';
import {
  DevPodRow,
  GitIdentityRow,
  NixRow,
  ProjectSetupRow,
  TailscaleRow,
  TerminalProfileRow,
  VaultRow,
  WslRow,
} from './SetupRows';

/** Full-page version of setup — shown when navigating to the Setup page after first-run. */
export default function SetupPage() {
  const setup = useSetup();

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Setup"
        action={
          <Button variant="secondary" onClick={setup.refresh} loading={setup.loading}>
            Refresh
          </Button>
        }
      />

      <ErrorAlert message={setup.error} />

      <div className="space-y-3">
        <WslRow setup={setup} />
        <NixRow setup={setup} />
        <DevPodRow setup={setup} />
        <GitIdentityRow setup={setup} />
        <VaultRow />
        <TailscaleRow />
        <ProjectSetupRow />
        <TerminalProfileRow />
      </div>
    </div>
  );
}
