import Banners from "@/lib/collections/Banners";
import { sqliteAdapter, vercelPostgresAdapter } from "@revealui/cms/database";
import { formBuilderPlugin } from "@revealui/cms/plugins";
import { nestedDocsPlugin } from "@revealui/cms/plugins";
import { redirectsPlugin } from "@revealui/cms/plugins";
import {
	BoldFeature,
	FixedToolbarFeature,
	HeadingFeature,
	ItalicFeature,
	lexicalEditor,
	LinkFeature,
	TreeViewFeature,
	UnderlineFeature,
} from "@revealui/cms/richtext";
import { vercelBlobStorage } from "@revealui/cms/storage";
import dotenv from "dotenv";
import path from "path";
import { buildConfig } from "@revealui/cms";
import { en } from "@revealui/cms/admin";
import sharp from "sharp";
import { revalidateRedirects } from "@/lib/hooks/revalidateRedirects";
import { fileURLToPath } from "url";
import Cards from "@/lib/collections/Cards";
import Categories from "@/lib/collections/Categories";
import Contents from "@/lib/collections/Contents";
import Events from "@/lib/collections/Events";
import Heros from "@/lib/collections/Heros";
import Layouts from "@/lib/collections/Layouts";
import { Media } from "@/lib/collections/Media";
import { Orders } from "@/lib/collections/Orders";
import { Pages } from "@/lib/collections/Pages/index";
import { Posts } from "@/lib/collections/Posts";
import Prices from "@/lib/collections/Prices";
import Products from "@/lib/collections/Products";
import Subscriptions from "@/lib/collections/Subscriptions";
import Tags from "@/lib/collections/Tags";
import { Tenants } from "@/lib/collections/Tenants";
import Users from "@/lib/collections/Users";
import { Footer, Header, Settings } from "@/lib/globals";
import { Tenant } from "@/types";

// import { ChatGPTAssistant } from "reveal";
// import { EmbedFeature } from "@/features/embed/feature.server";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

dotenv.config({
	path: path.resolve(dirname, "../../.env.development.local"),
});

// Validate required environment variables at startup
const getRequiredEnv = (name: string, fallbackForBuild?: string): string => {
	const value = process.env[name];
	if (!value) {
		if (fallbackForBuild && process.env.NODE_ENV !== "production") {
			console.warn(`Warning: ${name} not set, using fallback for development/build`);
			return fallbackForBuild;
		}
		throw new Error(`Required environment variable ${name} is not set`);
	}
	return value;
};

export default buildConfig({
	serverURL: process.env.REVEALUI_PUBLIC_SERVER_URL || "",
	// Secret is required in production, use dev fallback only for builds
	secret: getRequiredEnv("REVEALUI_SECRET", "dev-secret-change-in-production"),
	admin: {
		importMap: {
			autoGenerate: true,
			baseDir: path.resolve(dirname),
		},
		user: Users.slug as string,
		components: {
			beforeNavLinks: ["@/lib/components/BeforeDashboard"],
			beforeDashboard: ["@/lib/components/Agent"],
			beforeLogin: ["@/lib/components/BeforeLogin"],
			graphics: {
				Icon: "@/lib/components/Icon",
				Logo: "@/lib/components/Logo",
			},
		},
		meta: {
			titleSuffix: "- Streetbeefs Scrapyard",
			icons: [
				{
					url: "https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp",
					sizes: "32x32",
					type: "image/webp",
				},
			],
		},
		livePreview: {
			url: ({ data, locale }: { data: unknown; locale?: string }) => {
				const typedData = data as { tenant?: { domains?: Array<{ domain: string }> }; slug?: string }
				return `${typedData.tenant?.domains?.[0]?.domain || ''}${
					typedData.slug === "posts" ? `/posts/${typedData.slug}` : `/${typedData.slug || ''}`
				}${locale ? `?locale=${locale}` : ""}`;
			},
			collections: ["pages"],
			breakpoints: [
				{
					label: "Mobile",
					name: "mobile",
					width: 375,
					height: 667,
				},
				{
					label: "Tablet",
					name: "tablet",
					width: 768,
					height: 1024,
				},
				{
					label: "Desktop",
					name: "desktop",
					width: 1440,
					height: 900,
				},
			],
		},
	},
	localization: {
		locales: ["en", "es", "de"],
		defaultLocale: "en",
		fallback: true,
	},
	globals: [Settings, Header, Footer],
	
	cors: process.env.REVEALUI_WHITELISTORIGINS
		? process.env.REVEALUI_WHITELISTORIGINS.split(",")
		: [],
	csrf: process.env.REVEALUI_WHITELISTORIGINS
		? process.env.REVEALUI_WHITELISTORIGINS.split(",")
		: [],
	typescript: {
		autoGenerate: true,
		outputFile: path.resolve(dirname, "src/types/payload.ts"),
	},
	// Use SQLite for build/dev when Postgres is not available, Postgres for production
	db:
		process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI
			? vercelPostgresAdapter({
					pool: {
						connectionString:
							process.env.POSTGRES_URL ||
							process.env.SUPABASE_DATABASE_URI ||
							"",
					},
				})
			: sqliteAdapter({
					client: {
						url: path.resolve(dirname, "../../.payload/cache/payload.db"),
					},
				}),
	i18n: {
		supportedLanguages: { en },
	},
	editor: lexicalEditor({
		features: ({ defaultFeatures }) => {
			return [
				...defaultFeatures,
				FixedToolbarFeature(),
				// EmbedFeature(),
				TreeViewFeature(),
				UnderlineFeature(),
				BoldFeature(),
				ItalicFeature(),
				LinkFeature({
					enabledCollections: ["pages", "posts"],
				}),
			];
		},
	}),

	sharp,

	plugins: [
		vercelBlobStorage({
			enabled: true,
			collections: {
				media: true,
			},
			token: process.env.BLOB_READ_WRITE_TOKEN || "",
		}),
		nestedDocsPlugin({
			collections: ["categories"],
		}),
		redirectsPlugin({
			collections: ["pages", "posts"],
			overrides: {
				fields: ({ defaultFields }: { defaultFields: any[] }) => {
					return defaultFields.map((field) => {
						if ("name" in field && field.name === "from") {
							return {
								...field,
								admin: {
									description:
										"You will need to rebuild the website when changing this field.",
								},
							};
						}
						return field;
					});
				},
				hooks: {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					afterChange: [revalidateRedirects as any],
				},
			},
		}),
		formBuilderPlugin({
			fields: {
				payment: false,
			},
			formOverrides: {
				fields: ({ defaultFields }: { defaultFields: any[] }) => {
					return defaultFields.map((field: any) => {
						if ("name" in field && field.name === "confirmationMessage") {
							return {
								...field,
								editor: lexicalEditor({
									features: ({ rootFeatures }: { rootFeatures: any[] }) => {
										return [
											...rootFeatures,
											FixedToolbarFeature(),
											HeadingFeature({
												enabledHeadingSizes: ["h1", "h2", "h3", "h4"],
											}),
										];
									},
								}),
							};
						}
						return field;
					});
				},
			},
		}),
	],
	collections: [
		Users,
		Tenants,
		Pages,
		Media,
		Layouts,
		Contents,
		Categories,
		Tags,
		Events,
		Cards,
		Heros,
		Products,
		Prices,
		Orders,
		Posts,
		Subscriptions,
		Banners,
	],
	// Programmatically create first user on initialization if none exists
	onInit: async (payload: { find: Function; create: Function; logger: { info: Function; error: Function; warn: Function } }) => {
		// Check if any users exist
		const existingUsers = await payload.find({
			collection: "users",
			limit: 1,
			depth: 0,
		});

		// If no users exist, create the first admin user
		if (existingUsers.totalDocs === 0) {
			const adminEmail = process.env.REVEALUI_ADMIN_EMAIL;
			const adminPassword = process.env.REVEALUI_ADMIN_PASSWORD;

			// SECURITY: Require credentials from environment - no hardcoded defaults
			if (!adminEmail || !adminPassword) {
				payload.logger.warn(
					"No users exist. Set REVEALUI_ADMIN_EMAIL and REVEALUI_ADMIN_PASSWORD environment variables to create initial admin user."
				);
				return;
			}

			// Validate password strength
			if (adminPassword.length < 12) {
				payload.logger.error(
					"REVEALUI_ADMIN_PASSWORD must be at least 12 characters. Initial admin user not created."
				);
				return;
			}

			try {
				await payload.create({
					collection: "users",
					data: {
						email: adminEmail,
						password: adminPassword,
						roles: ["user-super-admin"],
					},
				});

				payload.logger.info(`First admin user created: ${adminEmail}`);
			} catch (error) {
				payload.logger.error(`Failed to create first admin user: ${error}`);
			}
		}
	},
});
