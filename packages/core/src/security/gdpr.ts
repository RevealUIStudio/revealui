/**
 * GDPR Compliance Utilities
 *
 * Data privacy, consent management, data export, and right to be forgotten
 */

export type ConsentType =
  | 'necessary'
  | 'functional'
  | 'analytics'
  | 'marketing'
  | 'personalization'

export type DataCategory =
  | 'personal'
  | 'sensitive'
  | 'financial'
  | 'health'
  | 'behavioral'
  | 'location'

export interface ConsentRecord {
  id: string
  userId: string
  type: ConsentType
  granted: boolean
  timestamp: string
  expiresAt?: string
  source: 'explicit' | 'implicit' | 'legitimate_interest'
  version: string
  metadata?: Record<string, unknown>
}

export interface DataProcessingPurpose {
  id: string
  name: string
  description: string
  legalBasis:
    | 'consent'
    | 'contract'
    | 'legal_obligation'
    | 'vital_interest'
    | 'public_interest'
    | 'legitimate_interest'
  dataCategories: DataCategory[]
  retentionPeriod: number // days
  consentRequired: boolean
}

export interface PersonalDataExport {
  userId: string
  exportedAt: string
  data: {
    profile: Record<string, unknown>
    activities: Record<string, unknown>[]
    consents: ConsentRecord[]
    dataProcessing: DataProcessingPurpose[]
  }
  format: 'json' | 'csv' | 'pdf'
}

export interface DataDeletionRequest {
  id: string
  userId: string
  requestedAt: string
  processedAt?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  dataCategories: DataCategory[]
  reason?: string
  retainedData?: string[]
  deletedData?: string[]
}

/**
 * Consent management system
 */
export class ConsentManager {
  private consents: Map<string, ConsentRecord> = new Map()
  private consentVersion: string = '1.0.0'

  /**
   * Grant consent
   */
  async grantConsent(
    userId: string,
    type: ConsentType,
    source: ConsentRecord['source'] = 'explicit',
    expiresIn?: number,
  ): Promise<ConsentRecord> {
    const consent: ConsentRecord = {
      id: crypto.randomUUID(),
      userId,
      type,
      granted: true,
      timestamp: new Date().toISOString(),
      expiresAt: expiresIn
        ? new Date(Date.now() + expiresIn).toISOString()
        : undefined,
      source,
      version: this.consentVersion,
    }

    this.consents.set(`${userId}:${type}`, consent)

    return consent
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userId: string, type: ConsentType): Promise<void> {
    const key = `${userId}:${type}`
    const existing = this.consents.get(key)

    if (existing) {
      existing.granted = false
      existing.timestamp = new Date().toISOString()
    }
  }

  /**
   * Check if consent is granted
   */
  hasConsent(userId: string, type: ConsentType): boolean {
    const consent = this.consents.get(`${userId}:${type}`)

    if (!consent || !consent.granted) {
      return false
    }

    // Check if expired
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
      return false
    }

    return true
  }

  /**
   * Get all consents for user
   */
  getUserConsents(userId: string): ConsentRecord[] {
    return Array.from(this.consents.values()).filter((c) => c.userId === userId)
  }

  /**
   * Update consent version
   */
  setConsentVersion(version: string): void {
    this.consentVersion = version
  }

  /**
   * Check if consent needs renewal
   */
  needsRenewal(userId: string, type: ConsentType, maxAge: number): boolean {
    const consent = this.consents.get(`${userId}:${type}`)

    if (!consent || !consent.granted) {
      return true
    }

    const age = Date.now() - new Date(consent.timestamp).getTime()
    return age > maxAge
  }

  /**
   * Get consent statistics
   */
  getStatistics(): {
    total: number
    granted: number
    revoked: number
    expired: number
    byType: Record<ConsentType, number>
  } {
    const consents = Array.from(this.consents.values())
    const now = new Date()

    const granted = consents.filter((c) => c.granted).length
    const revoked = consents.filter((c) => !c.granted).length
    const expired = consents.filter(
      (c) => c.expiresAt && new Date(c.expiresAt) < now,
    ).length

    const byType = consents.reduce(
      (acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1
        return acc
      },
      {} as Record<ConsentType, number>,
    )

    return {
      total: consents.length,
      granted,
      revoked,
      expired,
      byType,
    }
  }
}

/**
 * Data export system
 */
export class DataExportSystem {
  /**
   * Export user data
   */
  async exportUserData(
    userId: string,
    getUserData: (userId: string) => Promise<{
      profile: Record<string, unknown>
      activities: Record<string, unknown>[]
      consents: ConsentRecord[]
    }>,
    format: PersonalDataExport['format'] = 'json',
  ): Promise<PersonalDataExport> {
    const data = await getUserData(userId)

    const exportData: PersonalDataExport = {
      userId,
      exportedAt: new Date().toISOString(),
      data: {
        profile: data.profile,
        activities: data.activities,
        consents: data.consents,
        dataProcessing: [],
      },
      format,
    }

    return exportData
  }

  /**
   * Format export as JSON
   */
  formatAsJSON(exportData: PersonalDataExport): string {
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Format export as CSV
   */
  formatAsCSV(exportData: PersonalDataExport): string {
    const lines: string[] = []

    // Profile data
    lines.push('Type,Key,Value')
    Object.entries(exportData.data.profile).forEach(([key, value]) => {
      lines.push(`Profile,${key},"${value}"`)
    })

    // Activities
    exportData.data.activities.forEach((activity, index) => {
      Object.entries(activity).forEach(([key, value]) => {
        lines.push(`Activity ${index + 1},${key},"${value}"`)
      })
    })

    return lines.join('\n')
  }

  /**
   * Create download link
   */
  createDownloadLink(content: string, filename: string, mimeType: string): string {
    const blob = new Blob([content], { type: mimeType })
    return URL.createObjectURL(blob)
  }
}

/**
 * Data deletion system (Right to be Forgotten)
 */
export class DataDeletionSystem {
  private requests: Map<string, DataDeletionRequest> = new Map()

  /**
   * Request data deletion
   */
  async requestDeletion(
    userId: string,
    dataCategories: DataCategory[],
    reason?: string,
  ): Promise<DataDeletionRequest> {
    const request: DataDeletionRequest = {
      id: crypto.randomUUID(),
      userId,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      dataCategories,
      reason,
    }

    this.requests.set(request.id, request)

    return request
  }

  /**
   * Process deletion request
   */
  async processDeletion(
    requestId: string,
    deleteData: (userId: string, categories: DataCategory[]) => Promise<{
      deleted: string[]
      retained: string[]
    }>,
  ): Promise<void> {
    const request = this.requests.get(requestId)

    if (!request) {
      throw new Error('Deletion request not found')
    }

    request.status = 'processing'

    try {
      const result = await deleteData(request.userId, request.dataCategories)

      request.status = 'completed'
      request.processedAt = new Date().toISOString()
      request.deletedData = result.deleted
      request.retainedData = result.retained
    } catch (error) {
      request.status = 'failed'
      throw error
    }
  }

  /**
   * Get deletion request
   */
  getRequest(requestId: string): DataDeletionRequest | undefined {
    return this.requests.get(requestId)
  }

  /**
   * Get user deletion requests
   */
  getUserRequests(userId: string): DataDeletionRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.userId === userId)
  }

  /**
   * Check if data can be deleted
   */
  canDelete(
    dataCategory: DataCategory,
    legalBasis: DataProcessingPurpose['legalBasis'],
  ): boolean {
    // Data with legal obligation or vital interest cannot be deleted
    if (legalBasis === 'legal_obligation' || legalBasis === 'vital_interest') {
      return false
    }

    return true
  }

  /**
   * Calculate retention period
   */
  calculateRetentionEnd(
    createdAt: Date,
    retentionPeriod: number,
  ): Date {
    return new Date(createdAt.getTime() + retentionPeriod * 24 * 60 * 60 * 1000)
  }

  /**
   * Check if data should be deleted (retention period expired)
   */
  shouldDelete(createdAt: Date, retentionPeriod: number): boolean {
    const retentionEnd = this.calculateRetentionEnd(createdAt, retentionPeriod)
    return new Date() > retentionEnd
  }
}

/**
 * Data anonymization utilities
 */
export class DataAnonymization {
  /**
   * Anonymize user data
   */
  static anonymizeUser(user: Record<string, unknown>): Record<string, unknown> {
    return {
      ...user,
      email: this.hashValue(user.email as string),
      name: 'Anonymous User',
      phone: undefined,
      address: undefined,
      ip: undefined,
    }
  }

  /**
   * Pseudonymize data (reversible)
   */
  static pseudonymize(value: string, key: string): string {
    // Simple pseudonymization (use proper crypto in production)
    return `pseudo_${this.hashValue(value + key).substring(0, 16)}`
  }

  /**
   * Hash value (irreversible)
   */
  static hashValue(value: string): string {
    // Simple hash (use proper crypto in production)
    let hash = 0
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return `hash_${Math.abs(hash).toString(36)}`
  }

  /**
   * Anonymize dataset
   */
  static anonymizeDataset<T extends Record<string, unknown>>(
    data: T[],
    sensitiveFields: (keyof T)[],
  ): T[] {
    return data.map((item) => {
      const anonymized = { ...item }

      sensitiveFields.forEach((field) => {
        if (field in anonymized && typeof anonymized[field] === 'string') {
          anonymized[field] = this.hashValue(anonymized[field] as string) as T[keyof T]
        }
      })

      return anonymized
    })
  }

  /**
   * K-anonymity check
   */
  static checkKAnonymity<T extends Record<string, unknown>>(
    data: T[],
    quasiIdentifiers: (keyof T)[],
    k: number,
  ): boolean {
    // Group by quasi-identifiers
    const groups = new Map<string, number>()

    data.forEach((item) => {
      const key = quasiIdentifiers
        .map((field) => String(item[field]))
        .join('|')

      groups.set(key, (groups.get(key) || 0) + 1)
    })

    // Check if all groups have at least k members
    return Array.from(groups.values()).every((count) => count >= k)
  }
}

/**
 * Privacy policy manager
 */
export class PrivacyPolicyManager {
  private policies: Map<string, { version: string; content: string; effectiveDate: Date }> =
    new Map()
  private currentVersion: string = '1.0.0'

  /**
   * Add policy version
   */
  addPolicy(version: string, content: string, effectiveDate: Date): void {
    this.policies.set(version, { version, content, effectiveDate })
    this.currentVersion = version
  }

  /**
   * Get current policy
   */
  getCurrentPolicy(): { version: string; content: string; effectiveDate: Date } | undefined {
    return this.policies.get(this.currentVersion)
  }

  /**
   * Get policy by version
   */
  getPolicy(version: string): { version: string; content: string; effectiveDate: Date } | undefined {
    return this.policies.get(version)
  }

  /**
   * Check if user accepted current policy
   */
  hasAcceptedCurrent(userAcceptedVersion: string): boolean {
    return userAcceptedVersion === this.currentVersion
  }

  /**
   * Get all versions
   */
  getAllVersions(): string[] {
    return Array.from(this.policies.keys())
  }
}

/**
 * Cookie consent banner
 */
export interface CookieConsentConfig {
  necessary: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
}

export class CookieConsentManager {
  private config: CookieConsentConfig = {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  }

  /**
   * Set consent configuration
   */
  setConsent(config: Partial<CookieConsentConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveToStorage()
  }

  /**
   * Get consent configuration
   */
  getConsent(): CookieConsentConfig {
    return { ...this.config }
  }

  /**
   * Check if specific consent is granted
   */
  hasConsent(type: keyof CookieConsentConfig): boolean {
    return this.config[type]
  }

  /**
   * Save to storage
   */
  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cookie-consent', JSON.stringify(this.config))
    }
  }

  /**
   * Load from storage
   */
  loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('cookie-consent')
      if (stored) {
        try {
          this.config = JSON.parse(stored)
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * Clear consent
   */
  clearConsent(): void {
    this.config = {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('cookie-consent')
    }
  }
}

/**
 * Data breach notification system
 */
export interface DataBreach {
  id: string
  detectedAt: string
  reportedAt?: string
  type: 'unauthorized_access' | 'data_loss' | 'data_leak' | 'system_compromise'
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedUsers: string[]
  dataCategories: DataCategory[]
  description: string
  mitigation?: string
  status: 'detected' | 'investigating' | 'notified' | 'resolved'
}

export class DataBreachManager {
  private breaches: Map<string, DataBreach> = new Map()

  /**
   * Report data breach
   */
  async reportBreach(
    breach: Omit<DataBreach, 'id' | 'detectedAt' | 'status'>,
  ): Promise<DataBreach> {
    const fullBreach: DataBreach = {
      ...breach,
      id: crypto.randomUUID(),
      detectedAt: new Date().toISOString(),
      status: 'detected',
    }

    this.breaches.set(fullBreach.id, fullBreach)

    // Auto-notify if critical
    if (fullBreach.severity === 'critical') {
      await this.notifyAuthorities(fullBreach)
    }

    return fullBreach
  }

  /**
   * Notify authorities (required within 72 hours under GDPR)
   */
  async notifyAuthorities(breach: DataBreach): Promise<void> {
    breach.reportedAt = new Date().toISOString()
    breach.status = 'notified'

    // In production, integrate with data protection authority API
    console.log('Breach reported to authorities:', breach.id)
  }

  /**
   * Notify affected users
   */
  async notifyAffectedUsers(
    breachId: string,
    notifyFn: (userId: string, breach: DataBreach) => Promise<void>,
  ): Promise<void> {
    const breach = this.breaches.get(breachId)

    if (!breach) {
      throw new Error('Breach not found')
    }

    for (const userId of breach.affectedUsers) {
      await notifyFn(userId, breach)
    }
  }

  /**
   * Check if breach notification is required
   */
  requiresNotification(breach: DataBreach): boolean {
    // Notification required for high risk breaches
    return (
      breach.severity === 'high' ||
      breach.severity === 'critical' ||
      breach.dataCategories.includes('sensitive') ||
      breach.dataCategories.includes('financial')
    )
  }

  /**
   * Get breach
   */
  getBreach(id: string): DataBreach | undefined {
    return this.breaches.get(id)
  }

  /**
   * Get all breaches
   */
  getAllBreaches(): DataBreach[] {
    return Array.from(this.breaches.values())
  }
}

/**
 * Global instances
 */
export const consentManager = new ConsentManager()
export const dataExportSystem = new DataExportSystem()
export const dataDeletionSystem = new DataDeletionSystem()
export const privacyPolicyManager = new PrivacyPolicyManager()
export const cookieConsentManager = new CookieConsentManager()
export const dataBreachManager = new DataBreachManager()
