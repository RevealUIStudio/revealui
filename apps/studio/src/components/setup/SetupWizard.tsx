import { markSetupComplete, useSetup } from '../../hooks/use-setup';
import Button from '../ui/Button';
import ErrorAlert from '../ui/ErrorAlert';
import Modal from '../ui/Modal';
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

interface SetupWizardProps {
  onClose: () => void;
}

export default function SetupWizard({ onClose }: SetupWizardProps) {
  const setup = useSetup();

  const handleComplete = () => {
    markSetupComplete();
    onClose();
  };

  const allDone =
    setup.status?.wsl_running &&
    setup.status?.nix_installed &&
    setup.status?.devbox_mounted &&
    !!setup.status?.git_name &&
    !!setup.status?.git_email;

  return (
    <Modal
      title="Setup RevealUI Studio"
      open={true}
      onClose={onClose}
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Skip
          </Button>
          <Button variant="primary" size="lg" onClick={handleComplete} disabled={!allDone}>
            Complete Setup
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {setup.loading && !setup.status && (
          <p className="text-sm text-neutral-400">Checking environment...</p>
        )}

        <ErrorAlert message={setup.error} />

        <WslRow setup={setup} />
        <NixRow setup={setup} />
        <DevPodRow setup={setup} />
        <GitIdentityRow setup={setup} />
        <VaultRow />
        <TailscaleRow />
        <ProjectSetupRow />
        <TerminalProfileRow />
      </div>
    </Modal>
  );
}
