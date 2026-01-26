#!/usr/bin/env tsx
import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {createLogger} from '../../../packages/core/src/scripts/utils.ts'

const logger = createLogger()

export class AutomationEngine {
  async requestApproval(stepName: string, id: string) {
    const approvalPath = join(process.cwd(), `approval-${id}.txt`)
    const prompt = `🚨 APPROVAL REQUIRED\nStep: ${stepName}\nRespond with APPROVE to continue.`
    writeFileSync(approvalPath, prompt)
    logger.warning(`Approval required in: ${approvalPath}`)
    return false // Pauses execution until manually resumed
  }
}
