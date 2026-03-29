export interface VSCodeExtensions {
  recommendations: string[];
}

export function generateVSCodeExtensions(): VSCodeExtensions {
  return {
    recommendations: [
      'biomejs.biome',
      'bradlc.vscode-tailwindcss',
      'unifiedjs.vscode-mdx',
      'drizzle-team.drizzle-vscode',
      'ms-vscode.vscode-typescript-next',
      'eamodio.gitlens',
    ],
  };
}
