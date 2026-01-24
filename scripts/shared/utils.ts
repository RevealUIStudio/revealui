/**
 * Shared utilities for cross-platform script execution
 * Provides consistent logging, error handling, and platform detection
 */

export interface ScriptResult {
	success: boolean;
	message: string;
	exitCode: number;
}

export interface Logger {
	success: (message: string) => void;
	error: (message: string) => void;
	warning: (message: string) => void;
	info: (message: string) => void;
	header: (message: string) => void;
}

/**
 * Cross-platform logger with colored output
 */
export function createLogger(): Logger {
	// Check for color support more accurately
	// Windows 10+ supports ANSI colors, check FORCE_COLOR or TERM
	const forceColor =
		process.env.FORCE_COLOR !== "0" && process.env.FORCE_COLOR !== "false";
	const hasTerm = process.env.TERM && process.env.TERM !== "dumb";
	const isTTY = process.stdout.isTTY;
	const supportsColor =
		forceColor || (isTTY && (hasTerm || process.platform === "win32"));

	const colors = {
		reset: supportsColor ? "\x1b[0m" : "",
		red: supportsColor ? "\x1b[31m" : "",
		green: supportsColor ? "\x1b[32m" : "",
		yellow: supportsColor ? "\x1b[33m" : "",
		blue: supportsColor ? "\x1b[34m" : "",
		cyan: supportsColor ? "\x1b[36m" : "",
	};

	return {
		success: (message: string) => {
			console.log(`${colors.green}✅ ${message}${colors.reset}`);
		},
		error: (message: string) => {
			console.error(`${colors.red}❌ ${message}${colors.reset}`);
		},
		warning: (message: string) => {
			console.warn(`${colors.yellow}⚠️  ${message}${colors.reset}`);
		},
		info: (message: string) => {
			console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
		},
		header: (message: string) => {
			const line = "=".repeat(Math.min(message.length + 4, 80));
			console.log("");
			console.log(`${colors.cyan}${line}${colors.reset}`);
			console.log(`${colors.cyan}${message}${colors.reset}`);
			console.log(`${colors.cyan}${line}${colors.reset}`);
		},
	};
}

/**
 * Execute a command and return the result
 */
export async function execCommand(
	command: string,
	args: string[],
	options: {
		cwd?: string;
		env?: NodeJS.ProcessEnv;
		silent?: boolean;
		stdin?: string;
	} = {},
): Promise<ScriptResult> {
	const { spawn } = await import("node:child_process");

	return new Promise((resolve) => {
		const stdioConfig: ("pipe" | "inherit" | "ignore")[] = options.stdin
			? [
					"pipe",
					options.silent ? "pipe" : "inherit",
					options.silent ? "pipe" : "inherit",
				]
			: options.silent
				? ["ignore", "pipe", "pipe"]
				: ["inherit", "inherit", "inherit"];

		const child = spawn(command, args, {
			cwd: options.cwd || process.cwd(),
			env: { ...process.env, ...options.env },
			stdio: stdioConfig,
			shell: process.platform === "win32",
		});

		let _stdout = "";
		let stderr = "";

		if (options.stdin) {
			child.stdin?.write(options.stdin);
			child.stdin?.end();
		}

		if (stdioConfig[1] === "pipe") {
			child.stdout?.on("data", (data) => {
				_stdout += data.toString();
			});
		}

		if (stdioConfig[2] === "pipe") {
			child.stderr?.on("data", (data) => {
				stderr += data.toString();
			});
		}

		child.on("close", (code) => {
			resolve({
				success: code === 0,
				message: code === 0 ? "Command succeeded" : stderr || "Command failed",
				exitCode: code || 1,
			});
		});

		child.on("error", (error) => {
			resolve({
				success: false,
				message: error.message,
				exitCode: 1,
			});
		});
	});
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
	const { exec } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execAsync = promisify(exec);

	try {
		if (process.platform === "win32") {
			await execAsync(`where ${command}`);
		} else {
			await execAsync(`which ${command}`);
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Read environment variable with fallback
 */
export function getEnv(key: string, fallback?: string): string | undefined {
	return process.env[key] || fallback;
}

/**
 * Require environment variable or exit
 */
export function requireEnv(key: string, fallbackKey?: string): string {
	const value =
		process.env[key] || (fallbackKey ? process.env[fallbackKey] : undefined);
	if (!value) {
		const logger = createLogger();
		logger.error(`Required environment variable ${key} is not set`);
		if (fallbackKey) {
			logger.error(`Also checked: ${fallbackKey}`);
		}
		process.exit(1);
	}
	return value;
}

/**
 * Check if file exists
 */
export async function fileExists(path: string): Promise<boolean> {
	const { access } = await import("node:fs/promises");
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read file as string
 */
export async function readFile(path: string): Promise<string> {
	const { readFile } = await import("node:fs/promises");
	return await readFile(path, "utf-8");
}

/**
 * Write file
 */
export async function writeFile(path: string, content: string): Promise<void> {
	const { writeFile } = await import("node:fs/promises");
	await writeFile(path, content, "utf-8");
}

/**
 * Get project root directory from a script file
 * Pass import.meta.url from the calling script
 * Calculates from the calling script's location, not from utils.ts
 */
export async function getProjectRoot(importMetaUrl: string): Promise<string> {
	const { dirname, resolve } = await import("node:path");
	const { fileURLToPath } = await import("node:url");
	const { access } = await import("node:fs/promises");
	const __filename = fileURLToPath(importMetaUrl);
	const __dirname = dirname(__filename);

	// Calculate from calling script: scripts/validation/script.ts -> scripts -> root
	// Or: scripts/database/script.ts -> scripts -> root
	// Go up until we find package.json or reach reasonable depth
	let currentDir = __dirname;

	for (let i = 0; i < 5; i++) {
		const packageJsonPath = resolve(currentDir, "package.json");
		try {
			await access(packageJsonPath);
			return currentDir;
		} catch {
			// File doesn't exist, continue up
		}
		currentDir = resolve(currentDir, "..");
	}

	// Fallback: assume scripts/ is 2 levels up from calling script
	return resolve(__dirname, "../..");
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
	condition: () => Promise<boolean>,
	options: {
		timeout?: number;
		interval?: number;
		message?: string;
	} = {},
): Promise<boolean> {
	const { timeout = 30000, interval = 1000, message } = options;
	const start = Date.now();

	while (Date.now() - start < timeout) {
		if (await condition()) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, interval));
	}

	if (message) {
		const logger = createLogger();
		logger.error(`Timeout: ${message}`);
	}
	return false;
}

/**
 * Prompt user for input (cross-platform)
 */
export async function prompt(
	question: string,
	defaultValue?: string,
): Promise<string> {
	const { createInterface } = await import("node:readline");
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		const promptText = defaultValue
			? `${question} [${defaultValue}]: `
			: `${question}: `;
		rl.question(promptText, (answer) => {
			rl.close();
			resolve(answer.trim() || defaultValue || "");
		});
	});
}

/**
 * Confirm action with user
 */
export async function confirm(
	question: string,
	defaultValue = false,
): Promise<boolean> {
	const answer = await prompt(
		`${question} (${defaultValue ? "Y/n" : "y/N"})`,
		defaultValue ? "y" : "n",
	);
	return answer.toLowerCase().startsWith("y");
}

/**
 * Standardized error handling for scripts
 * Wraps async functions with consistent error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	errorMessage?: string,
): T {
	return (async (...args: Parameters<T>) => {
		try {
			return await fn(...args);
		} catch (error) {
			const logger = createLogger();
			const message =
				errorMessage ||
				`Script failed: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			if (error instanceof Error && error.stack) {
				logger.error(`Stack trace: ${error.stack}`);
			}
			process.exit(1);
		}
	}) as T;
}

/**
 * Standardized error handling for AST parsing operations
 * Logs warnings but allows script to continue processing other files
 */
export function handleASTParseError(
	filePath: string,
	error: unknown,
	logger: Logger,
): void {
	const errorMessage = error instanceof Error ? error.message : String(error);
	logger.warning(`Failed to parse AST for ${filePath}: ${errorMessage}`);
}

/**
 * Execute command with retry logic
 */
export async function execCommandWithRetry(
	command: string,
	args: string[],
	options: {
		cwd?: string;
		env?: NodeJS.ProcessEnv;
		silent?: boolean;
		stdin?: string;
		retries?: number;
		retryDelay?: number;
	} = {},
): Promise<ScriptResult> {
	const { retries = 3, retryDelay = 1000 } = options;
	let lastError: ScriptResult | null = null;

	for (let attempt = 1; attempt <= retries; attempt++) {
		const result = await execCommand(command, args, options);

		if (result.success) {
			return result;
		}

		lastError = result;

		if (attempt < retries) {
			const logger = createLogger();
			logger.warning(
				`Command failed (attempt ${attempt}/${retries}), retrying in ${retryDelay}ms...`,
			);
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	return (
		lastError || {
			success: false,
			message: "Command failed after all retries",
			exitCode: 1,
		}
	);
}

/**
 * Check if a Node.js package is installed
 *
 * @param packageName - Name of the package to check
 * @param projectRoot - Optional: Project root directory. If not provided, uses current working directory approach
 * @returns true if package is installed, false otherwise
 */
export async function packageInstalled(
	packageName: string,
	projectRoot?: string,
): Promise<boolean> {
	// First try to import the package directly (works if it's in node_modules)
	try {
		await import(packageName);
		return true;
	} catch {
		// Import failed, check if package exists in node_modules
		const { access } = await import("node:fs/promises");
		const { resolve } = await import("node:path");

		// If projectRoot provided, use it. Otherwise, try to find project root from current working directory
		let root = projectRoot;
		if (!root) {
			// Try to find project root by looking for node_modules from current working directory
			const { cwd } = await import("node:process");
			let currentDir = cwd();

			// Walk up from current directory to find node_modules
			for (let i = 0; i < 5; i++) {
				const nodeModulesPath = resolve(currentDir, "node_modules");
				try {
					await access(nodeModulesPath);
					root = currentDir;
					break;
				} catch {
					// Continue up
				}
				currentDir = resolve(currentDir, "..");
			}

			// Fallback: use current working directory
			if (!root) {
				root = cwd();
			}
		}

		const packagePath = resolve(root, "node_modules", packageName);
		try {
			await access(packagePath);
			return true;
		} catch {
			return false;
		}
	}
}

/**
 * Validate that required packages are installed
 * Exits with error message if any are missing
 *
 * @param packages - Array of package names to check
 * @param options - Configuration options
 * @param importMetaUrl - Optional: import.meta.url from calling script for accurate project root detection
 */
export async function validateDependencies(
	packages: string[],
	options: {
		installCommand?: string;
		customMessage?: (missing: string[]) => string;
		projectRoot?: string;
		importMetaUrl?: string;
	} = {},
): Promise<void> {
	const logger = createLogger();
	const missing: string[] = [];

	// Get project root from calling script if provided, otherwise use current working directory approach
	const projectRoot =
		options.projectRoot ||
		(options.importMetaUrl
			? await getProjectRoot(options.importMetaUrl)
			: await getProjectRoot(import.meta.url));

	for (const pkg of packages) {
		const installed = await packageInstalled(pkg, projectRoot);
		if (!installed) {
			missing.push(pkg);
		}
	}

	if (missing.length > 0) {
		const message =
			options.customMessage?.(missing) ||
			`Missing required packages: ${missing.join(", ")}\n` +
				(options.installCommand
					? `Install with: ${options.installCommand}`
					: `Install missing packages and try again.`);
		logger.error(message);
		process.exit(1);
	}
}
