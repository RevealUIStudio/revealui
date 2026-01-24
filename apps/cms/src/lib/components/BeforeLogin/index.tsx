import type React from "react";

const BeforeLogin: React.FC = () => {
	return (
		<div className="bg-scrapBlack rounded-xl p-6 shadow-lg">
			<p className="mb-4 text-2xl font-bold">
				Welcome to the Streetbeefs Scrapyard CMS Dashboard!
			</p>
			<p className="text-lg">
				This is where site admins can log in to manage the content, users, and
				settings that power the Streetbeefs Scrapyard website. If you are a
				customer looking to access your account, view order history, or explore
				more features, please
				<a
					className="text-scrapYellow ml-1 underline"
					href={`${process.env.VITE_PUBLIC_URL}/login`}
				>
					log in to the site
				</a>
				.
			</p>
		</div>
	);
};

export default BeforeLogin;
