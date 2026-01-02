/**
 * RevealUI CMS Errors
 * @module @revealui/cms/errors
 */

export class RevealUIError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RevealUIError'
  }
}

export class MissingEditorProp extends RevealUIError {
  constructor(fieldName?: string) {
    super(`Missing editor prop${fieldName ? ` for field: ${fieldName}` : ''}`)
    this.name = 'MissingEditorProp'
  }
}

export class ValidationError extends RevealUIError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ConfigurationError extends RevealUIError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export class AccessDeniedError extends RevealUIError {
  constructor(message = 'Access denied') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

export class NotFoundError extends RevealUIError {
  constructor(resource?: string) {
    super(`${resource || 'Resource'} not found`)
    this.name = 'NotFoundError'
  }
}
