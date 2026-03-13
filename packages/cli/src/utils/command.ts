import net from 'node:net';
import { execa } from 'execa';

export async function commandExists(command: string): Promise<boolean> {
  try {
    await execa('bash', ['-lc', `command -v ${command}`], {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

export async function isTcpReachable(
  host: string,
  port: number,
  timeoutMs = 1500,
): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = new net.Socket();

    const finalize = (value: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
    socket.connect(port, host);
  });
}
