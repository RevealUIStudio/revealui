/**
 * Service Worker Utilities
 *
 * Utilities for service worker registration, caching strategies, and offline support
 */

/**
 * Service Worker Configuration
 */
export interface ServiceWorkerConfig {
  scope?: string
  updateViaCache?: 'all' | 'imports' | 'none'
  scriptURL?: string
}

export const DEFAULT_SW_CONFIG: ServiceWorkerConfig = {
  scope: '/',
  updateViaCache: 'none',
  scriptURL: '/sw.js',
}

/**
 * Register service worker
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = DEFAULT_SW_CONFIG,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported')
    return null
  }

  try {
    const { scriptURL = '/sw.js', scope, updateViaCache } = config

    const registration = await navigator.serviceWorker.register(scriptURL, {
      scope,
      updateViaCache,
    })

    console.log('Service worker registered:', registration.scope)

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('New service worker available')

            // Trigger update notification
            window.dispatchEvent(
              new CustomEvent('sw-update-available', {
                detail: { registration },
              }),
            )
          }
        })
      }
    })

    return registration
  } catch (error) {
    console.error('Service worker registration failed:', error)
    return null
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return registration.unregister()
  } catch (error) {
    console.error('Service worker unregistration failed:', error)
    return false
  }
}

/**
 * Update service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
  } catch (error) {
    console.error('Service worker update failed:', error)
  }
}

/**
 * Skip waiting and activate new service worker
 */
export async function skipWaitingAndActivate(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registration = await navigator.serviceWorker.ready
  const waiting = registration.waiting

  if (waiting) {
    // Tell service worker to skip waiting
    waiting.postMessage({ type: 'SKIP_WAITING' })

    // Reload when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }
}

/**
 * Cache Strategies
 */
export const CACHE_STRATEGIES = {
  // Network first, fallback to cache
  networkFirst: 'network-first',

  // Cache first, fallback to network
  cacheFirst: 'cache-first',

  // Network only
  networkOnly: 'network-only',

  // Cache only
  cacheOnly: 'cache-only',

  // Stale while revalidate
  staleWhileRevalidate: 'stale-while-revalidate',
} as const

export type CacheStrategy = (typeof CACHE_STRATEGIES)[keyof typeof CACHE_STRATEGIES]

/**
 * Cache Configuration
 */
export interface CacheConfig {
  name: string
  version: number
  maxAge?: number
  maxEntries?: number
  strategy?: CacheStrategy
}

/**
 * Default cache configurations
 */
export const DEFAULT_CACHES: Record<string, CacheConfig> = {
  static: {
    name: 'static-assets',
    version: 1,
    maxAge: 31536000, // 1 year
    maxEntries: 100,
    strategy: CACHE_STRATEGIES.cacheFirst,
  },

  images: {
    name: 'images',
    version: 1,
    maxAge: 2592000, // 30 days
    maxEntries: 50,
    strategy: CACHE_STRATEGIES.cacheFirst,
  },

  api: {
    name: 'api',
    version: 1,
    maxAge: 300, // 5 minutes
    maxEntries: 50,
    strategy: CACHE_STRATEGIES.networkFirst,
  },

  pages: {
    name: 'pages',
    version: 1,
    maxAge: 3600, // 1 hour
    maxEntries: 20,
    strategy: CACHE_STRATEGIES.staleWhileRevalidate,
  },
}

/**
 * Generate cache name
 */
export function generateCacheName(config: CacheConfig): string {
  return `${config.name}-v${config.version}`
}

/**
 * Service worker message types
 */
export const SW_MESSAGES = {
  SKIP_WAITING: 'SKIP_WAITING',
  CLAIM_CLIENTS: 'CLAIM_CLIENTS',
  CLEAR_CACHE: 'CLEAR_CACHE',
  CACHE_URLS: 'CACHE_URLS',
  DELETE_CACHE: 'DELETE_CACHE',
  GET_CACHE_SIZE: 'GET_CACHE_SIZE',
} as const

/**
 * Post message to service worker
 */
export async function postMessageToSW(type: string, payload?: unknown): Promise<unknown> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported')
  }

  const registration = await navigator.serviceWorker.ready
  const sw = registration.active

  if (!sw) {
    throw new Error('No active service worker')
  }

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel()

    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(new Error(event.data.error))
      } else {
        resolve(event.data)
      }
    }

    sw.postMessage({ type, payload }, [messageChannel.port2])
  })
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  try {
    await postMessageToSW(SW_MESSAGES.CLEAR_CACHE)
  } catch (error) {
    console.error('Failed to clear caches:', error)
  }
}

/**
 * Clear specific cache
 */
export async function clearCache(cacheName: string): Promise<void> {
  try {
    await postMessageToSW(SW_MESSAGES.DELETE_CACHE, { cacheName })
  } catch (error) {
    console.error(`Failed to clear cache ${cacheName}:`, error)
  }
}

/**
 * Precache URLs
 */
export async function precacheURLs(urls: string[]): Promise<void> {
  try {
    await postMessageToSW(SW_MESSAGES.CACHE_URLS, { urls })
  } catch (error) {
    console.error('Failed to precache URLs:', error)
  }
}

/**
 * Get cache size
 */
export async function getCacheSize(): Promise<{
  quota: number
  usage: number
  available: number
}> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { quota: 0, usage: 0, available: 0 }
  }

  try {
    const estimate = await navigator.storage.estimate()
    const quota = estimate.quota || 0
    const usage = estimate.usage || 0
    const available = quota - usage

    return { quota, usage, available }
  } catch (error) {
    console.error('Failed to get cache size:', error)
    return { quota: 0, usage: 0, available: 0 }
  }
}

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration !== undefined
  } catch {
    return false
  }
}

/**
 * Get service worker state
 */
export async function getServiceWorkerState(): Promise<{
  registered: boolean
  installing: boolean
  waiting: boolean
  active: boolean
  controller: boolean
}> {
  if (!isServiceWorkerSupported()) {
    return {
      registered: false,
      installing: false,
      waiting: false,
      active: false,
      controller: false,
    }
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()

    if (!registration) {
      return {
        registered: false,
        installing: false,
        waiting: false,
        active: false,
        controller: false,
      }
    }

    return {
      registered: true,
      installing: registration.installing !== null,
      waiting: registration.waiting !== null,
      active: registration.active !== null,
      controller: navigator.serviceWorker.controller !== null,
    }
  } catch {
    return {
      registered: false,
      installing: false,
      waiting: false,
      active: false,
      controller: false,
    }
  }
}

/**
 * React hook for service worker
 */
export function useServiceWorker(config?: ServiceWorkerConfig) {
  if (typeof window === 'undefined') {
    return {
      register: async () => null,
      unregister: async () => false,
      update: async () => {},
      skipWaitingAndActivate: async () => {},
      state: {
        registered: false,
        installing: false,
        waiting: false,
        active: false,
        controller: false,
      },
    }
  }

  return {
    register: () => registerServiceWorker(config),
    unregister: unregisterServiceWorker,
    update: updateServiceWorker,
    skipWaitingAndActivate,
    state: getServiceWorkerState(),
  }
}

/**
 * Offline detection
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

/**
 * Listen for online/offline events
 */
export function onNetworkChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * Background sync registration
 */
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!isServiceWorkerSupported()) {
    throw new Error('Service workers not supported')
  }

  const registration = await navigator.serviceWorker.ready

  if (!('sync' in registration)) {
    throw new Error('Background sync not supported')
  }

  try {
    // @ts-expect-error - sync API not in types yet
    await registration.sync.register(tag)
  } catch (error) {
    console.error('Background sync registration failed:', error)
    throw error
  }
}

/**
 * Push notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Notifications not supported')
  }

  return Notification.requestPermission()
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!isServiceWorkerSupported()) {
    throw new Error('Service workers not supported')
  }

  const registration = await navigator.serviceWorker.ready

  if (!('pushManager' in registration)) {
    throw new Error('Push notifications not supported')
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })

    return subscription
  } catch (error) {
    console.error('Push subscription failed:', error)
    return null
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      return subscription.unsubscribe()
    }

    return false
  } catch (error) {
    console.error('Push unsubscription failed:', error)
    return false
  }
}

/**
 * Convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
