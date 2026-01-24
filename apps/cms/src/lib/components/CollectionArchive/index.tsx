import type { Post } from "@revealui/core/types/cms";
import type React from "react";
import { cn } from "@/lib/styles/classnames";
import { Card } from "../Card";

export type Props = {
	posts: Post[];
};

export const CollectionArchive: React.FC<Props> = (props) => {
	const { posts } = props;

	return (
		<div className={cn("container")}>
			<div>
				<div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-4 lg:gap-8 xl:gap-x-8">
					{posts?.map((result, index) => {
						if (typeof result === "object" && result !== null) {
							return (
								<div className="col-span-4" key={index}>
									<Card
										className="h-full"
										doc={result}
										relationTo="posts"
										showCategories
									/>
								</div>
							);
						}

						return null;
					})}
				</div>
			</div>
		</div>
	);
};
