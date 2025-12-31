"use client";

import type {
	PayloadAdminBarProps,
	PayloadMeUser,
} from "@payloadcms/admin-bar";

import { PayloadAdminBar } from "@payloadcms/admin-bar";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";
import React, { type SetStateAction, useState } from "react";

const collectionLabels = {
	pages: {
		plural: "Pages",
		singular: "Page",
	},
	posts: {
		plural: "Posts",
		singular: "Post",
	},
	projects: {
		plural: "Projects",
		singular: "Project",
	},
};

const Title: React.FC = () => <span>Dashboard</span>;

export const AdminBar: React.FC<{
	adminBarProps?: PayloadAdminBarProps;
}> = (props) => {
	const { adminBarProps } = props || {};
	const segments = useSelectedLayoutSegments();
	const [show, setShow] = useState(false);
	const segmentKey = segments?.[1] as keyof typeof collectionLabels | undefined;
	const collection =
		segmentKey && collectionLabels[segmentKey] ? segmentKey : "pages";

	// const collection = collectionLabels?.[segments?.[1]] ? segments?.[1] : 'pages'
	const router = useRouter();

	const onAuthChange = React.useCallback((user: PayloadMeUser) => {
		return setShow(user?.id as unknown as SetStateAction<boolean>);
	}, []);

	function cn(
		baseClasses: string,
		conditionalClasses: { block: boolean; hidden: boolean },
	): string {
		const classes = [baseClasses];

		Object.entries(conditionalClasses).forEach(([className, condition]) => {
			if (condition) {
				classes.push(className);
			}
		});

		return classes.filter(Boolean).join(" ");
	}

	return (
		<div
			className={cn("py-2 bg-black text-white", {
				block: show,
				hidden: !show,
			})}
		>
			<div className="container">
				<PayloadAdminBar
					{...adminBarProps}
					className="py-2 text-white"
					classNames={{
						controls: "font-medium text-white",
						logo: "text-white",
						user: "text-white",
					}}
					cmsURL={process.env.NEXT_PUBLIC_SERVER_URL}
					{...(collection && {
						collection,
						collectionLabels: {
							plural: collectionLabels[collection]?.plural || "Pages",
							singular: collectionLabels[collection]?.singular || "Page",
						},
					})}
					logo={<Title />}
					onAuthChange={onAuthChange}
					onPreviewExit={() => {
						fetch("/next/exit-preview").then(() => {
							router.push("/");
							router.refresh();
						});
					}}
					style={{
						backgroundColor: "transparent",
						padding: 0,
						position: "relative",
						zIndex: "unset",
					}}
				/>
			</div>
		</div>
	);
};
