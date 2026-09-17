import { z } from 'zod/v4';

const secretNameSchema = z.string().min(1).max(256);

export function assertSecretName(name: string): void {
  secretNameSchema.parse(name);
}
