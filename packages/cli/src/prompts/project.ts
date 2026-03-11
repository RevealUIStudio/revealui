/**
 * Project configuration prompts
 */

import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';

export interface ProjectConfig {
  projectName: string;
  projectPath: string;
  template: 'basic-blog' | 'e-commerce' | 'portfolio';
}

const VALID_TEMPLATES = ['basic-blog', 'e-commerce', 'portfolio'] as const;

export async function promptProjectConfig(
  defaultName?: string,
  templateArg?: string,
): Promise<ProjectConfig> {
  // Resolve project name — use CLI arg or prompt
  let projectName: string;
  if (defaultName) {
    projectName = defaultName;
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is your project name?',
        default: 'my-revealui-project',
        validate: (input: string) => {
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Project name must contain only lowercase letters, numbers, and hyphens';
          }
          const projectPath = path.resolve(process.cwd(), input);
          if (fs.existsSync(projectPath)) {
            return `Directory "${input}" already exists`;
          }
          return true;
        },
      },
    ]);
    projectName = answers.projectName;
  }

  // Resolve template — use CLI arg or prompt
  let template: ProjectConfig['template'];
  if (templateArg && VALID_TEMPLATES.includes(templateArg as ProjectConfig['template'])) {
    template = templateArg as ProjectConfig['template'];
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Which template would you like to use?',
        choices: [
          { name: 'Basic Blog - A simple blog with posts and pages', value: 'basic-blog' },
          { name: 'E-commerce - Product catalog with checkout', value: 'e-commerce' },
          { name: 'Portfolio - Personal portfolio site', value: 'portfolio' },
        ],
        default: 'basic-blog',
      },
    ]);
    template = answers.template;
  }

  return {
    projectName,
    projectPath: path.resolve(process.cwd(), projectName),
    template,
  };
}
