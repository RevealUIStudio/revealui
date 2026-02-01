/**
 * Project configuration prompts
 */

import inquirer from 'inquirer'
import path from 'node:path'
import fs from 'node:fs'

export interface ProjectConfig {
  projectName: string
  projectPath: string
  template: 'basic-blog' | 'e-commerce' | 'portfolio'
}

export async function promptProjectConfig(defaultName?: string): Promise<ProjectConfig> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: defaultName || 'my-revealui-project',
      validate: (input: string) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must contain only lowercase letters, numbers, and hyphens'
        }
        const projectPath = path.resolve(process.cwd(), input)
        if (fs.existsSync(projectPath)) {
          return `Directory "${input}" already exists`
        }
        return true
      },
    },
    {
      type: 'list',
      name: 'template',
      message: 'Which template would you like to use?',
      choices: [
        {
          name: 'Basic Blog - A simple blog with posts and pages',
          value: 'basic-blog',
        },
        {
          name: 'E-commerce - Product catalog with checkout',
          value: 'e-commerce',
        },
        {
          name: 'Portfolio - Personal portfolio site',
          value: 'portfolio',
        },
      ],
      default: 'basic-blog',
    },
  ])

  return {
    projectName: answers.projectName,
    projectPath: path.resolve(process.cwd(), answers.projectName),
    template: answers.template,
  }
}
