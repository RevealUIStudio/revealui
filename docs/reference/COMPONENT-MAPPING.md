# RevealUI Component, Business Logic, and Schema Mapping

This document provides a comprehensive mapping of all UI components, the business logic that drives them, and the data schemas/contracts that bind them together.

## Table of Contents

1. [UI Components](#ui-components)
2. [Business Logic](#business-logic)
3. [Data Schemas & Contracts](#data-schemas-contracts)
4. [Component-to-Schema Relationships](#component-to-schema-relationships)

---

## UI Components

### CMS Blocks (`apps/cms/src/lib/blocks/`)

Blocks are the primary content building units in the CMS. Each block has a corresponding component and schema.

#### Active Blocks

1. **ArchiveBlock** (`ArchiveBlock/Component.tsx`)
   - **Purpose**: Displays archive/listings of content
   - **Schema**: Uses `Page` type from `@/types`
   - **Business Logic**: `populateArchiveBlock` hook

2. **BannerBlock** (`Banner/Component.tsx`)
   - **Purpose**: Displays banner content
   - **Schema**: Uses `Page` type from `@/types`

3. **CallToActionBlock** (`CallToAction/Component.tsx`)
   - **Purpose**: Renders call-to-action sections
   - **Schema**: Extracted from `Page["layout"]` with `blockType: "cta"`
   - **Type**: `CallToActionBlockProps`

4. **CodeBlock** (`Code/Component.tsx`, `Code/Component.client.tsx`)
   - **Purpose**: Displays code snippets
   - **Schema**: `CodeBlockSchema` from `@revealui/schema/blocks`

5. **ContentBlock** (`Content/Component.tsx`)
   - **Purpose**: Renders rich text content
   - **Schema**: Extracted from `Page["layout"]` with `blockType: "content"`
   - **Type**: `ContentBlockProps`

6. **FormBlock** (`Form/Component.tsx`)
   - **Purpose**: Renders dynamic forms with validation
   - **Schema**: `FormBlockSchema` from `@revealui/schema/blocks`
   - **Business Logic**:
     - Uses `react-hook-form` for form state
     - `buildInitialFormState` for default values
     - Form submission via `/api/form-submissions`
   - **Sub-components**:
     - `Form/Text/index.tsx`
     - `Form/Email/index.tsx`
     - `Form/Number/index.tsx`
     - `Form/Textarea/index.tsx`
     - `Form/Select/index.tsx`
     - `Form/Checkbox/index.tsx`
     - `Form/Country/index.tsx`
     - `Form/Width/index.tsx`
     - `Form/Message/index.tsx`
     - `Form/State/index.tsx`
     - `Form/Error/index.tsx`

7. **MediaBlock** (`MediaBlock/Component.tsx`)
   - **Purpose**: Displays media (images, videos)
   - **Schema**: Extracted from `Page["layout"]` with `blockType: "mediaBlock"`
   - **Type**: `MediaBlockProps`

8. **RelatedPostsBlock** (`RelatedPosts/Component.tsx`)
   - **Purpose**: Shows related posts
   - **Schema**: Uses `Page` type

9. **StatsBlock** (`StatsBlock/Component.tsx`)
   - **Purpose**: Displays statistics/metrics
   - **Schema**: Uses `Page` type

10. **PageContentBlock** (`PageContent/Component.tsx`)
    - **Purpose**: Renders page content blocks

11. **PageListBlock** (`PageList/Component.tsx`)
    - **Purpose**: Lists pages

12. **ReusableContentBlock** (`ReusableContent/Component.tsx`)
    - **Purpose**: Reusable content sections

13. **SiteTitleBlock** (`SiteTitle/Component.tsx`)
    - **Purpose**: Displays site title

#### Block Renderer

- **RenderBlocks** (`RenderBlocks.tsx`)
  - **Purpose**: Main block renderer that maps block types to components
  - **Type**: `BlockProps` (union of all block prop types)
  - **Mapping**: `blockComponents` object maps `blockType` to component

### CMS Components (`apps/cms/src/lib/components/`)

Reusable UI components used throughout the CMS.

1. **AdminBar** (`AdminBar/index.tsx`)
   - **Purpose**: Admin toolbar/bar component

2. **Agent** (`Agent/index.tsx`)
   - **Purpose**: AI agent interface component
   - **Business Logic**: Uses `useChat` hook

3. **Background** (`Background/`)
   - **Purpose**: Background styling components

4. **BeforeDashboard** (`BeforeDashboard/`)
   - **Purpose**: Pre-dashboard components

5. **BeforeLogin** (`BeforeLogin/`)
   - **Purpose**: Pre-login components

6. **Card** (`Card/index.tsx`)
   - **Purpose**: Card display component

7. **CollectionArchive** (`CollectionArchive/index.tsx`)
   - **Purpose**: Archive view for collections

8. **CustomerSelect** (`CustomerSelect/`)
   - **Purpose**: Customer selection component

9. **FighterSelect** (`FighterSelect/index.tsx`)
   - **Purpose**: Fighter/user selection dropdown
   - **Business Logic**: Fetches from `/api/collections/users`
   - **Schema**: Uses `TextField` from RevealUI

10. **Icon** (`Icon/index.tsx`)
    - **Purpose**: Icon component

11. **Link** (`Link/index.tsx`)
    - **Purpose**: Link component with routing

12. **LivePreviewListener** (`LivePreviewListener/index.tsx`)
    - **Purpose**: Handles live preview updates

13. **Logo** (`Logo/index.tsx`)
    - **Purpose**: Logo display component

14. **Media** (`Media/`)
    - **Purpose**: Media display components
    - **Types**: `Media/types.ts`

15. **PageRange** (`PageRange/index.tsx`)
    - **Purpose**: Pagination component

16. **Pagination** (`Pagination/`)
    - **Purpose**: Pagination controls

17. **RevealUIRedirects** (`RevealUIRedirects/index.tsx`)
    - **Purpose**: RevealUI redirect management
    - **Note**: Previously named `PayloadRedirects` (legacy name from Payload CMS)

19. **RichText** (`RichText/`)
    - **Purpose**: Rich text editor/display
    - **Files**:
      - `index.tsx` - Main component
      - `serialize.tsx` - Serialization logic
      - `nodeFormat.tsx` - Node formatting

20. **UI Components** (`ui/`)
    - **Purpose**: Base UI components (buttons, checkboxes, form labels, etc.)
    - **Files**:
      - `button.tsx`
      - `checkbox.tsx`
      - `formlabel.tsx`

### RevealUI Framework Components (`packages/revealui/src/client/ui/`)

Core framework UI components for the CMS admin interface.

1. **TextInput** (`index.tsx`)
   - **Props**: `TextInputProps`
   - **Purpose**: Text input field

2. **FieldLabel** (`index.tsx`)
   - **Props**: `FieldLabelProps`
   - **Purpose**: Form field label

3. **Button** (`index.tsx`)
   - **Props**: `ButtonProps`
   - **Purpose**: Button component

4. **SelectInput** (`index.tsx`)
   - **Props**: `SelectInputProps`
   - **Purpose**: Select dropdown

5. **Textarea** (`index.tsx`)
   - **Props**: `TextareaProps`
   - **Purpose**: Textarea component

6. **Checkbox** (`index.tsx`)
   - **Props**: `CheckboxProps`
   - **Purpose**: Checkbox input

7. **FieldsDrawer** (`index.tsx`)
   - **Props**: `FieldsDrawerProps`
   - **Purpose**: Drawer for editing fields

8. **ModalProvider** (`index.tsx`)
   - **Purpose**: Modal context provider
   - **Hook**: `useModal()`

### RevealUI Rich Text Components (`packages/revealui/src/client/richtext-lexical/`)

1. **RichTextEditor** (`RichTextEditor.tsx`)
   - **Purpose**: Lexical-based rich text editor

2. **ImageNode** (`nodes/ImageNode.tsx`)
   - **Purpose**: Image node for rich text

3. **ToolbarPlugin** (`plugins/ToolbarPlugin.tsx`)
   - **Purpose**: Rich text toolbar

4. **FloatingToolbarPlugin** (`plugins/FloatingToolbarPlugin.tsx`)
   - **Purpose**: Floating toolbar for rich text

### Web App Components (`apps/web/src/components/`)

Frontend application components.

1. **Builder** (`Builder.tsx`, `Builder/Builder.tsx`)
   - **Purpose**: Visual page builder
   - **Business Logic**: Component state management, export/deploy functionality
   - **Schema**: Local `Component` interface

2. **Home Components** (`Home/`)
   - **HomeCard** (`Card.tsx`)
     - **Business Logic**: `fetchCard()` function
     - **Schema**: `CardData` type
   - **HomeHeader** (`Header.tsx`)
     - **Schema**: `Video` type
   - **HomeMain** (`Main.tsx`)
     - **Business Logic**: `fetchMainInfos()` from `revealui/core/targets/http/fetchMainInfos`
     - **Schema**: `MainInfo`, `ContentSectionProps` from `revealui/types/interfaces/app`
   - **HomeSection** (`Section.tsx`)
     - **Schema**: `Event` type
   - **HomeHero** (`Hero.tsx`)
   - **HomeContent** (`Content.tsx`)

### CMS RevealUI Elements (`apps/cms/src/components/revealui/elements/`)

Reusable page elements.

1. `announcement-badge.tsx`
2. `button.tsx`
3. `container.tsx`
4. `document.tsx`
5. `email-signup-form.tsx`
6. `eyebrow.tsx`
7. `heading.tsx`
8. `install-command.tsx`
9. `link.tsx`
10. `logo-grid.tsx`
11. `main.tsx`
12. `screenshot.tsx`
13. `section.tsx`
14. `subheading.tsx`
15. `text.tsx`
16. `wallpaper.tsx`

### CMS RevealUI Sections (`apps/cms/src/components/revealui/sections/`)

Pre-built section components.

1. `footer-with-newsletter-form-categories-and-social-icons.tsx`
2. `hero-centered-with-photo.tsx`
3. `hero-left-aligned-with-demo.tsx`
4. `navbar-with-links-actions-and-centered-logo.tsx`
5. `stats-with-graph.tsx`

---

## Business Logic

### React Hooks (`apps/cms/src/lib/hooks/`)

1. **useChat** (`useChat.ts`)
   - **Purpose**: Chat interface with voice recognition
   - **API**: `/api/chat`
   - **Used by**: `Agent` component

2. **useClickableCard** (`useClickableCard.ts`)
   - **Purpose**: Card click handling

3. **createCollectionContext** (`createCollectionContext.tsx`)
   - **Purpose**: Collection context provider

4. **createContext** (`createContext.tsx`)
   - **Purpose**: General context creation

5. **populateArchiveBlock** (`populateArchiveBlock.ts`)
   - **Purpose**: Populates archive block data
   - **Used by**: `ArchiveBlock`

6. **revalidatePage** (`revalidatePage.ts`)
   - **Purpose**: Page revalidation logic

7. **revalidateRedirects** (`revalidateRedirects.ts`)
   - **Purpose**: Redirect revalidation

8. **populatePublishedAt** (`populatePublishedAt.ts`)
   - **Purpose**: Sets published timestamp

9. **loginAfterCreate** (`loginAfterCreate.ts`)
   - **Purpose**: Auto-login after user creation

10. **ensureFirstUserIsSuperAdmin** (`ensureFirstUserIsSuperAdmin.ts`)
    - **Purpose**: Ensures first user is admin

11. **createTenant** (`createTenant.ts`)
    - **Purpose**: Tenant creation logic

12. **recordLastLoggedInTenant** (`recordLastLoggedInTenant.ts`)
    - **Purpose**: Records last logged-in tenant

13. **resolveDuplicatePurchases** (`resolveDuplicatePurchases.ts`)
    - **Purpose**: Resolves duplicate purchase issues

14. **productsProxy** (`productsProxy.ts`)
    - **Purpose**: Product data proxy

15. **customersProxy** (`customersProxy.ts`)
    - **Purpose**: Customer data proxy

16. **tenantProxy** (`tenantProxy.ts`)
    - **Purpose**: Tenant data proxy

17. **deepMerge** (`deepMerge.ts`)
    - **Purpose**: Deep object merging

18. **isObject** (`isObject.ts`)
    - **Purpose**: Object type checking

19. **revalidate** (`revalidate.ts`)
    - **Purpose**: General revalidation

### Collection Hooks (`apps/cms/src/lib/collections/*/hooks/`)

Business logic hooks that run on collection operations.

#### Products Collection

1. **beforeChange** (`Products/hooks/beforeChange.ts`)
   - **Function**: `beforeProductChange`
   - **Purpose**: Syncs product data with Stripe
   - **Schema**: Uses `Product` type from `@/types`
   - **API**: Stripe API via `protectedStripe`

2. **revalidateProduct** (`Products/hooks/revalidateProduct.ts`)
   - **Purpose**: Revalidates product pages

3. **deleteProductFromCarts** (`Products/hooks/deleteProductFromCarts.ts`)
   - **Purpose**: Removes product from carts on deletion

#### Prices Collection

1. **beforeChange** (`Prices/hooks/beforeChange.ts`)
   - **Function**: `beforePriceChange`
   - **Purpose**: Syncs price data with Stripe
   - **Schema**: Uses `Price` type from `@/types`

2. **revalidatePrice** (`Prices/hooks/revalidatePrice.ts`)
   - **Purpose**: Revalidates price pages

3. **deletePriceFromCarts** (`Prices/hooks/deletePriceFromCarts.ts`)
   - **Purpose**: Removes price from carts on deletion

#### Orders Collection

1. **populateOrderedBy** (`Orders/hooks/populateOrderedBy.ts`)
   - **Purpose**: Populates order user data

2. **updateUserPurchases** (`Orders/hooks/updateUserPurchases.ts`)
   - **Purpose**: Updates user purchase records

3. **clearUserCart** (`Orders/hooks/clearUserCart.ts`)
   - **Purpose**: Clears user cart after order

#### Pages Collection

1. **revalidatePage** (`Pages/hooks/revalidatePage.ts`)
   - **Purpose**: Revalidates page cache

#### Posts Collection

1. **revalidatePost** (`Posts/hooks/revalidatePost.ts`)
   - **Purpose**: Revalidates post pages

2. **populateAuthors** (`Posts/hooks/populateAuthors.ts`)
   - **Purpose**: Populates post author data

#### Global Hooks

1. **Header** (`globals/Header/hooks/revalidateHeader.ts`)
   - **Purpose**: Revalidates header global

2. **Footer** (`globals/Footer/hooks/revalidateFooter.ts`)
   - **Purpose**: Revalidates footer global

### Electric Hooks (`packages/sync/src/hooks/`)

Real-time data hooks using ElectricSQL.

1. **useAgentMemory** (`useAgentMemory.ts`)
   - **Purpose**: Agent memory management
   - **Schema**: `AgentMemorySchema` from `@revealui/schema`

2. **useAgentContext** (`useAgentContext.ts`)
   - **Purpose**: Agent context management
   - **Schema**: `AgentContextSchema` from `@revealui/schema`

3. **useConversations** (`useConversations.ts`)
   - **Purpose**: Conversation management
   - **Schema**: `ConversationSchema` from `@revealui/schema`

### Memory Hooks (`packages/memory/src/client/hooks/`)

Memory management hooks.

1. **useEpisodicMemory** (`useEpisodicMemory.ts`)
   - **Purpose**: Episodic memory management

2. **useWorkingMemory** (`useWorkingMemory.ts`)
   - **Purpose**: Working memory management

### API Routes (`apps/cms/src/app/api/`)

Server-side API endpoints that provide data to components.

1. **REST API** (`(backend)/api/[...slug]/route.ts`)
   - **Purpose**: RevealUI REST API handler
   - **Implementation**: `createRESTHandlers` from `@revealui/core/api/rest`
   - **Used by**: All collection operations

2. **Chat API** (`chat/route.ts`)
   - **Purpose**: Chat endpoint for AI agent
   - **Used by**: `useChat` hook

3. **Health Check** (`health/route.ts`)
   - **Purpose**: System health monitoring
   - **Checks**: Database, Stripe, Vercel Blob

4. **Health Ready** (`health/ready/route.ts`)
   - **Purpose**: Readiness probe

5. **Health Live** (`health/live/route.ts`)
   - **Purpose**: Liveness probe

6. **GDPR Export** (`gdpr/export/route.ts`)
   - **Purpose**: User data export

7. **GDPR Delete** (`gdpr/delete/route.ts`)
   - **Purpose**: User data deletion

8. **Memory APIs** (`memory/`)
   - **Working Memory** (`memory/working/[sessionId]/route.ts`)
   - **Episodic Memory** (`memory/episodic/[userId]/route.ts`, `memory/episodic/[userId]/[memoryId]/route.ts`)

9. **Form Submissions** (`form-submissions`)
   - **Purpose**: Form submission endpoint
   - **Used by**: `FormBlock` component

### Services API (`packages/services/src/core/api/`)

External service integrations.

1. **Stripe**
   - `create-checkout-session/index.ts`
   - `create-portal-link/index.ts`
   - `update-product/index.ts`
   - `update-price/index.ts`
   - `webhooks/index.ts`

2. **Codebase Scanning**
   - `scan-codebase/index.ts`

---

## Data Schemas & Contracts

### Schema Package (`packages/schema/src/`)

The central contract layer defining all data structures.

#### Core Schemas (`packages/schema/src/core/`)

1. **User Schema** (`user.ts`)
   - `UserSchema` - Complete user entity
   - `UserTypeSchema` - User type enum
   - `UserRoleSchema` - User role enum
   - `UserStatusSchema` - User status enum
   - `UserPreferencesSchema` - User preferences
   - `CreateUserInputSchema` - User creation input
   - `UpdateUserInputSchema` - User update input
   - `SessionSchema` - User session

2. **Site Schema** (`site.ts`)
   - `SiteSchema` - Complete site entity
   - `SiteStatusSchema` - Site status enum
   - `SiteThemeSchema` - Site theme configuration
   - `SiteSeoSchema` - SEO configuration
   - `SiteSettingsSchema` - Site settings
   - `SiteCollaboratorSchema` - Collaborator information
   - `CreateSiteInputSchema` - Site creation input
   - `UpdateSiteInputSchema` - Site update input

3. **Page Schema** (`page.ts`)
   - `PageSchema` - Complete page entity
   - `PageStatusSchema` - Page status enum
   - `PageSeoSchema` - Page SEO configuration
   - `PageLockSchema` - Page locking information
   - `CreatePageInputSchema` - Page creation input
   - `UpdatePageInputSchema` - Page update input

4. **Field Schema** (`field.ts`)
   - `FieldSchema` - Base field schema
   - `TextFieldSchema` - Text field
   - `NumberFieldSchema` - Number field
   - `RelationshipFieldSchema` - Relationship field
   - `ArrayFieldSchema` - Array field
   - `GroupFieldSchema` - Group field
   - `SelectFieldSchema` - Select field
   - `RowFieldSchema` - Row layout field
   - `TabsFieldSchema` - Tabs field
   - `FieldAdminConfigSchema` - Admin configuration
   - `FieldAccessConfigSchema` - Access control
   - `FieldHooksConfigSchema` - Hooks configuration

5. **Collection Schema** (`collection.ts`)
   - `CollectionConfigSchema` - Collection configuration
   - `CollectionLabelsSchema` - Collection labels
   - `CollectionAccessSchema` - Access control
   - `CollectionHooksSchema` - Hooks configuration
   - `CollectionAdminConfigSchema` - Admin configuration
   - `UploadConfigSchema` - Upload configuration
   - `AuthConfigSchema` - Auth configuration
   - `VersionsConfigSchema` - Versioning configuration

6. **Global Schema** (`global.ts`)
   - `GlobalConfigSchema` - Global configuration
   - `GlobalLabelsSchema` - Global labels
   - `GlobalAccessSchema` - Access control
   - `GlobalHooksSchema` - Hooks configuration
   - `GlobalAdminConfigSchema` - Admin configuration
   - `GlobalVersionsConfigSchema` - Versioning configuration

#### Block Schemas (`packages/schema/src/blocks/`)

1. **Base Block Schemas**
   - `BlockStyleSchema` - Visual styling
   - `BlockMetaSchema` - Block metadata
   - `BaseBlockSchema` - Common block fields

2. **Content Block Schemas**
   - `TextBlockSchema` - Text content
   - `HeadingBlockSchema` - Headings
   - `QuoteBlockSchema` - Quotes
   - `CodeBlockSchema` - Code blocks
   - `ListBlockSchema` - Lists

3. **Media Block Schemas**
   - `ImageBlockSchema` - Images
   - `VideoBlockSchema` - Videos
   - `EmbedBlockSchema` - Embeds

4. **Interactive Block Schemas**
   - `ButtonBlockSchema` - Buttons
   - `FormBlockSchema` - Forms
   - `AccordionBlockSchema` - Accordions
   - `TabsBlockSchema` - Tabs

5. **Layout Block Schemas**
   - `ColumnsBlockSchema` - Columns
   - `GridBlockSchema` - Grids
   - `DividerBlockSchema` - Dividers
   - `SpacerBlockSchema` - Spacers
   - `TableBlockSchema` - Tables

6. **Special Block Schemas**
   - `HtmlBlockSchema` - Raw HTML
   - `ComponentBlockSchema` - Custom components

7. **Union Schema**
   - `BlockSchema` - Union of all block types
   - `BlockTypes` - Block type enum

#### Agent Schemas (`packages/schema/src/agents/`)

1. **Agent Context** (`index.ts`)
   - `AgentContextSchema` - Agent context
   - `createAgentContext` - Factory function

2. **Agent Memory** (`index.ts`)
   - `AgentMemorySchema` - Memory structure
   - `MemoryTypeSchema` - Memory type enum
   - `MemorySourceSchema` - Memory source enum
   - `createAgentMemory` - Factory function

3. **Conversation** (`index.ts`)
   - `ConversationSchema` - Conversation structure
   - `ConversationMessageSchema` - Message structure
   - `createConversation` - Factory function
   - `createMessage` - Factory function

4. **Intent** (`index.ts`)
   - `IntentSchema` - Intent structure
   - `IntentTypeSchema` - Intent type enum

5. **Tools** (`index.ts`)
   - `ToolDefinitionSchema` - Tool definition
   - `ToolParameterSchema` - Tool parameter

6. **Agent Definition** (`index.ts`)
   - `AgentDefinitionSchema` - Complete agent definition

7. **Agent State** (`index.ts`)
   - `AgentStateSchema` - Complete agent state

#### Representation Schemas (`packages/schema/src/representation/`)

1. **Dual Entity Schema**
   - `DualEntitySchema` - Base entity with human + agent representation
   - `HumanRepresentationSchema` - Human-readable representation
   - `AgentRepresentationSchema` - Agent-readable representation

2. **Embeddings**
   - `EmbeddingSchema` - Vector embeddings
   - `EMBEDDING_DIMENSIONS` - Model dimensions
   - `createEmbedding` - Factory function

### Generated Types (`apps/cms/src/types/revealui.ts`)

Auto-generated TypeScript types from RevealUI config.

1. **Config Interface**
   - `Config` - Complete configuration type

2. **Collection Types**
   - `User`, `Tenant`, `Page`, `Media`, `Content`, `Category`, `Tag`
   - `Event`, `Card`, `Hero`, `Product`, `Price`, `Order`, `Post`
   - `Subscription`, `Banner`, `Redirect`, `Form`, `FormSubmission`

3. **Global Types**
   - `Settings`, `Header`, `Footer`

4. **Select Types**
   - `UsersSelect`, `PagesSelect`, `ProductsSelect`, etc.

5. **Auth Operations**
   - `UserAuthOperations` - Login, register, forgot password

### Validation Schemas (`apps/cms/src/lib/validation/`)

1. **Schemas** (`schemas.ts`)
   - Validation schemas for forms and data

2. **Stripe Schemas** (`stripe-schemas.ts`)
   - Stripe-specific validation

### Electric Schema (`packages/sync/src/schema.ts`)

ElectricSQL database schema for real-time sync.

---

## Component-to-Schema Relationships

### Block Components → Block Schemas

| Component | Schema | Location |
|-----------|--------|----------|
| `FormBlock` | `FormBlockSchema` | `@revealui/schema/blocks` |
| `CodeBlock` | `CodeBlockSchema` | `@revealui/schema/blocks` |
| `ContentBlock` | `TextBlockSchema` | `@revealui/schema/blocks` |
| `MediaBlock` | `ImageBlockSchema`, `VideoBlockSchema` | `@revealui/schema/blocks` |
| `CallToActionBlock` | `ButtonBlockSchema` | `@revealui/schema/blocks` |
| `ArchiveBlock` | Uses `Page` type | `@/types` |

### Form Components → Field Schemas

| Component | Schema | Location |
|-----------|--------|----------|
| `Form/Text` | `TextFieldSchema` | `@revealui/schema/core/field` |
| `Form/Email` | `TextFieldSchema` (email variant) | `@revealui/schema/core/field` |
| `Form/Number` | `NumberFieldSchema` | `@revealui/schema/core/field` |
| `Form/Select` | `SelectFieldSchema` | `@revealui/schema/core/field` |
| `Form/Checkbox` | `FieldSchema` (boolean) | `@revealui/schema/core/field` |
| `Form/Textarea` | `TextFieldSchema` (multiline) | `@revealui/schema/core/field` |

### Collection Components → Collection Schemas

| Component | Schema | Location |
|-----------|--------|----------|
| `FighterSelect` | `User` type | `@/types` |
| `ProductSelect` | `Product` type | `@/types` |
| `PricesSelect` | `Price` type | `@/types` |
| `CollectionArchive` | Collection types | `@/types` |

### Business Logic → Schemas

| Hook/Function | Schema | Location |
|---------------|--------|----------|
| `beforeProductChange` | `Product` type | `@/types` |
| `beforePriceChange` | `Price` type | `@/types` |
| `useAgentMemory` | `AgentMemorySchema` | `@revealui/schema/agents` |
| `useAgentContext` | `AgentContextSchema` | `@revealui/schema/agents` |
| `useConversations` | `ConversationSchema` | `@revealui/schema/agents` |

### API Routes → Schemas

| Route | Schema | Location |
|-------|--------|----------|
| `/api/[...slug]` | Collection schemas | `@/types` |
| `/api/chat` | `ConversationSchema` | `@revealui/schema/agents` |
| `/api/form-submissions` | `FormBlockSchema` | `@revealui/schema/blocks` |
| `/api/memory/*` | `AgentMemorySchema` | `@revealui/schema/agents` |

---

## Key Patterns

### 1. Dual Representation Pattern

All entities in `@revealui/schema` use the dual representation pattern:
- **Human Representation**: Labels, descriptions, icons for UI
- **Agent Representation**: Structured metadata, constraints, actions for AI

### 2. Schema Validation

- All schemas use Zod for runtime validation
- TypeScript types are inferred from Zod schemas
- Factory functions ensure proper initialization

### 3. Component Composition

- Blocks are composed using `RenderBlocks`
- Form fields are composed in `FormBlock`
- Components use React hooks for state management

### 4. Data Flow

1. **Schema Definition** → `@revealui/schema`
2. **Type Generation** → `apps/cms/src/types/revealui.ts`
3. **Component Props** → Extracted from types
4. **Business Logic** → Hooks and API routes
5. **Data Validation** → Zod schemas

### 5. Hook Pattern

- Collection hooks: `beforeChange`, `afterChange`, `beforeValidate`
- React hooks: `useChat`, `useAgentMemory`, etc.
- Custom hooks: Component-specific logic

---

## File Locations Summary

### UI Components
- **CMS Blocks**: `apps/cms/src/lib/blocks/`
- **CMS Components**: `apps/cms/src/lib/components/`
- **Framework UI**: `packages/revealui/src/client/ui/`
- **Web App**: `apps/web/src/components/`
- **RevealUI Elements**: `apps/cms/src/components/revealui/`

### Business Logic
- **Hooks**: `apps/cms/src/lib/hooks/`
- **Collection Hooks**: `apps/cms/src/lib/collections/*/hooks/`
- **API Routes**: `apps/cms/src/app/api/`
- **Electric Hooks**: `packages/sync/src/hooks/`
- **Memory Hooks**: `packages/memory/src/client/hooks/`

### Data Schemas
- **Core Schemas**: `packages/schema/src/core/`
- **Block Schemas**: `packages/schema/src/blocks/`
- **Agent Schemas**: `packages/schema/src/agents/`
- **Generated Types**: `apps/cms/src/types/revealui.ts`
- **Validation**: `apps/cms/src/lib/validation/`

---

## Next Steps

To extend this mapping:

1. **Add New Block**: Create component in `apps/cms/src/lib/blocks/`, add schema in `packages/schema/src/blocks/`, register in `RenderBlocks.tsx`
2. **Add New Hook**: Create in appropriate `hooks/` directory, reference in component
3. **Add New Schema**: Create in `packages/schema/src/`, export from `index.ts`, use in components
4. **Add New API Route**: Create in `apps/cms/src/app/api/`, reference in hooks/components

---

## Related Documentation

- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure
- [Architecture Overview](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
- [Dependencies List](./DEPENDENCIES-LIST.md) - Complete dependencies
- [Frameworks List](./FRAMEWORKS-LIST.md) - Framework usage
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../TASKS.md) - Find docs by task
- [Keywords Index](../KEYWORDS.md) - Search by keyword

---

*Last Updated: Generated from codebase analysis*
*Schema Version: See individual schema files for version numbers*
