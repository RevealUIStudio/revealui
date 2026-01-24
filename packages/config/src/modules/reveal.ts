/**
 * @revealui/config - RevealUI Core Configuration Module
 */

import type { EnvConfig } from "../schema";

export interface RevealConfig {
	secret: string;
	serverURL: string;
	publicServerURL: string;
	adminEmail?: string;
	adminPassword?: string;
	corsOrigins?: string[];
	whitelistOrigins?: string[]; // Deprecated
}

export function getRevealConfig(env: EnvConfig): RevealConfig {
	const corsOrigins = env.REVEALUI_CORS_ORIGINS
		? env.REVEALUI_CORS_ORIGINS.split(",").map((s) => s.trim())
		: undefined;

	const whitelistOrigins = env.REVEALUI_WHITELISTORIGINS
		? env.REVEALUI_WHITELISTORIGINS.split(",").map((s) => s.trim())
		: undefined;

	const config: RevealConfig = {
		secret: env.REVEALUI_SECRET || "",
		serverURL: env.NEXT_PUBLIC_SERVER_URL || "",
		publicServerURL: env.REVEALUI_PUBLIC_SERVER_URL || "",
		corsOrigins: corsOrigins || [],
		whitelistOrigins: whitelistOrigins || [],
	};

	if (env.REVEALUI_ADMIN_EMAIL) {
		config.adminEmail = env.REVEALUI_ADMIN_EMAIL;
	}

	if (env.REVEALUI_ADMIN_PASSWORD) {
		config.adminPassword = env.REVEALUI_ADMIN_PASSWORD;
	}

	return config;
}
