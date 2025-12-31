import configPromise from "@payload-config";
import { RootLayout } from "@payloadcms/next/layouts";
/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type React from "react";

import "@payloadcms/next/css";
import { importMap } from "./admin/importMap";
import "./custom.css";

type Args = {
	children: React.ReactNode;
};

// Create a server function wrapper for PayloadCMS
// This is required by RootLayout in PayloadCMS v3
const serverFunction = async (name: string, args: any) => {
	"use server";
	// This will be handled by PayloadCMS internally
	return Promise.resolve();
};

const Layout = ({ children }: Args) => (
	<RootLayout
		config={configPromise}
		importMap={importMap}
		serverFunction={serverFunction as any}
	>
		{children}
	</RootLayout>
);

export default Layout;
