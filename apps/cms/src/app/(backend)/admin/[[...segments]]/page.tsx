import config from "@reveal-config";
// import { RootPage } from "@revealui/cms/admin";
// import { importMap } from "../importMap";

// Force dynamic rendering to prevent build-time initialization
export const dynamic = "force-dynamic";
export const dynamicParams = true;

type Args = {
	params: Promise<{
		segments: string[];
	}>;
	searchParams: Promise<{
		[key: string]: string | string[];
	}>;
};

// Simple admin page for now
const Page = ({ params, searchParams }: Args) => {
	const collections = config.collections || [];
	const globals = config.globals || [];

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-4">
						<div className="flex items-center">
							<h1 className="text-2xl font-bold text-gray-900">RevealUI Admin</h1>
						</div>
						<div className="flex items-center space-x-4">
							<span className="text-sm text-gray-500">v0.1.0</span>
						</div>
					</div>
				</div>
			</header>

			<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
				<div className="px-4 py-6 sm:px-0">
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{/* Collections */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
										</svg>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">Collections</dt>
											<dd className="text-lg font-medium text-gray-900">{collections.length}</dd>
										</dl>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-5 py-3">
								<div className="text-sm">
									{collections.length > 0 ? (
										<ul className="space-y-1">
											{collections.map((collection: any) => (
												<li key={collection.slug} className="text-gray-600">
													<span className="font-medium">{collection.slug}</span>
													<span className="ml-2 text-xs text-gray-400">({collection.fields?.length || 0} fields)</span>
												</li>
											))}
										</ul>
									) : (
										<p className="text-gray-500">No collections configured</p>
									)}
								</div>
							</div>
						</div>

						{/* Globals */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
										</svg>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">Globals</dt>
											<dd className="text-lg font-medium text-gray-900">{globals.length}</dd>
										</dl>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-5 py-3">
								<div className="text-sm">
									{globals.length > 0 ? (
										<ul className="space-y-1">
											{globals.map((global: any) => (
												<li key={global.slug} className="text-gray-600">
													<span className="font-medium">{global.slug}</span>
													<span className="ml-2 text-xs text-gray-400">({global.fields?.length || 0} fields)</span>
												</li>
											))}
										</ul>
									) : (
										<p className="text-gray-500">No globals configured</p>
									)}
								</div>
							</div>
						</div>

						{/* System Status */}
						<div className="bg-white overflow-hidden shadow rounded-lg">
							<div className="p-5">
								<div className="flex items-center">
									<div className="flex-shrink-0">
										<div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
											<svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
											</svg>
										</div>
									</div>
									<div className="ml-5 w-0 flex-1">
										<dl>
											<dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
											<dd className="text-lg font-medium text-gray-900">Operational</dd>
										</dl>
									</div>
								</div>
							</div>
							<div className="bg-gray-50 px-5 py-3">
								<div className="text-sm text-gray-600">
									RevealUI CMS is running successfully with {collections.length} collections and {globals.length} globals configured.
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
};

export default Page;

// /* RevealUI Admin Page - Legacy */
// import config from "@reveal-config";
// /* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
// // TODO: Implement local alternative
// import // @revealui/cms";
// import { importMap } from "../importMap";

// type Args = {
//   params: {
//     segments: string[];
//   };
//   searchParams: {
//     [key: string]: string | string[];
//   };
// };

// const Page = ({ params, searchParams }: Args) =>
//   RootPage({ config, params, searchParams, importMap });

// export default Page;
