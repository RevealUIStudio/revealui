/**
 * Factory for the `revealui-contracts` MCP server.
 *
 * Phase 1 of the protocol-pyramid ADR
 * (`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`): exposes every
 * `@revealui/contracts` category as MCP **resources** (read-only catalog of
 * JSON Schemas) plus per-category MCP **tools** that parse a payload against
 * the category's primary schema and return either the typed value or the
 * Zod issues.
 *
 * ## Resources
 *
 * - `revealui-contracts://catalog` — discovery payload listing every
 *   category, its primary schema name, and every secondary schema name.
 * - `revealui-contracts://<category>` — JSON document with
 *   `{ category, primarySchema, schemas: Record<name, JSONSchema7> }`.
 *
 * ## Tools
 *
 * - `contracts_list_categories` — returns the same payload as the
 *   `revealui-contracts://catalog` resource (tool form for clients that
 *   prefer tool-call ergonomics).
 * - `contracts_get_schema` — returns the JSON Schema for a single
 *   `(category, schemaName?)` pair.
 * - `contracts_validate_<category>` (one per registered category) —
 *   accepts `{ schema?: string, data: unknown }`, returns
 *   `{ success: true, data }` | `{ success: false, issues }`.
 *
 * ## Categories (17)
 *
 * Each category has a primary schema (the first secondary schema is the
 * default for `validate` when `schema` is omitted) plus zero or more
 * secondary schemas. Three of the categories (`devkit_profiles`,
 * `providers`, `stripe_webhook_events`) lift TS-only `as const` arrays
 * into `z.enum` for runtime validation; one (`content_validation`) lifts
 * a TS interface into a small `z.object`. The others use the contracts
 * package's hand-written or drizzle-zod-generated Zod schemas as-is.
 *
 * Out of scope for Phase 1 (no validation surface): `foundation`
 * (meta-types only — `Contract<T>` is a generic), `actions`
 * (class-based validator, not a Zod schema), `pricing` (TS interfaces),
 * `database` (bridge utilities — covered by `generated`).
 *
 * ## License
 *
 * This server is **not** Pro-gated. `@revealui/contracts` is MIT and
 * agent-side introspection of its schemas is meant to enable any client
 * (Claude Code, Cursor, custom agents) to integrate cleanly. Pro-gating
 * a public-package primitive would defeat the purpose.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type Resource,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Imports — Zod schemas grouped by category
// ---------------------------------------------------------------------------

import {
  DEVKIT_PROFILES,
  LLM_PROVIDERS,
  RELEVANT_STRIPE_WEBHOOK_EVENTS,
} from '@revealui/contracts';
import {
  A2AAgentCardSchema,
  A2AArtifactSchema,
  A2AAuthSchema,
  A2ACapabilitiesSchema,
  A2AJsonRpcRequestSchema,
  A2AJsonRpcResponseSchema,
  A2AMessageSchema,
  A2APartSchema,
  A2AProviderSchema,
  A2ASendTaskParamsSchema,
  A2ASkillSchema,
  A2ATaskSchema,
  A2ATaskStateSchema,
  A2ATaskStatusSchema,
} from '@revealui/contracts/a2a';
import { CollectionContract, ConfigContract } from '@revealui/contracts/admin';
import {
  AgentActionRecordSchema,
  AgentDefinitionSchema,
  AgentMemorySchema,
  AgentStateSchema,
  AgentContextSchema as AgentsContextSchema,
  ConversationMessageSchema,
  ConversationSchema,
  IntentSchema,
  IntentTypeSchema,
  MemorySourceSchema,
  MemoryTypeSchema,
  ToolDefinitionSchema,
  ToolParameterSchema,
} from '@revealui/contracts/agents';
import {
  MFABackupCodeRequestSchema,
  MFADisableRequestSchema,
  MFASetupResponseSchema,
  MFAVerifyRequestSchema,
  PasskeyAuthenticateOptionsRequestSchema,
  PasskeyAuthenticateVerifyRequestSchema,
  PasskeyListResponseSchema,
  PasskeyRegisterOptionsRequestSchema,
  PasskeyRegisterVerifyRequestSchema,
  PasskeyUpdateRequestSchema,
  PasswordResetRequestSchema,
  PasswordResetTokenSchema,
  RecoveryRequestSchema,
  RecoveryVerifyRequestSchema,
  SignInRequestSchema,
  SignUpRequestSchema,
} from '@revealui/contracts/api/auth';
import { ChatMessageSchema, ChatRequestSchema } from '@revealui/contracts/api/chat';
import { GDPRDeleteRequestSchema, GDPRExportRequestSchema } from '@revealui/contracts/api/gdpr';
import {
  AccordionBlockSchema,
  BlockMetaSchema,
  BlockSchema,
  BlockStyleSchema,
  ButtonBlockSchema,
  CodeBlockSchema,
  ColumnsBlockSchema,
  ComponentBlockSchema,
  DividerBlockSchema,
  EmbedBlockSchema,
  FormBlockSchema,
  GridBlockSchema,
  HeadingBlockSchema,
  HtmlBlockSchema,
  ImageBlockSchema,
  ListBlockSchema,
  QuoteBlockSchema,
  SpacerBlockSchema,
  TableBlockSchema,
  TabsBlockSchema,
  TextBlockSchema,
  VideoBlockSchema,
} from '@revealui/contracts/content';
import {
  PageLockSchema,
  PageSchema,
  SessionSchema,
  SiteSchema,
  UserSchema,
} from '@revealui/contracts/entities';
import {
  AccountsInsertSchema,
  AccountsSelectSchema,
  AgentContextsInsertSchema,
  AgentMemoriesInsertSchema,
  PagesInsertSchema,
  SessionsInsertSchema,
  SitesInsertSchema,
  UsersInsertSchema,
  UsersSelectSchema,
} from '@revealui/contracts/generated/zod-schemas';
import {
  AgentActionDefinitionSchema,
  AgentConstraintSchema,
  AgentRelationSchema,
  AgentRepresentationSchema,
  DualEntitySchema,
  EmbeddingSchema,
  HumanRepresentationSchema,
} from '@revealui/contracts/representation';
import {
  RotationEventSchema,
  RotationReasonSchema,
  SecretActorSchema,
  SecretActorTypeSchema,
  SecretAuditEventSchema,
  SecretAuditEventTypeSchema,
  SecretPathSchema,
} from '@revealui/contracts/secrets';
import {
  IssueLocationSchema,
  SecurityCategorySchema,
  SecurityFindingSchema,
  SecurityRuleSchema,
  SecuritySeveritySchema,
} from '@revealui/contracts/security';

// ---------------------------------------------------------------------------
// Derived schemas (lift TS-only constants into Zod for runtime validation)
// ---------------------------------------------------------------------------

const DevkitProfileIdSchema = z.enum(DEVKIT_PROFILES);
const LlmProviderSchema = z.enum(LLM_PROVIDERS);
const StripeWebhookEventSchema = z.enum(
  RELEVANT_STRIPE_WEBHOOK_EVENTS as readonly [string, ...string[]],
);

const ContentValidationConfigSchema = z.object({
  maxDepth: z.number().int().positive(),
  maxSizeBytes: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Schema registry
// ---------------------------------------------------------------------------

/**
 * Each category has a `primary` schema name (the default for the
 * `validate_*` tool when no `schema` argument is given) and a `schemas`
 * map of all the validators it exposes.
 *
 * Category names use snake_case for MCP tool-name compatibility (the SDK
 * spec recommends `[a-z][a-z0-9_]*`).
 */
interface CategoryEntry {
  primary: string;
  schemas: Record<string, z.ZodTypeAny>;
  description: string;
}

// biome-ignore lint/suspicious/noExplicitAny: Zod schemas vary in shape.
const SCHEMA_REGISTRY = {
  a2a: {
    primary: 'agentCard',
    description:
      'Agent-to-Agent (A2A) protocol contracts — AgentCard, Task, Message, Skill, Artifact, JSON-RPC envelopes.',
    schemas: {
      agentCard: A2AAgentCardSchema,
      artifact: A2AArtifactSchema,
      auth: A2AAuthSchema,
      capabilities: A2ACapabilitiesSchema,
      jsonRpcRequest: A2AJsonRpcRequestSchema,
      jsonRpcResponse: A2AJsonRpcResponseSchema,
      message: A2AMessageSchema,
      part: A2APartSchema,
      provider: A2AProviderSchema,
      sendTaskParams: A2ASendTaskParamsSchema,
      skill: A2ASkillSchema,
      task: A2ATaskSchema,
      taskState: A2ATaskStateSchema,
      taskStatus: A2ATaskStatusSchema,
    },
  },
  admin: {
    primary: 'collection',
    description:
      'admin configuration contracts — CollectionContract + ConfigContract wrap typed admin shapes in the Contract<T> pattern.',
    schemas: {
      collection: CollectionContract.schema,
      config: ConfigContract.schema,
    },
  },
  agents: {
    primary: 'agentMemory',
    description:
      'LLM agent behavior contracts — AgentMemory (semantic memory with embeddings), Conversation, AgentDefinition, Tool, Intent.',
    schemas: {
      agentActionRecord: AgentActionRecordSchema,
      agentContext: AgentsContextSchema,
      agentDefinition: AgentDefinitionSchema,
      agentMemory: AgentMemorySchema,
      agentState: AgentStateSchema,
      conversation: ConversationSchema,
      conversationMessage: ConversationMessageSchema,
      intent: IntentSchema,
      intentType: IntentTypeSchema,
      memorySource: MemorySourceSchema,
      memoryType: MemoryTypeSchema,
      toolDefinition: ToolDefinitionSchema,
      toolParameter: ToolParameterSchema,
    },
  },
  api_auth: {
    primary: 'signIn',
    description:
      'Auth API request/response contracts — sign-in, sign-up, password reset, MFA, passkey, recovery flows.',
    schemas: {
      signIn: SignInRequestSchema,
      signUp: SignUpRequestSchema,
      passwordReset: PasswordResetRequestSchema,
      passwordResetToken: PasswordResetTokenSchema,
      mfaSetupResponse: MFASetupResponseSchema,
      mfaVerify: MFAVerifyRequestSchema,
      mfaDisable: MFADisableRequestSchema,
      mfaBackupCode: MFABackupCodeRequestSchema,
      passkeyRegisterOptions: PasskeyRegisterOptionsRequestSchema,
      passkeyRegisterVerify: PasskeyRegisterVerifyRequestSchema,
      passkeyAuthenticateOptions: PasskeyAuthenticateOptionsRequestSchema,
      passkeyAuthenticateVerify: PasskeyAuthenticateVerifyRequestSchema,
      passkeyList: PasskeyListResponseSchema,
      passkeyUpdate: PasskeyUpdateRequestSchema,
      recovery: RecoveryRequestSchema,
      recoveryVerify: RecoveryVerifyRequestSchema,
    },
  },
  api_chat: {
    primary: 'chatRequest',
    description: 'Chat API contracts — ChatRequest body + ChatMessage shapes.',
    schemas: {
      chatRequest: ChatRequestSchema,
      chatMessage: ChatMessageSchema,
    },
  },
  api_gdpr: {
    primary: 'gdprExport',
    description: 'GDPR API contracts — data export and account deletion request shapes.',
    schemas: {
      gdprExport: GDPRExportRequestSchema,
      gdprDelete: GDPRDeleteRequestSchema,
    },
  },
  content: {
    primary: 'block',
    description:
      'Content block contracts — discriminated union of 17 block variants (text, heading, image, code, table, columns, grid, form, etc.).',
    schemas: {
      block: BlockSchema,
      blockMeta: BlockMetaSchema,
      blockStyle: BlockStyleSchema,
      accordion: AccordionBlockSchema,
      button: ButtonBlockSchema,
      code: CodeBlockSchema,
      columns: ColumnsBlockSchema,
      component: ComponentBlockSchema,
      divider: DividerBlockSchema,
      embed: EmbedBlockSchema,
      form: FormBlockSchema,
      grid: GridBlockSchema,
      heading: HeadingBlockSchema,
      html: HtmlBlockSchema,
      image: ImageBlockSchema,
      list: ListBlockSchema,
      quote: QuoteBlockSchema,
      spacer: SpacerBlockSchema,
      table: TableBlockSchema,
      tabs: TabsBlockSchema,
      text: TextBlockSchema,
      video: VideoBlockSchema,
    },
  },
  content_validation: {
    primary: 'config',
    description:
      'Lexical content validation config — limits applied by validateLexicalContent (max nesting depth + max payload bytes).',
    schemas: {
      config: ContentValidationConfigSchema,
    },
  },
  devkit_profiles: {
    primary: 'profileId',
    description:
      'DevKit profile id (Max-tier paywall feature) — one of revealui, agents, claude, cursor, zed.',
    schemas: {
      profileId: DevkitProfileIdSchema,
    },
  },
  entities: {
    primary: 'user',
    description:
      'Domain entity contracts — User, Site, Page, Session, plus PageLock. Add more secondary schemas in subsequent phases.',
    schemas: {
      user: UserSchema,
      page: PageSchema,
      pageLock: PageLockSchema,
      session: SessionSchema,
      site: SiteSchema,
    },
  },
  generated: {
    primary: 'usersInsert',
    description:
      'Drizzle-zod-generated Insert/Select schemas reflecting raw DB columns. Sample of the most-used tables (full set is 86+ schemas).',
    schemas: {
      accountsSelect: AccountsSelectSchema,
      accountsInsert: AccountsInsertSchema,
      agentContextsInsert: AgentContextsInsertSchema,
      agentMemoriesInsert: AgentMemoriesInsertSchema,
      pagesInsert: PagesInsertSchema,
      sessionsInsert: SessionsInsertSchema,
      sitesInsert: SitesInsertSchema,
      usersSelect: UsersSelectSchema,
      usersInsert: UsersInsertSchema,
    },
  },
  providers: {
    primary: 'providerId',
    description:
      'Supported LLM provider id — one of groq, huggingface, inference-snaps, ollama. Open models only.',
    schemas: {
      providerId: LlmProviderSchema,
    },
  },
  representation: {
    primary: 'dualEntity',
    description:
      'Dual representation layer — DualEntity wraps every entity with both Human and Agent views. Includes Embedding, AgentRepresentation, HumanRepresentation, AgentAction, AgentConstraint, AgentRelation.',
    schemas: {
      dualEntity: DualEntitySchema,
      embedding: EmbeddingSchema,
      agentRepresentation: AgentRepresentationSchema,
      humanRepresentation: HumanRepresentationSchema,
      agentActionDefinition: AgentActionDefinitionSchema,
      agentConstraint: AgentConstraintSchema,
      agentRelation: AgentRelationSchema,
    },
  },
  secrets: {
    primary: 'secretActor',
    description:
      'Revvault secret-management contracts — SecretPath, SecretActor, RotationEvent, SecretAuditEvent.',
    schemas: {
      secretActor: SecretActorSchema,
      secretActorType: SecretActorTypeSchema,
      secretPath: SecretPathSchema,
      rotationEvent: RotationEventSchema,
      rotationReason: RotationReasonSchema,
      secretAuditEvent: SecretAuditEventSchema,
      secretAuditEventType: SecretAuditEventTypeSchema,
    },
  },
  security: {
    primary: 'securityRule',
    description:
      'Security rule contracts — SecurityRule, SecurityFinding, severity/category enums, IssueLocation.',
    schemas: {
      securityRule: SecurityRuleSchema,
      securityFinding: SecurityFindingSchema,
      severity: SecuritySeveritySchema,
      category: SecurityCategorySchema,
      issueLocation: IssueLocationSchema,
    },
  },
  stripe_webhook_events: {
    primary: 'eventType',
    description:
      'Canonical Stripe webhook event types handled by RevealUI (subset of Stripe API events).',
    schemas: {
      eventType: StripeWebhookEventSchema,
    },
  },
} as const satisfies Record<string, CategoryEntry>;

type CategoryName = keyof typeof SCHEMA_REGISTRY;

/**
 * Public alias for the literal-union of registered category names. Consumers
 * (e.g. `@revealui/openapi`'s `emit-from-mcp.ts`) can use this for strict
 * keying of catalog operations; loose `string` is also accepted everywhere.
 */
export type ContractCategoryName = CategoryName;

const CATEGORIES = Object.keys(SCHEMA_REGISTRY) as CategoryName[];

// Constant exports for tests + runtime introspection.
// biome-ignore lint/suspicious/noExplicitAny: ZodTypeAny convenience for tests.
export const REGISTERED_CATEGORIES = CATEGORIES as readonly string[];

// ---------------------------------------------------------------------------
// JSON Schema cache (computed once at server creation)
// ---------------------------------------------------------------------------

/**
 * Public shape of a single category entry in the contracts catalog. Used by
 * downstream consumers — most notably `@revealui/openapi`'s `emit-from-mcp.ts`
 * generator, which consumes the catalog at build-time to materialize an
 * OpenAPI 3.1 `components.schemas` map.
 */
export interface ContractCategorySchemas {
  /** Stable JSON Schemas keyed by schema name within the category. */
  schemas: Record<string, unknown>;
  /** The primary schema name (default for `validate_<category>` when no `schema` argument is given). */
  primary: string;
  /** Human description of the category. */
  description: string;
}

/**
 * Build the contracts catalog: a snapshot of every registered category's
 * JSON Schemas (computed via Zod v4's built-in `z.toJSONSchema()`), keyed
 * first by category name, then by schema name within the category.
 *
 * Pure (no side effects, no external state). Safe to call multiple times;
 * each call recomputes from `SCHEMA_REGISTRY`. Cheap enough that callers
 * who want a long-lived snapshot (e.g. the MCP server's per-instance cache)
 * can call once and memoize the result themselves.
 *
 * Some Zod constructs (e.g. discriminated unions with overlapping
 * discriminators, recursive schemas without lazy guards, custom transforms)
 * cannot be serialized to JSON Schema. For those entries, the catalog
 * surfaces a placeholder `{ $comment: "JSON Schema serialization failed: ..." }`
 * so the schema name still appears in the catalog; runtime validation
 * (via `validatePayload`) is unaffected.
 */
export function getContractsCatalog(): Record<ContractCategoryName, ContractCategorySchemas> {
  const out: Record<string, ContractCategorySchemas> = {};
  for (const cat of CATEGORIES) {
    const entry = SCHEMA_REGISTRY[cat];
    const schemaJson: Record<string, unknown> = {};
    for (const [name, zodSchema] of Object.entries(entry.schemas)) {
      try {
        schemaJson[name] = z.toJSONSchema(zodSchema);
      } catch (err) {
        schemaJson[name] = {
          $comment: `JSON Schema serialization failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    out[cat] = {
      schemas: schemaJson,
      primary: entry.primary,
      description: entry.description,
    };
  }
  return out as Record<ContractCategoryName, ContractCategorySchemas>;
}

// ---------------------------------------------------------------------------
// Resource URI helpers
// ---------------------------------------------------------------------------

const RESOURCE_URI_PREFIX = 'revealui-contracts://';
const CATALOG_URI = `${RESOURCE_URI_PREFIX}catalog`;

interface ParsedCategoryUri {
  category: CategoryName;
}

function parseCategoryUri(uri: string): ParsedCategoryUri | null {
  if (!uri.startsWith(RESOURCE_URI_PREFIX)) return null;
  const rest = uri.slice(RESOURCE_URI_PREFIX.length);
  if (!/^[a-z][a-z0-9_]*$/.test(rest)) return null;
  if (!(rest in SCHEMA_REGISTRY)) return null;
  return { category: rest as CategoryName };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

interface ValidateSuccess {
  success: true;
  category: CategoryName;
  schema: string;
  data: unknown;
}

interface ValidateFailure {
  success: false;
  category: CategoryName;
  schema: string;
  issues: Array<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
    code: string;
  }>;
}

type ValidateResult = ValidateSuccess | ValidateFailure;

export function validatePayload(
  category: CategoryName,
  schemaName: string,
  data: unknown,
): ValidateResult {
  const entry = SCHEMA_REGISTRY[category];
  // The `as const satisfies` literal makes `entry.schemas` a union of
  // narrow per-category shapes. For runtime indexing by arbitrary string,
  // widen to a record of ZodTypeAny — the unknown-key lookup is what we
  // want here (caller supplied `schemaName`).
  const schemasMap = entry.schemas as Record<string, z.ZodTypeAny>;
  const zodSchema = schemasMap[schemaName];
  if (!zodSchema) {
    return {
      success: false,
      category,
      schema: schemaName,
      issues: [
        {
          path: [],
          message: `Unknown schema "${schemaName}" for category "${category}". Valid schemas: ${Object.keys(entry.schemas).join(', ')}.`,
          code: 'unknown_schema',
        },
      ],
    };
  }
  const result = zodSchema.safeParse(data);
  if (result.success) {
    return { success: true, category, schema: schemaName, data: result.data };
  }
  return {
    success: false,
    category,
    schema: schemaName,
    issues: result.error.issues.map((i: z.core.$ZodIssue) => ({
      path: i.path,
      message: i.message,
      code: i.code,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tool catalog
// ---------------------------------------------------------------------------

const VALIDATE_TOOL_PREFIX = 'contracts_validate_';

function validateToolName(category: CategoryName): string {
  return `${VALIDATE_TOOL_PREFIX}${category}`;
}

function validateInputSchema(category: CategoryName): Tool['inputSchema'] {
  const entry = SCHEMA_REGISTRY[category];
  const schemaNames = Object.keys(entry.schemas);
  return {
    type: 'object',
    properties: {
      schema: {
        type: 'string',
        enum: schemaNames,
        description: `Optional schema name within "${category}". Defaults to "${entry.primary}". One of: ${schemaNames.join(', ')}.`,
      },
      data: {
        description: 'JSON value to validate. Type depends on the chosen schema.',
      },
    },
    required: ['data'],
  };
}

function buildToolList(): Tool[] {
  const tools: Tool[] = [];

  // Discovery tools
  tools.push({
    name: 'contracts_list_categories',
    description:
      'List every contract category exposed by this server, with primary schema name and full schema-name list per category.',
    inputSchema: { type: 'object', properties: {} },
  });

  tools.push({
    name: 'contracts_get_schema',
    description:
      'Return the JSON Schema for a (category, schema) pair. Omit `schema` to get the category primary.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: CATEGORIES as unknown as string[],
          description: 'Contract category name.',
        },
        schema: {
          type: 'string',
          description: 'Optional schema name within the category. Defaults to the primary.',
        },
      },
      required: ['category'],
    },
  });

  // One validate tool per category
  for (const cat of CATEGORIES) {
    const entry = SCHEMA_REGISTRY[cat];
    tools.push({
      name: validateToolName(cat),
      description: `Validate a JSON payload against a "${cat}" contract schema. ${entry.description}`,
      inputSchema: validateInputSchema(cat),
    });
  }

  return tools;
}

// ---------------------------------------------------------------------------
// Resource catalog
// ---------------------------------------------------------------------------

function buildResourceList(): Resource[] {
  const resources: Resource[] = [
    {
      uri: CATALOG_URI,
      name: 'catalog',
      description:
        'Complete contracts catalog: every category with its primary schema name, secondary schema names, and human description.',
      mimeType: 'application/json',
    },
  ];
  for (const cat of CATEGORIES) {
    const entry = SCHEMA_REGISTRY[cat];
    resources.push({
      uri: `${RESOURCE_URI_PREFIX}${cat}`,
      name: cat,
      description: entry.description,
      mimeType: 'application/json',
    });
  }
  return resources;
}

interface CatalogPayload {
  categories: Array<{
    name: string;
    primary: string;
    schemas: string[];
    description: string;
  }>;
  totalCategories: number;
  totalSchemas: number;
}

function buildCatalogPayload(): CatalogPayload {
  const categories = CATEGORIES.map((cat) => {
    const entry = SCHEMA_REGISTRY[cat];
    return {
      name: cat,
      primary: entry.primary,
      schemas: Object.keys(entry.schemas),
      description: entry.description,
    };
  });
  const totalSchemas = categories.reduce((acc, c) => acc + c.schemas.length, 0);
  return { categories, totalCategories: categories.length, totalSchemas };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Server name + version. Bump the version when the registry changes
 * shape (adds/removes categories or top-level fields). The host
 * `@revealui/mcp` package version stays separate.
 */
const SERVER_NAME = 'revealui-contracts';
const SERVER_VERSION = '0.1.0';

export interface CreateContractsServerOptions {
  /**
   * Override the server name advertised in the MCP `initialize` response.
   * Mostly useful for tests that spin up multiple servers in one process.
   */
  serverName?: string;
}

/**
 * Create a fresh contracts MCP Server instance. Safe to call multiple
 * times — each call returns an independent Server with its own request
 * handlers and its own JSON Schema cache.
 */
export function createContractsServer(options?: CreateContractsServerOptions): Server {
  const server = new Server(
    { name: options?.serverName ?? SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  );

  const jsonSchemaCache = getContractsCatalog();
  const toolList = buildToolList();
  const resourceList = buildResourceList();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: resourceList }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const uri = request.params.uri;
    if (uri === CATALOG_URI) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(buildCatalogPayload(), null, 2),
          },
        ],
      };
    }
    const parsed = parseCategoryUri(uri);
    if (!parsed) {
      throw new Error(
        `Unknown resource URI (expected ${CATALOG_URI} or ${RESOURCE_URI_PREFIX}<category>): ${uri}`,
      );
    }
    const cached = jsonSchemaCache[parsed.category];
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              category: parsed.category,
              primarySchema: cached.primary,
              description: cached.description,
              schemas: cached.schemas,
            },
            null,
            2,
          ),
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const toolName = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    try {
      if (toolName === 'contracts_list_categories') {
        return {
          content: [{ type: 'text', text: JSON.stringify(buildCatalogPayload(), null, 2) }],
        };
      }

      if (toolName === 'contracts_get_schema') {
        const category = args.category;
        const schemaName = args.schema;
        if (typeof category !== 'string' || !(category in SCHEMA_REGISTRY)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unknown category "${String(category)}". Valid: ${CATEGORIES.join(', ')}.`,
              },
            ],
            isError: true,
          };
        }
        const cat = category as CategoryName;
        const cached = jsonSchemaCache[cat];
        const effectiveSchema =
          typeof schemaName === 'string' && schemaName.length > 0 ? schemaName : cached.primary;
        const json = cached.schemas[effectiveSchema];
        if (json === undefined) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unknown schema "${effectiveSchema}" for category "${cat}". Valid: ${Object.keys(cached.schemas).join(', ')}.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { category: cat, schema: effectiveSchema, jsonSchema: json },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (toolName.startsWith(VALIDATE_TOOL_PREFIX)) {
        const category = toolName.slice(VALIDATE_TOOL_PREFIX.length);
        if (!(category in SCHEMA_REGISTRY)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Unknown category "${category}" derived from tool "${toolName}". Valid: ${CATEGORIES.join(', ')}.`,
              },
            ],
            isError: true,
          };
        }
        const cat = category as CategoryName;
        const entry = SCHEMA_REGISTRY[cat];
        const schemaName =
          typeof args.schema === 'string' && args.schema.length > 0 ? args.schema : entry.primary;
        if (!('data' in args)) {
          return {
            content: [{ type: 'text', text: `Error: "data" is required for ${toolName}.` }],
            isError: true,
          };
        }
        const result = validatePayload(cat, schemaName, args.data);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      return {
        content: [{ type: 'text', text: `Error: Unknown tool: ${toolName}` }],
        isError: true,
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
