import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Command-line argument parsing for Cursor
const args = process.argv.slice(2);
const commandArgs = {
	pageName: args.find((arg) => arg.startsWith("--name="))?.split("=")[1],
	route: args.find((arg) => arg.startsWith("--route="))?.split("=")[1],
	template:
		args.find((arg) => arg.startsWith("--template="))?.split("=")[1] ||
		"landing",
	includeMCP: !args.includes("--no-mcp"),
};

async function main() {
	console.log("🚀 RevealUI Page Scaffolder");
	console.log("========================\n");

	// Get user input either from args or interactive prompts
	let pageName = commandArgs.pageName;
	let route = commandArgs.route;
	let includeMCP = commandArgs.includeMCP;
	let template = commandArgs.template;

	if (!pageName) {
		pageName = await promptInput("Enter page name (e.g., Dashboard): ");
	}

	if (!route) {
		route = await promptInput("Enter route path (e.g., /dashboard): ");
	}

	if (pageName && route && !commandArgs.pageName) {
		// Only show these prompts if we're in interactive mode
		includeMCP = await promptConfirm(
			"Include MCP features (Vercel/Stripe)?",
			true,
		);
		template = await promptSelect("Choose template:", [
			{ label: "Landing Page", value: "landing" },
			{ label: "Dashboard", value: "dashboard" },
			{ label: "Profile", value: "profile" },
			{ label: "Settings", value: "settings" },
		]);
	}

	if (!pageName || !route) {
		console.error("❌ Page name and route are required");
		console.log("\nUsage:");
		console.log(
			'  pnpm scaffold:page --name="Dashboard" --route="/dashboard" [--template=dashboard] [--no-mcp]',
		);
		process.exit(1);
	}

	// Generate page component
	const pagePath = join(
		process.cwd(),
		"apps/web/src/app",
		route.slice(1),
		"page.tsx",
	);
	const componentDir = dirname(pagePath);

	// Ensure directory exists
	mkdirSync(componentDir, { recursive: true });

	// Generate the page content based on template and options
	const pageContent = generatePageContent(
		pageName,
		route,
		includeMCP,
		template,
	);

	writeFileSync(pagePath, pageContent);

	// Generate types if needed
	if (includeMCP) {
		generateTypes(pageName, route);
	}

	console.log(`✅ Successfully created page: ${pageName}`);
	console.log(`📁 Location: ${pagePath}`);
	console.log(`🔗 Route: ${route}`);
	console.log(`🎨 Template: ${template}`);
	console.log(`🔧 MCP Features: ${includeMCP ? "Enabled" : "Disabled"}`);

	if (includeMCP) {
		console.log("\n📋 MCP Features included:");
		console.log("  • Vercel deployment integration");
		console.log("  • Stripe payment processing");
		console.log("  • Visual development hooks");
	}

	console.log(
		"\n🎉 Page scaffolded successfully! Run `pnpm dev` to see your new page.",
	);
}

// Export for Cursor command system
export const command = {
	name: "revealui:scaffold-page",
	description:
		"Scaffold a new RevealUI page with MCP integrations and visual development features",
	args: [
		{
			name: "name",
			description: "Page name (e.g., Dashboard)",
			required: false,
		},
		{
			name: "route",
			description: "Route path (e.g., /dashboard)",
			required: false,
		},
		{
			name: "template",
			description: "Template type (landing|dashboard|profile|settings)",
			required: false,
		},
		{ name: "no-mcp", description: "Disable MCP features", required: false },
	],
	run: main,
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}

// Helper functions
async function promptInput(question: string): Promise<string> {
	const { createInterface } = await import("node:readline");
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function promptConfirm(
	question: string,
	defaultValue: boolean = true,
): Promise<boolean> {
	const { createInterface } = await import("node:readline");
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const defaultText = defaultValue ? "(Y/n)" : "(y/N)";

	return new Promise((resolve) => {
		rl.question(`${question} ${defaultText}: `, (answer) => {
			rl.close();
			const normalized = answer.toLowerCase().trim();
			if (normalized === "") {
				resolve(defaultValue);
			} else {
				resolve(normalized === "y" || normalized === "yes");
			}
		});
	});
}

async function promptSelect(
	question: string,
	options: Array<{ label: string; value: string }>,
): Promise<string> {
	const { createInterface } = await import("node:readline");
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log(`\n${question}`);
	options.forEach((option, index) => {
		console.log(`  ${index + 1}. ${option.label}`);
	});

	return new Promise((resolve) => {
		rl.question("\nEnter choice (number): ", (answer) => {
			rl.close();
			const choice = parseInt(answer.trim(), 10);
			if (choice >= 1 && choice <= options.length) {
				resolve(options[choice - 1].value);
			} else {
				console.log("Invalid choice, defaulting to Landing Page");
				resolve("landing");
			}
		});
	});
}

function generatePageContent(
	pageName: string,
	_route: string,
	includeMCP: boolean,
	template: string,
): string {
	const pascalCaseName = pageName.replace(/(^\w|-\w)/g, (match) =>
		match.replace("-", "").toUpperCase(),
	);

	let imports = `import { Metadata } from 'next'\n`;

	if (includeMCP) {
		imports += `import { MCPDemo } from '@/components/MCPDemo'\n`;
	}

	let content = `export const metadata: Metadata = {
  title: '${pageName} | RevealUI',
  description: '${pageName} page built with RevealUI visual development framework',
}

export default function ${pascalCaseName}Page() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            ${pageName}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Welcome to your new ${pageName.toLowerCase()} page, built with RevealUI's visual development framework.
          </p>
        </div>`;

	// Add template-specific content
	switch (template) {
		case "dashboard":
			content += generateDashboardContent(includeMCP);
			break;
		case "profile":
			content += generateProfileContent(includeMCP);
			break;
		case "settings":
			content += generateSettingsContent(includeMCP);
			break;
		default:
			content += generateLandingContent(includeMCP);
	}

	content += `
      </div>
    </div>
  )
}`;

	return `${imports}\n${content}`;
}

function generateLandingContent(includeMCP: boolean): string {
	let content = `
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-12 h-12 bg-blue-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl">🚀</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Fast Development</h3>
            <p className="text-gray-600">
              Build applications quickly with RevealUI's visual development tools.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-12 h-12 bg-green-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl">🔧</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">MCP Integration</h3>
            <p className="text-gray-600">
              Seamlessly integrate with Vercel and Stripe through Model Context Protocol.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-12 h-12 bg-purple-500 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white font-bold text-xl">🎨</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Visual First</h3>
            <p className="text-gray-600">
              Design and develop with visual tools that make development accessible to everyone.
            </p>
          </div>
        </div>`;

	if (includeMCP) {
		content += `
        <div className="bg-white rounded-lg shadow-lg p-8">
          <MCPDemo />
        </div>`;
	}

	return content;
}

function generateDashboardContent(includeMCP: boolean): string {
	let content = `
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                📊
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Deployments</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                🚀
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">$2,400</p>
              </div>
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                💰
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Users</p>
                <p className="text-2xl font-bold text-gray-900">1,234</p>
              </div>
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                👥
              </div>
            </div>
          </div>
        </div>`;

	if (includeMCP) {
		content += `
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">MCP Integrations</h2>
          <MCPDemo />
        </div>`;
	}

	return content;
}

function generateProfileContent(includeMCP: boolean): string {
	let content = `
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl">👤</span>
              </div>
              <h2 className="text-2xl font-bold">John Doe</h2>
              <p className="text-gray-600">Developer</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  defaultValue="john.doe@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  defaultValue="Passionate developer building the future of web development with RevealUI."
                />
              </div>

              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                Save Profile
              </button>
            </div>
          </div>
        </div>`;

	if (includeMCP) {
		content += `
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold mb-4">Payment Settings</h3>
            <MCPDemo />
          </div>
        </div>`;
	}

	return content;
}

function generateSettingsContent(includeMCP: boolean): string {
	let content = `
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Notifications</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" defaultChecked />
                    <span>Email notifications</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span>Push notifications</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" defaultChecked />
                    <span>Deployment updates</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Privacy</h3>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" defaultChecked />
                    <span>Profile visibility</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3" />
                    <span>Analytics tracking</span>
                  </label>
                </div>
              </div>

              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                Save Settings
              </button>
            </div>
          </div>
        </div>`;

	if (includeMCP) {
		content += `
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold mb-4">Integration Settings</h3>
            <MCPDemo />
          </div>
        </div>`;
	}

	return content;
}

function generateTypes(pageName: string, route: string) {
	const pascalCaseName = pageName.replace(/(^\w|-\w)/g, (match) =>
		match.replace("-", "").toUpperCase(),
	);
	const typesDir = join(process.cwd(), "apps/web/src/lib/types");

	// Ensure types directory exists
	mkdirSync(typesDir, { recursive: true });

	const typesContent = `/**
 * Types for ${pageName} page
 */

export interface ${pascalCaseName}PageProps {
  searchParams?: Record<string, string | string[] | undefined>
}

export interface ${pascalCaseName}Data {
  id: string
  title: string
  description: string
  createdAt: Date
  updatedAt: Date
}

export interface ${pascalCaseName}MCPConfig {
  vercelEnabled: boolean
  stripeEnabled: boolean
  openaiEnabled: boolean
}

export type ${pascalCaseName}Template = 'landing' | 'dashboard' | 'profile' | 'settings'
`;

	const typesPath = join(typesDir, `${route.slice(1).replace(/\//g, "-")}.ts`);
	writeFileSync(typesPath, typesContent);
	console.log(`📝 Generated types: ${typesPath}`);
}
