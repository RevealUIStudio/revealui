/**
 * Project configuration prompts
 */

import fs from 'node:fs';
import path from 'node:path';
import { isCancel, select, text } from '@clack/prompts';

export interface ProjectConfig {
  projectName: string;
  projectPath: string;
  template: 'basic-blog' | 'e-commerce' | 'portfolio';
}

const VALID_TEMPLATES = ['basic-blog', 'e-commerce', 'portfolio'] as const;

export async function promptProjectConfig(
  defaultName?: string,
  templateArg?: string,
  nonInteractive = false,
): Promise<ProjectConfig> {
  // Resolve project name — use CLI arg or prompt
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

  // Resolve template — use CLI arg or prompt
  let template: ProjectConfig['template'];
  if (templateArg && VALID_TEMPLATES.includes(templateArg as ProjectConfig['template'])) {
    template = templateArg as ProjectConfig['template'];
  } else if (nonInteractive) {
    template = 'basic-blog';
  } else {
    const selected = await select({
      message: 'Which template would you like to use?',
      options: [
        { value: 'basic-blog' as const, label: 'Basic Blog - A simple blog with posts and pages' },
        { value: 'e-commerce' as const, label: 'E-commerce - Product catalog with checkout' },
        { value: 'portfolio' as const, label: 'Portfolio - Personal portfolio site' },
      ],
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
