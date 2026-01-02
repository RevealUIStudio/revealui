import type { Metadata } from "next";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type React from "react";

import { AdminBar } from "@/lib/components/AdminBar";
import { LivePreviewListener } from "@/lib/components/LivePreviewListener";
import { Footer } from "@/lib/globals/Footer/Component";
import { Header } from "@/lib/globals/Header/Component";
import { Providers } from "@/lib/providers";
import { InitTheme } from "@/lib/providers/Theme/InitTheme";
import { mergeOpenGraph } from "@/lib/utilities/mergeOpenGraph";
import { draftMode } from "next/headers";
import "./styles.css";

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isEnabled } = await draftMode();

	function cn(...classNames: (string | undefined)[]): string {
		return classNames.filter(Boolean).join(" ");
	}
	return (
		<html
			className={cn(GeistSans.variable, GeistMono.variable)}
			lang="en"
			suppressHydrationWarning
		>
			<head>
				<InitTheme />
				<link href="/favicon.ico" rel="icon" sizes="32x32" />
				<link href="/favicon.svg" rel="icon" type="image/svg+xml" />
			</head>
			<body>
				<Providers>
					<AdminBar
						adminBarProps={{
							preview: isEnabled,
						}}
					/>
					<LivePreviewListener />

					<Header />
					{children}
					<Footer />
				</Providers>
				{/* Vercel Speed Insights for performance monitoring */}
				{process.env.NEXT_PUBLIC_VERCEL_ENV && (
					<>
						<script
							dangerouslySetInnerHTML={{
								__html: `
                  if (typeof window !== 'undefined') {
                    import('@vercel/speed-insights/next').then(({ SpeedInsights }) => {
                      // Speed Insights will auto-initialize
                    }).catch(() => {});
                  }
                `,
							}}
						/>
					</>
				)}
			</body>
		</html>
	);
}

export const metadata: Metadata = {
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_SERVER_URL || "https://revealui.com",
	),
	openGraph: mergeOpenGraph(),
	twitter: {
		card: "summary_large_image",
		creator: "@RevealUI",
	},
};

// import { Inter } from "next/font/google";
// import React from "react";

// const inter = Inter({
//   subsets: ["latin"],
//   display: "swap",
// });

// /* Our app sits here to not cause any conflicts with RevealUI's root layout  */
// const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   return (
//     <html className={inter.className} lang="en">
//       <body>{children}</body>
//     </html>
//   );
// };

// export default Layout;
