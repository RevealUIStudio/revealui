import type React from "react";

const BeforeDashboard: React.FC = () => {
	return (
		<div className="bg-scrapBlack relative mx-auto w-full rounded-lg p-8 shadow-md">
			<h1 className="prose-headings text-scrapOrange mb-6 text-3xl font-bold">
				Welcome to the Streetbeefs Scrapyard CMS Dashboard!
			</h1>

			<div className="text-scrapWhite space-y-6 leading-relaxed">
				<p className="prose-p font-normal">
					Manage your content, users, and settings effortlessly for
					<a
						href="https://streetbeefsscrapyard.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-scrapYellow ml-1 space-x-1 brightness-125 hover:underline"
					>
						Streetbeefs Scrapyard website
					</a>{" "}
					or{" "}
					<a
						href="https://jvstudio.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="text-scrapYellow brightness-125 hover:underline"
					>
						contact developer
					</a>
					.
				</p>
				<p className="prose-p font-normal">
					New to the CMS? Start by creating a new page or post. Navigate to the
					“Content” tab in the sidebar and click on the “Add New” button.
				</p>
				<p className="prose-p font-normal">
					To manage users, go to the “Users” tab in the sidebar.
				</p>
				<p className="prose-p font-normal">
					Adjust settings by clicking on the “Settings” tab in the sidebar.
				</p>
			</div>
		</div>
	);
};

export default BeforeDashboard;
