import config from "@revealui/config";
import { RootLayout } from "@revealui/core/admin";
/* RevealUI Admin Layout - Local implementation */
import type React from "react";

// TODO: Implement local CSS
// import "revealui/cms/admin/css";
import { importMap } from "./admin/importMap";
import "./custom.css";

type Args = {
	children: React.ReactNode;
};

// Create a server function wrapper for RevealUI CMS
// This is required by RootLayout in RevealUI CMS v3
const serverFunction = async (_name: string, _args: any) => {
	"use server";
	// This will be handled by RevealUI CMS internally
	return Promise.resolve();
};

const Layout = ({ children }: Args) => (
	<RootLayout
		config={config}
		importMap={importMap}
		serverFunction={serverFunction as any}
	>
		{children}
	</RootLayout>
);

export default Layout;
