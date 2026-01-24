/**
 * Combined Configuration Types
 *
 * These types combine Zod-validated structure with TypeScript function contracts.
 *
 * Structure (validated by Zod at runtime):
 * - Field names, types, constraints
 * - Admin configuration
 * - Labels, slugs
 *
 * Functions (enforced by TypeScript at compile time):
 * - Access functions
 * - Hook functions
 * - Validation functions
 * - Condition functions
 *
 * @module @revealui/contracts/core/contracts/config
 */

import type { EndpointConfig } from "./functions.js";
import type {
	CollectionStructure,
	FieldStructure,
	GlobalStructure,
} from "./structure.js";

// ============================================
// FIELD TYPE
// ============================================

/**
 * Complete Field type combining structure and functions
 *
 * This is a simplified, non-generic Field type that works with any document type.
 * For typed field definitions, use the TypeScript helper `defineField<T>()`.
 *
 * @example
 * ```typescript
 * // Basic text field
 * const titleField: Field = {
 *   name: 'title',
 *   type: 'text',
 *   required: true,
 * };
 *
 * // Field with hooks
 * const slugField: Field = {
 *   name: 'slug',
 *   type: 'text',
 *   hooks: {
 *     beforeChange: [({ value, siblingData }) => {
 *       return value || String(siblingData?.title)?.toLowerCase().replace(/\s+/g, '-');
 *     }],
 *   },
 * };
 * ```
 */
export interface Field
	extends Omit<FieldStructure, "fields" | "blocks" | "tabs"> {
	// Function properties - using loose types for compatibility with destructured params
	access?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		create?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		read?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		update?: (args: any) => any;
	};
	hooks?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeChange?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterChange?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeRead?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterRead?: Array<(args: any) => any>;
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	validate?: (value: any, args: any) => any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	condition?: (data: any, siblingData: any) => boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	filterOptions?: (args: any) => any;

	// Nested fields (recursive)
	fields?: Field[];

	// Blocks (for blocks field) - any array for maximum compatibility
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	blocks?: any[];

	// Tabs (for tabs field)
	tabs?: Array<{
		label: string;
		name?: string;
		description?: string;
		fields: Field[];
		custom?: Record<string, unknown>;
	}>;

	// Editor (for richText field) - function type
	editor?: unknown;

	// Custom properties for extensibility (without breaking type inference)
	custom?: Record<string, unknown>;
}

// ============================================
// COLLECTION CONFIG TYPE
// ============================================

/**
 * Complete CollectionConfig type combining structure and functions
 *
 * This is a simplified, non-generic CollectionConfig type that works with any document.
 * For typed collection definitions, use the TypeScript helper `defineCollection<T>()`.
 *
 * @example
 * ```typescript
 * const Posts: CollectionConfig = {
 *   slug: 'posts',
 *   fields: [
 *     { name: 'title', type: 'text', required: true },
 *     { name: 'slug', type: 'text', required: true },
 *   ],
 *   access: {
 *     read: () => true,
 *     create: ({ req }) => Boolean(req.user),
 *   },
 *   hooks: {
 *     afterChange: [({ doc }) => {
 *       console.log('Post updated:', doc);
 *       return doc;
 *     }],
 *   },
 * };
 * ```
 */
export interface CollectionConfig extends Omit<CollectionStructure, "fields"> {
	// Schema version
	schemaVersion?: number;
	// Fields with function support
	fields: Field[];

	// Access functions - using loose function types for maximum compatibility
	// Functions can have any signature as long as they return boolean or Where clause
	access?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		create?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		read?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		update?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		admin?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		unlock?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		readVersions?: (args: any) => any;
	};

	// Hooks - using loose function types for maximum compatibility
	// Hook functions can destructure their arguments freely
	hooks?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeOperation?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeValidate?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeChange?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterChange?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeRead?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterRead?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeDelete?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterDelete?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterOperation?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterLogin?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterLogout?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterRefresh?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterMe?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterForgotPassword?: Array<(args: any) => any>;
	};

	endpoints?: EndpointConfig[] | false;

	// Custom properties for extensibility (without breaking type inference)
	custom?: Record<string, unknown>;
}

// ============================================
// GLOBAL CONFIG TYPE
// ============================================

/**
 * Complete GlobalConfig type combining structure and functions
 *
 * This is a simplified, non-generic GlobalConfig type that works with any document.
 * For typed global definitions, use the TypeScript helper `defineGlobal<T>()`.
 *
 * @example
 * ```typescript
 * const Settings: GlobalConfig = {
 *   slug: 'settings',
 *   fields: [
 *     { name: 'siteName', type: 'text', required: true },
 *     { name: 'siteDescription', type: 'textarea' },
 *   ],
 *   access: {
 *     read: () => true,
 *     update: ({ req }) => Boolean(req.user),
 *   },
 * };
 * ```
 */
export interface GlobalConfig extends Omit<GlobalStructure, "fields"> {
	// Schema version
	schemaVersion?: number;
	// Fields with function support
	fields: Field[];

	// Access functions - using loose types for compatibility with destructured params
	access?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		read?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		update?: (args: any) => any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		readVersions?: (args: any) => any;
	};

	// Hooks - using loose types for compatibility with destructured params
	hooks?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeValidate?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeChange?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterChange?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		beforeRead?: Array<(args: any) => any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterRead?: Array<(args: any) => any>;
	};

	endpoints?: EndpointConfig[] | false;

	// Custom properties for extensibility (without breaking type inference)
	custom?: Record<string, unknown>;
}

// ============================================
// CONFIG TYPE (Full CMS Config)
// ============================================

/**
 * Database adapter configuration (simplified)
 */
export interface DatabaseAdapterConfig {
	pool?: unknown;
	idType?: "serial" | "uuid";
	custom?: Record<string, unknown>;
}

/**
 * Email configuration
 */
export interface EmailConfig {
	transportOptions?: unknown;
	fromName?: string;
	fromAddress?: string;
	custom?: Record<string, unknown>;
}

/**
 * Admin panel configuration
 */
export interface AdminConfig {
	user?: string;
	meta?: {
		titleSuffix?: string;
		ogImage?: string;
		favicon?: string;
		// Icons for various platforms
		icons?: Array<{
			url?: string;
			sizes?: string;
			type?: string;
			rel?: string;
			fetchPriority?: "high" | "low" | "auto";
		}>;
	};
	importMap?: {
		autoGenerate?: boolean;
		baseDir?: string;
		custom?: Record<string, unknown>;
	};
	components?: unknown;
	css?: string;
	scss?: string;
	dateFormat?: string;
	avatar?: "default" | "gravatar" | unknown;
	disable?: boolean;
	livePreview?: {
		url?: string | ((args: { data: unknown; locale?: string }) => string);
		collections?: string[];
		globals?: string[];
		breakpoints?: Array<{
			label: string;
			name: string;
			width: number;
			height: number;
		}>;
		custom?: Record<string, unknown>;
	};
	custom?: Record<string, unknown>;
}

/**
 * Localization configuration
 */
export interface LocalizationConfig {
	locales: string[] | Array<{ label: string; code: string }>;
	defaultLocale: string;
	fallback?: boolean;
}

/**
 * Complete RevealUI Config type
 *
 * This is the root configuration passed to buildConfig()
 */
export interface Config {
	// Required
	secret: string;

	// Collections and globals
	collections?: CollectionConfig[];
	globals?: GlobalConfig[];

	// Database - any for maximum compatibility with various adapters
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db?: any;

	// Server
	serverURL?: string;

	// Admin
	admin?: AdminConfig;

	// Email
	email?: EmailConfig;

	// Localization
	localization?: LocalizationConfig | false;

	// i18n (internationalization)
	i18n?: {
		locales?: string[];
		defaultLocale?: string;
		fallback?: boolean;
		supportedLanguages?: Record<string, unknown>;
	};

	// CORS
	cors?: string | string[] | { origins: string[]; headers?: string[] };

	// CSRF
	csrf?: string[];

	// Rate limiting
	rateLimit?: {
		window?: number;
		max?: number;
		trustProxy?: boolean;
		skip?: (req: unknown) => boolean;
	};

	// Uploads
	upload?: {
		limits?: {
			fileSize?: number;
		};
	};

	// Debug
	debug?: boolean;

	// TypeScript
	typescript?: {
		outputFile?: string;
		declare?: boolean;
		autoGenerate?: boolean;
	};

	// Telemetry
	telemetry?: boolean;

	// Hooks
	hooks?: {
		afterError?: Array<
			(args: { error: Error; context: unknown }) => void | Promise<void>
		>;
	};

	// onInit callback - any for maximum compatibility
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onInit?: (revealui: any) => any;

	// Plugins - any for maximum compatibility with plugin signatures
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	plugins?: any[];

	// Editor - lexical, slate, or custom editor configuration
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	editor?: any;

	// Sharp - image processing library configuration
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	sharp?: any;

	// Custom properties for extensibility
	custom?: Record<string, unknown>;
}

/**
 * Sanitized config (after RevealUI processes it)
 * This is what's available at runtime
 */
export interface SanitizedConfig extends Config {
	collections: CollectionConfig[];
	globals: GlobalConfig[];
}

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Typed collection config for advanced type inference
 * Use this when you need TypeScript to know the document type
 */
export interface TypedCollectionConfig<T> extends CollectionConfig {
	// This is a marker interface for typed configs
	__docType?: T;
}

/**
 * Typed global config for advanced type inference
 * Use this when you need TypeScript to know the document type
 */
export interface TypedGlobalConfig<T> extends GlobalConfig {
	// This is a marker interface for typed configs
	__docType?: T;
}

/**
 * Helper to create a typed collection config
 *
 * @example
 * ```typescript
 * interface Post {
 *   id: string;
 *   title: string;
 * }
 *
 * const Posts = defineCollection<Post>({
 *   slug: 'posts',
 *   fields: [{ name: 'title', type: 'text' }],
 * });
 * ```
 */
export function defineCollection<T = unknown>(
	config: CollectionConfig,
): TypedCollectionConfig<T> {
	return config as TypedCollectionConfig<T>;
}

/**
 * Helper to create a typed global config
 */
export function defineGlobal<T = unknown>(
	config: GlobalConfig,
): TypedGlobalConfig<T> {
	return config as TypedGlobalConfig<T>;
}

/**
 * Helper to create a field
 */
export function defineField(field: Field): Field {
	return field;
}
