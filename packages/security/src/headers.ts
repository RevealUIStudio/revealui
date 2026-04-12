/**
 * Security Headers and CORS Configuration
 *
 * HTTP security headers and CORS policy management
 */

import { getSecurityLogger } from './logger.js';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string | ContentSecurityPolicyConfig;
  strictTransportSecurity?: boolean | HSTSConfig;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | string;
  xContentTypeOptions?: boolean;
  referrerPolicy?: ReferrerPolicyValue;
  permissionsPolicy?: string | PermissionsPolicyConfig;
  crossOriginEmbedderPolicy?: 'require-corp' | 'credentialless';
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  crossOriginResourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin';
}

export interface ContentSecurityPolicyConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
  childSrc?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  baseUri?: string[];
  manifestSrc?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

export interface HSTSConfig {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

export interface PermissionsPolicyConfig {
  accelerometer?: string[];
  ambientLightSensor?: string[];
  autoplay?: string[];
  battery?: string[];
  camera?: string[];
  displayCapture?: string[];
  documentDomain?: string[];
  encryptedMedia?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  payment?: string[];
  pictureInPicture?: string[];
  publicKeyCredentials?: string[];
  screenWakeLock?: string[];
  syncXhr?: string[];
  usb?: string[];
  webShare?: string[];
  xrSpatialTracking?: string[];
}

export interface CORSConfig {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

/**
 * Security headers manager
 */
export class SecurityHeaders {
  private config: SecurityHeadersConfig;

  constructor(config: SecurityHeadersConfig = {}) {
    this.config = config;
  }

  /**
   * Get all security headers
   */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (this.config.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = this.buildCSP(this.config.contentSecurityPolicy);
    }

    // Strict Transport Security
    if (this.config.strictTransportSecurity) {
      headers['Strict-Transport-Security'] = this.buildHSTS(this.config.strictTransportSecurity);
    }

    // X-Frame-Options
    if (this.config.xFrameOptions) {
      headers['X-Frame-Options'] = this.config.xFrameOptions;
    }

    // X-Content-Type-Options
    if (this.config.xContentTypeOptions !== false) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // Referrer-Policy
    if (this.config.referrerPolicy) {
      headers['Referrer-Policy'] = this.config.referrerPolicy;
    }

    // Permissions-Policy
    if (this.config.permissionsPolicy) {
      headers['Permissions-Policy'] = this.buildPermissionsPolicy(this.config.permissionsPolicy);
    }

    // Cross-Origin headers
    if (this.config.crossOriginEmbedderPolicy) {
      headers['Cross-Origin-Embedder-Policy'] = this.config.crossOriginEmbedderPolicy;
    }

    if (this.config.crossOriginOpenerPolicy) {
      headers['Cross-Origin-Opener-Policy'] = this.config.crossOriginOpenerPolicy;
    }

    if (this.config.crossOriginResourcePolicy) {
      headers['Cross-Origin-Resource-Policy'] = this.config.crossOriginResourcePolicy;
    }

    return headers;
  }

  /**
   * Build Content Security Policy header
   */
  private buildCSP(config: string | ContentSecurityPolicyConfig): string {
    if (typeof config === 'string') {
      return config;
    }

    const directives: string[] = [];

    const addDirective = (name: string, values?: string[]) => {
      if (values && values.length > 0) {
        directives.push(`${name} ${values.join(' ')}`);
      }
    };

    addDirective('default-src', config.defaultSrc);
    addDirective('script-src', config.scriptSrc);
    addDirective('style-src', config.styleSrc);
    addDirective('img-src', config.imgSrc);
    addDirective('font-src', config.fontSrc);
    addDirective('connect-src', config.connectSrc);
    addDirective('frame-src', config.frameSrc);
    addDirective('object-src', config.objectSrc);
    addDirective('media-src', config.mediaSrc);
    addDirective('worker-src', config.workerSrc);
    addDirective('child-src', config.childSrc);
    addDirective('form-action', config.formAction);
    addDirective('frame-ancestors', config.frameAncestors);
    addDirective('base-uri', config.baseUri);
    addDirective('manifest-src', config.manifestSrc);

    if (config.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }

    if (config.blockAllMixedContent) {
      directives.push('block-all-mixed-content');
    }

    if (config.reportUri) {
      directives.push(`report-uri ${config.reportUri}`);
    }

    if (config.reportTo) {
      directives.push(`report-to ${config.reportTo}`);
    }

    return directives.join('; ');
  }

  /**
   * Build HSTS header
   */
  private buildHSTS(config: boolean | HSTSConfig): string {
    if (config === true) {
      return 'max-age=31536000; includeSubDomains';
    }

    if (config === false) {
      return '';
    }

    // config is now HSTSConfig
    const parts = [`max-age=${config.maxAge}`];

    if (config.includeSubDomains) {
      parts.push('includeSubDomains');
    }

    if (config.preload) {
      parts.push('preload');
    }

    return parts.join('; ');
  }

  /**
   * Build Permissions-Policy header
   */
  private buildPermissionsPolicy(config: string | PermissionsPolicyConfig): string {
    if (typeof config === 'string') {
      return config;
    }

    const policies: string[] = [];

    Object.entries(config).forEach(([feature, origins]) => {
      if (!origins || origins.length === 0) {
        policies.push(`${feature}=()`);
      } else if (origins.includes('*')) {
        policies.push(`${feature}=*`);
      } else {
        const originsList = origins.map((o: string) => `"${o}"`).join(' ');
        policies.push(`${feature}=(${originsList})`);
      }
    });

    return policies.join(', ');
  }

  /**
   * Apply headers to response
   */
  applyHeaders(response: Response): Response {
    const headers = this.getHeaders();

    Object.entries(headers).forEach(([name, value]) => {
      response.headers.set(name, value);
    });

    return response;
  }
}

/**
 * CORS manager
 */
export class CORSManager {
  private config: Required<CORSConfig>;

  constructor(config: CORSConfig = {}) {
    this.config = {
      origin: config.origin ?? [],
      methods: config.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: config.allowedHeaders || ['Content-Type', 'Authorization'],
      exposedHeaders: config.exposedHeaders || [],
      credentials: config.credentials ?? false,
      maxAge: config.maxAge || 86400,
      preflightContinue: config.preflightContinue ?? false,
      optionsSuccessStatus: config.optionsSuccessStatus || 204,
    };
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    const { origin: allowedOrigin } = this.config;

    if (allowedOrigin === '*') {
      return true;
    }

    if (typeof allowedOrigin === 'function') {
      return allowedOrigin(origin);
    }

    if (typeof allowedOrigin === 'string') {
      return origin === allowedOrigin;
    }

    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.includes(origin);
    }

    return false;
  }

  /**
   * Get CORS headers
   */
  getCORSHeaders(origin: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Vary: Origin  -  always set when origin is not '*' so caches
    // don't serve a response allowed for origin A to origin B.
    if (this.config.origin !== '*') {
      headers.Vary = 'Origin';
    }

    // All Access-Control-Allow-* headers must only be sent for allowed origins.
    // Sending them for disallowed origins leaks CORS policy details.
    if (!this.isOriginAllowed(origin)) {
      return headers;
    }

    // Access-Control-Allow-Origin
    headers['Access-Control-Allow-Origin'] = this.config.origin === '*' ? '*' : origin;

    // Access-Control-Allow-Credentials  -  incompatible with origin: '*' per Fetch spec
    if (this.config.credentials && this.config.origin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Access-Control-Expose-Headers
    if (this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ');
    }

    return headers;
  }

  /**
   * Get preflight headers
   */
  getPreflightHeaders(origin: string): Record<string, string> {
    const headers = this.getCORSHeaders(origin);

    // Only include preflight-specific headers when the origin is allowed.
    // getCORSHeaders already returns early (with only Vary) for disallowed origins,
    // so we guard here as well to avoid leaking allowed methods/headers.
    if (!this.isOriginAllowed(origin)) {
      return headers;
    }

    // Access-Control-Allow-Methods
    headers['Access-Control-Allow-Methods'] = this.config.methods.join(', ');

    // Access-Control-Allow-Headers
    headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ');

    // Access-Control-Max-Age
    headers['Access-Control-Max-Age'] = this.config.maxAge.toString();

    return headers;
  }

  /**
   * Handle CORS request
   */
  handleRequest(request: Request): Response | null {
    const origin = request.headers.get('Origin');

    if (!origin) {
      return null;
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return this.handlePreflight(request, origin);
    }

    return null;
  }

  /**
   * Handle preflight request
   */
  handlePreflight(_request: Request, origin: string): Response {
    if (!this.isOriginAllowed(origin)) {
      return new Response(null, { status: 403 });
    }

    const headers = this.getPreflightHeaders(origin);

    return new Response(null, {
      status: this.config.optionsSuccessStatus,
      headers,
    });
  }

  /**
   * Apply CORS headers to response
   */
  applyHeaders(response: Response, origin: string): Response {
    if (!this.isOriginAllowed(origin)) {
      return response;
    }

    const headers = this.getCORSHeaders(origin);

    Object.entries(headers).forEach(([name, value]) => {
      response.headers.set(name, value);
    });

    return response;
  }
}

/**
 * Common security header presets
 */
export const SecurityPresets = {
  /**
   * Strict security (recommended for production)
   */
  strict: (): SecurityHeadersConfig => ({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: true,
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
  }),

  /**
   * Moderate security (balanced)
   */
  moderate: (): SecurityHeadersConfig => ({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      frameAncestors: ["'self'"],
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    xFrameOptions: 'SAMEORIGIN',
    xContentTypeOptions: true,
    referrerPolicy: 'origin-when-cross-origin',
  }),

  /**
   * Development (permissive)
   */
  development: (): SecurityHeadersConfig => ({
    xContentTypeOptions: true,
    referrerPolicy: 'no-referrer-when-downgrade',
  }),
};

/**
 * Common CORS presets
 */
export const CORSPresets = {
  /**
   * Strict CORS (same origin only)
   */
  strict: (): CORSConfig => ({
    origin: [],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),

  /**
   * Moderate CORS (specific origins)
   */
  moderate: (allowedOrigins: string[]): CORSConfig => ({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400,
  }),

  /**
   * Permissive CORS (all origins)  -  development only.
   * Logs a warning if used when NODE_ENV === 'production'.
   */
  permissive: (): CORSConfig => {
    if (process.env.NODE_ENV === 'production') {
      getSecurityLogger().warn(
        '[SecurityPresets] CORS permissive preset used in production  -  this allows all origins. Use moderate() with explicit origins instead.',
      );
    }
    return {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['*'],
      credentials: false,
      maxAge: 86400,
    };
  },

  /**
   * API CORS (public read-only APIs)  -  credentials disabled.
   * Logs a warning if used when NODE_ENV === 'production'.
   */
  api: (): CORSConfig => {
    if (process.env.NODE_ENV === 'production') {
      getSecurityLogger().warn(
        '[SecurityPresets] CORS api preset uses origin:"*". For production, pass explicit origins to moderate() instead.',
      );
    }
    return {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      credentials: false,
      maxAge: 86400,
    };
  },
};

/**
 * Security middleware creator
 */
export function createSecurityMiddleware(
  securityConfig?: SecurityHeadersConfig,
  corsConfig?: CORSConfig,
) {
  const security = new SecurityHeaders(securityConfig);
  const cors = new CORSManager(corsConfig);

  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (origin && request.method === 'OPTIONS') {
      const preflightResponse = cors.handleRequest(request);
      if (preflightResponse) {
        return preflightResponse;
      }
    }

    // Process request
    const response = await next();

    // Apply security headers
    security.applyHeaders(response);

    // Apply CORS headers
    if (origin) {
      cors.applyHeaders(response, origin);
    }

    return response;
  };
}

/**
 * Rate limiting headers
 */
export function setRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  reset: number,
): void {
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', reset.toString());
}
