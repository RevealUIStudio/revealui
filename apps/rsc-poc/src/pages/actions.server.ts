'use server';

export async function submitMessage(formData: FormData): Promise<string> {
  const message = formData.get('message');
  const value = typeof message === 'string' ? message : '';
  process.stdout.write(`[server-action] submitMessage called with: ${value}\n`);
  return `Server received: "${value}" at ${new Date().toISOString()}`;
}
