/**
 * Next.js 16 Page Component Template
 *
 * Usage: Create pages in apps/cms/src/app/
 */

import type { Metadata } from "next";

// Required for dynamic pages
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Page Title",
	description: "Page description",
};

type Args = {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ [key: string]: string | string[] }>;
};

export default async function Page({ params, searchParams }: Args) {
	// Await params and searchParams (Next.js 16 requirement)
	const { slug } = await params;
	const search = await searchParams;

	return (
		<div className="container mx-auto">
			<h1>Page Content</h1>
			<p>Slug: {slug}</p>
		</div>
	);
}
