/**
 * Link component - Framework-agnostic link component
 *
 * This is a generic Link component that works with any framework.
 * For framework-specific implementations:
 * - Next.js: Use Next.js Link component (see apps/cms/src/lib/components/Link)
 * - Other frameworks: Wrap this component with your framework's Link
 *
 * See Catalyst documentation for framework-specific examples:
 * https://catalyst.tailwindui.com/docs#client-side-router-integration
 */

import * as Headless from "@headlessui/react";
import type React from "react";
import { forwardRef } from "react";

export const Link = forwardRef(function Link(
	props: { href: string } & React.ComponentPropsWithoutRef<"a">,
	ref: React.ForwardedRef<HTMLAnchorElement>,
) {
	return (
		<Headless.DataInteractive>
			<a {...props} ref={ref} />
		</Headless.DataInteractive>
	);
});
