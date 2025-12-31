import Banners from "@/lib/collections/Banners";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { vercelPostgresAdapter } from "@payloadcms/db-vercel-postgres";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs";
import { redirectsPlugin } from "@payloadcms/plugin-redirects";
import {
	BoldFeature,
	FixedToolbarFeature,
	HeadingFeature,
	ItalicFeature,
	lexicalEditor,
	LinkFeature,
	TreeViewFeature,
	UnderlineFeature,
} from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import dotenv from "dotenv";
import path from "path";
import { buildConfig } from "payload";
import { en } from "payload/i18n/en";
import sharp from "sharp";
import { revalidateRedirects } from "src/lib/hooks/revalidateRedirects";
import { fileURLToPath } from "url";
import Cards from "./src/lib/collections/Cards";
import Categories from "./src/lib/collections/Categories";
import Contents from "./src/lib/collections/Contents";
import Events from "./src/lib/collections/Events";
import Heros from "./src/lib/collections/Heros";
import Layouts from "./src/lib/collections/Layouts";
import { Media } from "./src/lib/collections/Media";
import { Orders } from "./src/lib/collections/Orders";
import { Pages } from "./src/lib/collections/Pages/index";
import { Posts } from "./src/lib/collections/Posts";
import Prices from "./src/lib/collections/Prices";
import Products from "./src/lib/collections/Products";
import Subscriptions from "./src/lib/collections/Subscriptions";
import Tags from "./src/lib/collections/Tags";
import { Tenants } from "./src/lib/collections/Tenants";
import Users from "./src/lib/collections/Users";
import { Footer, Header, Settings } from "./src/lib/globals";

// import { ChatGPTAssistant } from "reveal";
// import { EmbedFeature } from "@/features/embed/feature.server";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

dotenv.config({
	path: path.resolve(dirname, "../../.env.development.local"),
});

export default buildConfig({
	serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || "",
	secret: process.env.PAYLOAD_SECRET || "temp-secret-for-build",
	admin: {
		importMap: {
			autoGenerate: true,
			baseDir: path.resolve(dirname),
		},
		user: Users.slug,
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
			url: ({ data, locale }) => {
				return `${data.tenant.url}${
					data.slug === "posts" ? `/posts/${data.slug}` : `/${data.slug}`
				}${locale ? `?locale=${locale?.code}` : ""}`;
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
	graphQL: {
		disable: true,
	},
	cors: process.env.PAYLOAD_WHITELISTORIGINS
		? process.env.PAYLOAD_WHITELISTORIGINS.split(",")
		: [],
	csrf: process.env.PAYLOAD_WHITELISTORIGINS
		? process.env.PAYLOAD_WHITELISTORIGINS.split(",")
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
					// Ensure migrations run automatically
					migrationDir: path.resolve(dirname, "../../.payload/migrations"),
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
					fields: ({ defaultFields }) => {
						const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
							if ("name" in field && field.name === "url") return false;
							return true;
						});

						return [
							...defaultFieldsWithoutUrl,
							{
								name: "url",
								type: "text",
								admin: {
									condition: ({ linkType }) => linkType !== "internal",
								},
								label: ({ t }) => t("fields:enterURL"),
								required: true,
							},
						];
					},
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
				// @ts-expect-error field overrides
				fields: ({ defaultFields }) => {
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
					afterChange: [revalidateRedirects],
				},
			},
		}),
		formBuilderPlugin({
			fields: {
				payment: false,
			},
			formOverrides: {
				fields: ({ defaultFields }) => {
					return defaultFields.map((field) => {
						if ("name" in field && field.name === "confirmationMessage") {
							return {
								...field,
								editor: lexicalEditor({
									features: ({ rootFeatures }) => {
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
	onInit: async (payload) => {
		// Check if any users exist
		const existingUsers = await payload.find({
			collection: "users",
			limit: 1,
			depth: 0,
		});

		// If no users exist, create the first admin user
		if (existingUsers.totalDocs === 0) {
			const defaultEmail =
				process.env.PAYLOAD_ADMIN_EMAIL || "admin@example.com";
			const defaultPassword = process.env.PAYLOAD_ADMIN_PASSWORD || "admin123";

			try {
				await payload.create({
					collection: "users",
					data: {
						email: defaultEmail,
						password: defaultPassword,
						roles: ["user-super-admin"],
					},
				});

				payload.logger.info(`First admin user created: ${defaultEmail}`);
			} catch (error) {
				payload.logger.error(`Failed to create first admin user: ${error}`);
			}
		}
	},
});
