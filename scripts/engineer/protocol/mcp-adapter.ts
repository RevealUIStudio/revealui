#!/usr/bin/env tsx

/**
 * MCP Adapter - Generic Model Context Protocol Integration
 *
 * Provides a unified interface for all MCP server integrations,
 * eliminating code duplication across different service adapters.
 *
 * Usage:
 *   const adapter = new MCPAdapter('vercel', config)
 *   await adapter.execute(request)
 */

import {createLogger,execCommand} from '../../../packages/core/src/.scripts/utils.ts'

export interface MCPRequest {
  action: string
  parameters?: Record<string, unknown>
  options?: {
    timeout?: number
    retries?: number
    dryRun?: boolean
  }
}

export interface MCPResponse {
  success: boolean
  data?: unknown
  error?: string
  metadata?: {
    duration: number
    retries: number
    service: string
  }
}

export interface MCPConfig {
  apiKey?: string
  baseUrl?: string
  timeout?: number
  retries?: number
  environment?: 'development' | 'production'
}

export abstract class MCPAdapter {
  protected serviceName: string
  protected config: MCPConfig
  protected logger = createLogger()

  constructor(serviceName: string, config: MCPConfig) {
    this.serviceName = serviceName
    this.config = {
      timeout: 30000,
      retries: 3,
      environment: 'development',
      ...config,
    }
  }

  /**
   * Execute an MCP request
   */
  async execute(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now()
    let attempts = 0

    try {
      this.validateRequest(request)

      if (request.options?.dryRun) {
        return this.createDryRunResponse(request)
      }

      while (attempts < (request.options?.retries || this.config.retries || 3)) {
        attempts++

        try {
          this.logger.info(
            `[${this.serviceName}] Executing ${request.action} (attempt ${attempts})`,
          )

          const result = await this.executeRequest(request)

          const duration = Date.now() - startTime
          return {
            success: true,
            data: result,
            metadata: {
              duration,
              retries: attempts - 1,
              service: this.serviceName,
            },
          }
        } catch (error) {
          this.logger.warning(`[${this.serviceName}] Attempt ${attempts} failed: ${error}`)

          if (attempts >= (request.options?.retries || this.config.retries || 3)) {
            throw error
          }

          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * 2 ** (attempts - 1), 10000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      throw new Error('All retry attempts exhausted')
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          duration,
          retries: attempts,
          service: this.serviceName,
        },
      }
    }
  }

  /**
   * Validate the incoming request
   */
  protected validateRequest(request: MCPRequest): void {
    if (!request.action) {
      throw new Error('Request must include an action')
    }

    if (!this.isValidAction(request.action)) {
      throw new Error(`Unsupported action: ${request.action}`)
    }
  }

  /**
   * Check if an action is supported by this adapter
   */
  protected abstract isValidAction(action: string): boolean

  /**
   * Execute the actual request (implemented by subclasses)
   */
  protected abstract executeRequest(request: MCPRequest): Promise<unknown>

  /**
   * Create a dry-run response
   */
  protected createDryRunResponse(request: MCPRequest): MCPResponse {
    return {
      success: true,
      data: {
        dryRun: true,
        action: request.action,
        parameters: request.parameters,
        message: `Would execute ${request.action} on ${this.serviceName}`,
      },
    }
  }

  /**
   * Get authentication headers for API calls
   */
  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `RevealUI-MCP/${this.serviceName}`,
    }

    if (this.config.apiKey) {
      // Different services use different header names
      const headerName = this.getAuthHeaderName()
      headers[headerName] = this.config.apiKey
    }

    return headers
  }

  /**
   * Get the authentication header name for this service
   */
  protected abstract getAuthHeaderName(): string

  /**
   * Make an HTTP request with proper error handling
   */
  protected async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: unknown,
  ): Promise<unknown> {
    const headers = this.getAuthHeaders()

    try {
      const curlCommand = this.buildCurlCommand(method, url, headers, data)

      const result = await execCommand('curl', curlCommand.split(' '), {
        silent: true,
      })

      if (!result.success) {
        throw new Error(`HTTP request failed: ${result.message}`)
      }

      // Parse JSON response
      try {
        return JSON.parse(result.message)
      } catch {
        return result.message
      }
    } catch (error) {
      throw new Error(`Request to ${this.serviceName} failed: ${error}`)
    }
  }

  /**
   * Build curl command for HTTP requests
   */
  private buildCurlCommand(
    method: string,
    url: string,
    headers: Record<string, string>,
    data?: unknown,
  ): string {
    let command = `curl -s -X ${method}`

    // Add headers
    for (const [key, value] of Object.entries(headers)) {
      command += ` -H "${key}: ${value}"`
    }

    // Add data for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT')) {
      command += ` -d '${JSON.stringify(data)}'`
    }

    // Add URL
    command += ` "${url}"`

    // Add timeout
    command += ` --max-time ${Math.ceil((this.config.timeout || 30000) / 1000)}`

    return command
  }
}

// Specific service adapters

export class VercelAdapter extends MCPAdapter {
  constructor(config: MCPConfig) {
    super('vercel', config)
  }

  protected isValidAction(action: string): boolean {
    return ['deploy', 'list-deployments', 'get-deployment', 'delete-deployment'].includes(action)
  }

  protected getAuthHeaderName(): string {
    return 'Authorization'
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://api.vercel.com'

    switch (request.action) {
      case 'deploy':
        return this.makeRequest('POST', `${baseUrl}/v13/deployments`, request.parameters)

      case 'list-deployments':
        return this.makeRequest('GET', `${baseUrl}/v6/deployments`)

      case 'get-deployment': {
        const { id } = request.parameters || {}
        if (!id) throw new Error('Deployment ID required')
        return this.makeRequest('GET', `${baseUrl}/v13/deployments/${String(id)}`)
      }

      case 'delete-deployment': {
        const { deploymentId } = request.parameters || {}
        if (!deploymentId) throw new Error('Deployment ID required')
        return this.makeRequest('DELETE', `${baseUrl}/v13/deployments/${String(deploymentId)}`)
      }

      default:
        throw new Error(`Unsupported action: ${request.action}`)
    }
  }
}

export class StripeAdapter extends MCPAdapter {
  constructor(config: MCPConfig) {
    super('stripe', config)
  }

  protected isValidAction(action: string): boolean {
    return [
      'create-payment-intent',
      'list-payment-intents',
      'create-customer',
      'list-customers',
    ].includes(action)
  }

  protected getAuthHeaderName(): string {
    return 'Authorization'
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://api.stripe.com/v1'

    switch (request.action) {
      case 'create-payment-intent':
        return this.makeRequest('POST', `${baseUrl}/payment_intents`, request.parameters)

      case 'list-payment-intents':
        return this.makeRequest('GET', `${baseUrl}/payment_intents`)

      case 'create-customer':
        return this.makeRequest('POST', `${baseUrl}/customers`, request.parameters)

      case 'list-customers':
        return this.makeRequest('GET', `${baseUrl}/customers`)

      default:
        throw new Error(`Unsupported action: ${request.action}`)
    }
  }
}

export class NeonAdapter extends MCPAdapter {
  constructor(config: MCPConfig) {
    super('neon', config)
  }

  protected isValidAction(action: string): boolean {
    return ['list-projects', 'create-project', 'get-project', 'delete-project'].includes(action)
  }

  protected getAuthHeaderName(): string {
    return 'Authorization'
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://console.neon.tech/api/v2'

    switch (request.action) {
      case 'list-projects':
        return this.makeRequest('GET', `${baseUrl}/projects`)

      case 'create-project':
        return this.makeRequest('POST', `${baseUrl}/projects`, request.parameters)

      case 'get-project': {
        const { id } = request.parameters || {}
        if (!id) throw new Error('Project ID required')
        return this.makeRequest('GET', `${baseUrl}/projects/${String(id)}`)
      }

      case 'delete-project': {
        const { projectId } = request.parameters || {}
        if (!projectId) throw new Error('Project ID required')
        return this.makeRequest('DELETE', `${baseUrl}/projects/${String(projectId)}`)
      }

      default:
        throw new Error(`Unsupported action: ${request.action}`)
    }
  }
}

// Factory function to create adapters
export function createMCPAdapter(service: string, config: MCPConfig): MCPAdapter {
  switch (service.toLowerCase()) {
    case 'vercel':
      return new VercelAdapter(config)
    case 'stripe':
      return new StripeAdapter(config)
    case 'neon':
      return new NeonAdapter(config)
    default:
      throw new Error(`Unsupported MCP service: ${service}`)
  }
}
