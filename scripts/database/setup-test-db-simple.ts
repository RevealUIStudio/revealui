#!/usr/bin/env tsx

/**
 * Simple Test Database Setup
 * Cross-platform replacement for setup-test-db-simple.sh
 * Creates tables directly via Docker exec (bypasses migration script issues)
 */

import {
	commandExists,
	createLogger,
	execCommand,
	getProjectRoot,
	waitFor,
} from "../shared/utils.js";

const logger = createLogger();

const SQL_SCHEMA = `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create node_id_mappings table
CREATE TABLE IF NOT EXISTS node_id_mappings (
    id text PRIMARY KEY NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    node_id text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create agent_memories table
CREATE TABLE IF NOT EXISTS agent_memories (
    id text PRIMARY KEY NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    content text NOT NULL,
    type text NOT NULL,
    source jsonb NOT NULL,
    embedding vector(1536),
    embedding_metadata jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    access_count integer DEFAULT 0,
    accessed_at timestamp with time zone,
    verified boolean DEFAULT false,
    verified_by text,
    verified_at timestamp with time zone,
    site_id text,
    agent_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);

-- Add embedding_metadata column if it doesn't exist (for existing tables)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_memories'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_memories' 
        AND column_name = 'embedding_metadata'
    ) THEN
        ALTER TABLE agent_memories ADD COLUMN embedding_metadata jsonb;
    END IF;
END $$;
`;

async function checkDockerCompose(_projectRoot: string): Promise<string> {
	const hasDockerCompose = await commandExists("docker-compose");
	const hasDockerComposeV2 = (await commandExists("docker"))
		? (await execCommand("docker", ["compose", "version"], { silent: true }))
				.success
		: false;

	if (!hasDockerCompose && !hasDockerComposeV2) {
		logger.error("docker-compose is not available");
		process.exit(1);
	}

	return hasDockerComposeV2 ? "docker compose" : "docker-compose";
}

async function ensureDatabaseRunning(composeCmd: string, projectRoot: string) {
	const [cmd, ...args] = composeCmd.split(" ");
	const psResult = await execCommand(
		cmd,
		[...args, "-f", "docker-compose.test.yml", "ps"],
		{
			cwd: projectRoot,
			silent: true,
		},
	);

	const isRunning = psResult.message.includes("Up");

	if (!isRunning) {
		logger.info("Starting test database...");
		const upResult = await execCommand(
			cmd,
			[...args, "-f", "docker-compose.test.yml", "up", "-d"],
			{ cwd: projectRoot },
		);

		if (!upResult.success) {
			logger.error("Failed to start database");
			process.exit(1);
		}

		// Wait for database to be ready
		await waitFor(
			async () => {
				const readyResult = await execCommand(
					cmd,
					[
						...args,
						"-f",
						"docker-compose.test.yml",
						"exec",
						"-T",
						"postgres-test",
						"pg_isready",
						"-U",
						"test",
					],
					{ cwd: projectRoot, silent: true },
				);
				return readyResult.success;
			},
			{
				timeout: 10000,
				interval: 1000,
				message: "Database failed to start",
			},
		);
	}
}

async function createTables(composeCmd: string, projectRoot: string) {
	logger.info("Creating tables...");

	const [cmd, ...args] = composeCmd.split(" ");
	const result = await execCommand(
		cmd,
		[
			...args,
			"-f",
			"docker-compose.test.yml",
			"exec",
			"-T",
			"postgres-test",
			"psql",
			"-U",
			"test",
			"-d",
			"test_revealui",
		],
		{
			cwd: projectRoot,
			stdin: SQL_SCHEMA,
			silent: true,
		},
	);

	if (!result.success) {
		logger.error("Failed to create tables");
		logger.error(result.message);
		process.exit(1);
	}

	logger.success("Tables created successfully");
}

async function runSetup() {
	logger.header("Simple Test Database Setup");

	const projectRoot = await getProjectRoot(import.meta.url);
	const composeCmd = await checkDockerCompose(projectRoot);

	await ensureDatabaseRunning(composeCmd, projectRoot);
	await createTables(composeCmd, projectRoot);

	process.env.POSTGRES_URL =
		"postgresql://test:test@localhost:5433/test_revealui";

	logger.header("Test database setup complete!");
	logger.info(`Database URL: ${process.env.POSTGRES_URL}`);
	logger.info("");
	logger.info("Tables created:");
	logger.info("  - node_id_mappings");
	logger.info("  - agent_memories (with embedding_metadata)");
	logger.info("");
}

/**
 * Main function
 */
async function main() {
	try {
		await runSetup();
	} catch (error) {
		logger.error(
			`Setup failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		if (error instanceof Error && error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}

main();
