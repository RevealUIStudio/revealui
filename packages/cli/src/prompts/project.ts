/**
 * Project configuration prompts
 */

import fs from 'node:fs';
import path from 'node:path';
import { isCancel, select, text } from '@clack/prompts';

export const VALID_TEMPLATES = [
  'basic-blog',
  'e-commerce',
  'portfolio',
  'starter',
  'starter-native',
] as const;

export type ProjectTemplate = (typeof VALID_TEMPLATES)[number];

export interface ProjectConfig {
  projectName: string;
  projectPath: string;
  template: ProjectTemplate;
}

const TEMPLATE_LABELS: Record<ProjectTemplate, string> = {
  'basic-blog': 'Basic Blog - A simple blog with posts and pages',
  'e-commerce': 'E-commerce - Product catalog with checkout',
  portfolio: 'Portfolio - Personal portfolio site',
  starter: 'Starter - Blank-canvas Next.js app, no sample collections',
  'starter-native': 'Starter (native) - Vite + @revealui/router, no Next.js',
};

export async function promptProjectConfig(
  defaultName?: string,
  templateArg?: string,
  nonInteractive = false,
): Promise<ProjectConfig> {
  // Resolve project name  -  use CLI arg or prompt
  let projectName: string;
  if (defaultName) {
    projectName = defaultName;
  } else if (nonInteractive) {
    projectName = 'my-revealui-project';
  } else {
    const name = await text({
      message: 'What is your project name?',
      defaultValue: 'my-revealui-project',
      validate: (input) => {
        if (!input) return undefined;
        const isValid = input.split('').every((ch) => {
          const code = ch.charCodeAt(0);
          return (
            (code >= 97 && code <= 122) || // a-z
            (code >= 48 && code <= 57) || // 0-9
            code === 45 // -
          );
        });
        if (!isValid) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens';
        }
        const projectPath = path.resolve(process.cwd(), input);
        if (fs.existsSync(projectPath)) {
          return `Directory "${input}" already exists`;
        }
        return undefined;
      },
    });

    if (isCancel(name)) {
      process.exit(0);
    }
    projectName = name;
  }

  // Resolve template  -  use CLI arg or prompt
  let template: ProjectConfig['template'];
  if (templateArg && VALID_TEMPLATES.includes(templateArg as ProjectConfig['template'])) {
    template = templateArg as ProjectConfig['template'];
  } else if (nonInteractive) {
    template = 'basic-blog';
  } else {
    const selected = await select({
      message: 'Which template would you like to use?',
      options: VALID_TEMPLATES.map((value) => ({ value, label: TEMPLATE_LABELS[value] })),
      initialValue: 'basic-blog' as const,
    });

    if (isCancel(selected)) {
      process.exit(0);
    }
    template = selected;
  }

  return {
    projectName,
    projectPath: path.resolve(process.cwd(), projectName),
    template,
  };
}
