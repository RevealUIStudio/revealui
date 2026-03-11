import { useDevBox } from '../../hooks/use-devbox';
import { useStatus } from '../../hooks/use-status';
import Button from '../ui/Button';
import ErrorAlert from '../ui/ErrorAlert';
import DriveInfo from './DriveInfo';
import MountLog from './MountLog';

export default function DevBoxPanel() {
  const { mount, refresh } = useStatus();
  const { operating, log, error, mount: doMount, unmount: doUnmount } = useDevBox();

  const handleMount = async () => {
    await doMount();
    refresh();
  };

  const handleUnmount = async () => {
    await doUnmount();
    refresh();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">DevPod</h1>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={handleMount}
          disabled={operating || (mount?.mounted ?? false)}
        >
          Mount
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={handleUnmount}
          disabled={operating || !(mount?.mounted ?? false)}
        >
          Unmount
        </Button>
        {operating && <span className="text-sm text-neutral-400">Working...</span>}
      </div>

      <ErrorAlert message={error} />

      {mount && <DriveInfo mount={mount} />}

      {log.length > 0 && <MountLog entries={log} />}
    </div>
  );
}
