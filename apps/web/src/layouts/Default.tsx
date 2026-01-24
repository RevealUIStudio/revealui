import { App } from "revealui/ui/shells";
import "./style.css";

import "./tailwind.css";

import type React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
	return <App>{children}</App>;
}
