export function generatePreviewPath({ path }: { path: string }): string {
  return `/next/preview?path=${encodeURIComponent(path)}`;
}
