import { describe, expect, it } from 'vitest';

describe('@revealui/engines', () => {
  it('exports five business primitive namespaces', async () => {
    const engines = await import('../index.js');

    expect(engines.users).toBeDefined();
    expect(engines.content).toBeDefined();
    expect(engines.products).toBeDefined();
    expect(engines.payments).toBeDefined();
    expect(engines.intelligence).toBeDefined();
  }, 15_000);

  describe('users', () => {
    it('exports auth functions', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.signIn).toBe('function');
      expect(typeof users.signUp).toBe('function');
      expect(typeof users.createSession).toBe('function');
      expect(typeof users.getSession).toBe('function');
      expect(typeof users.deleteSession).toBe('function');
      expect(typeof users.changePassword).toBe('function');
      expect(typeof users.rotateSession).toBe('function');
    });

    it('exports MFA functions', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.initiateMFASetup).toBe('function');
      expect(typeof users.verifyMFASetup).toBe('function');
      expect(typeof users.verifyMFACode).toBe('function');
      expect(typeof users.isMFAEnabled).toBe('function');
      expect(typeof users.disableMFA).toBe('function');
      expect(typeof users.regenerateBackupCodes).toBe('function');
      expect(typeof users.verifyBackupCode).toBe('function');
    });

    it('exports passkey functions', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.generateRegistrationChallenge).toBe('function');
      expect(typeof users.verifyRegistration).toBe('function');
      expect(typeof users.generateAuthenticationChallenge).toBe('function');
      expect(typeof users.verifyAuthentication).toBe('function');
      expect(typeof users.storePasskey).toBe('function');
      expect(typeof users.listPasskeys).toBe('function');
      expect(typeof users.deletePasskey).toBe('function');
      expect(typeof users.renamePasskey).toBe('function');
    });

    it('exports OAuth functions', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.generateOAuthState).toBe('function');
      expect(typeof users.verifyOAuthState).toBe('function');
      expect(typeof users.exchangeCode).toBe('function');
      expect(typeof users.upsertOAuthUser).toBe('function');
      expect(typeof users.linkOAuthAccount).toBe('function');
      expect(typeof users.unlinkOAuthAccount).toBe('function');
      expect(typeof users.getLinkedProviders).toBe('function');
    });

    it('exports brute force protection', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.configureBruteForce).toBe('function');
      expect(typeof users.recordFailedAttempt).toBe('function');
      expect(typeof users.getFailedAttemptCount).toBe('function');
      expect(typeof users.clearFailedAttempts).toBe('function');
      expect(typeof users.isAccountLocked).toBe('function');
    });

    it('exports audit log functions', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.auditLoginSuccess).toBe('function');
      expect(typeof users.auditLoginFailure).toBe('function');
      expect(typeof users.auditPasswordChange).toBe('function');
      expect(typeof users.auditPasswordReset).toBe('function');
      expect(typeof users.auditSessionRevoked).toBe('function');
      expect(typeof users.auditAccountLocked).toBe('function');
      expect(typeof users.auditMfaEnabled).toBe('function');
      expect(typeof users.auditMfaDisabled).toBe('function');
    });

    it('exports React hooks', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.useSession).toBe('function');
      expect(typeof users.useSignIn).toBe('function');
      expect(typeof users.useSignUp).toBe('function');
      expect(typeof users.useSignOut).toBe('function');
      expect(typeof users.useMFASetup).toBe('function');
      expect(typeof users.useMFAVerify).toBe('function');
      expect(typeof users.usePasskeyRegister).toBe('function');
      expect(typeof users.usePasskeySignIn).toBe('function');
    });

    it('exports error classes', async () => {
      const { users } = await import('../index.js');

      expect(users.AuthError).toBeDefined();
      expect(users.AuthenticationError).toBeDefined();
      expect(users.SessionError).toBeDefined();
      expect(users.TokenError).toBeDefined();
      expect(users.OAuthAccountConflictError).toBeDefined();
    });

    it('exports storage implementations', async () => {
      const { users } = await import('../index.js');

      expect(typeof users.createStorage).toBe('function');
      expect(typeof users.getStorage).toBe('function');
      expect(users.DatabaseStorage).toBeDefined();
      expect(users.InMemoryStorage).toBeDefined();
    });

    it('exports all db tables', async () => {
      const { users } = await import('../index.js');

      expect(users.users).toBeDefined();
      expect(users.sessions).toBeDefined();
      expect(users.failedAttempts).toBeDefined();
      expect(users.magicLinks).toBeDefined();
      expect(users.oauthAccounts).toBeDefined();
      expect(users.passkeys).toBeDefined();
      expect(users.passwordResetTokens).toBeDefined();
    });

    it('exports contract schemas with parse functions', async () => {
      const { users } = await import('../index.js');

      expect(users.UserSchema).toBeDefined();
      expect(typeof users.UserSchema.parse).toBe('function');
      expect(users.CreateUserInputSchema).toBeDefined();
      expect(typeof users.CreateUserInputSchema.parse).toBe('function');
      expect(users.UpdateUserInputSchema).toBeDefined();
      expect(users.UserRoleSchema).toBeDefined();
      expect(users.UserPreferencesSchema).toBeDefined();
      expect(users.UserStatusSchema).toBeDefined();
      expect(users.UserTypeSchema).toBeDefined();
      expect(typeof users.createUser).toBe('function');
      expect(users.USER_SCHEMA_VERSION).toBeDefined();
    });

    it('validates user role enum values', async () => {
      const { users } = await import('../index.js');

      const result = users.UserRoleSchema.safeParse('admin');
      expect(result.success).toBe(true);

      const invalid = users.UserRoleSchema.safeParse('superuser');
      expect(invalid.success).toBe(false);
    });
  });

  describe('content', () => {
    it('exports core factories', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.createRevealUI).toBe('function');
      expect(typeof content.buildConfig).toBe('function');
      expect(typeof content.getRevealUI).toBe('function');
      expect(typeof content.createRevealUICollection).toBe('function');
      expect(typeof content.createRevealUIField).toBe('function');
      expect(typeof content.createRevealUIBlock).toBe('function');
    });

    it('exports rich text features', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.lexicalEditor).toBe('function');
      expect(typeof content.serializeLexicalState).toBe('function');
      expect(content.BoldFeature).toBeDefined();
      expect(content.ItalicFeature).toBeDefined();
      expect(content.UnderlineFeature).toBeDefined();
      expect(content.HeadingFeature).toBeDefined();
      expect(content.LinkFeature).toBeDefined();
      expect(content.FixedToolbarFeature).toBeDefined();
    });

    it('exports plugins', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.formBuilderPlugin).toBe('function');
      expect(typeof content.nestedDocsPlugin).toBe('function');
      expect(typeof content.redirectsPlugin).toBe('function');
    });

    it('exports access control helpers', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.anyone).toBe('function');
      expect(typeof content.authenticated).toBe('function');

      expect(content.anyone({ req: {} as never })).toBe(true);
    });

    it('exports database adapter', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.universalPostgresAdapter).toBe('function');
    });

    it('exports all db tables', async () => {
      const { content } = await import('../index.js');

      expect(content.pages).toBeDefined();
      expect(content.sites).toBeDefined();
      expect(content.siteCollaborators).toBeDefined();
      expect(content.pageRevisions).toBeDefined();
      expect(content.posts).toBeDefined();
      expect(content.media).toBeDefined();
    });

    it('exports page contract schemas', async () => {
      const { content } = await import('../index.js');

      expect(content.PageSchema).toBeDefined();
      expect(typeof content.PageSchema.parse).toBe('function');
      expect(content.PageLockSchema).toBeDefined();
      expect(content.PageSeoSchema).toBeDefined();
      expect(content.PageStatusSchema).toBeDefined();
      expect(content.CreatePageInputSchema).toBeDefined();
      expect(content.UpdatePageInputSchema).toBeDefined();
      expect(typeof content.createPage).toBe('function');
      expect(content.PAGE_SCHEMA_VERSION).toBeDefined();
    });

    it('exports site contract schemas', async () => {
      const { content } = await import('../index.js');

      expect(content.SiteSchema).toBeDefined();
      expect(typeof content.SiteSchema.parse).toBe('function');
      expect(content.SiteCollaboratorSchema).toBeDefined();
      expect(content.SiteSettingsSchema).toBeDefined();
      expect(content.SiteSeoSchema).toBeDefined();
      expect(content.SiteStatusSchema).toBeDefined();
      expect(content.SiteThemeSchema).toBeDefined();
      expect(content.CreateSiteInputSchema).toBeDefined();
      expect(content.UpdateSiteInputSchema).toBeDefined();
      expect(typeof content.createSite).toBe('function');
      expect(content.SITE_SCHEMA_VERSION).toBeDefined();
    });

    it('exports block type guards', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.isTextBlock).toBe('function');
      expect(typeof content.isHeadingBlock).toBe('function');
      expect(typeof content.isImageBlock).toBe('function');
      expect(typeof content.isColumnsBlock).toBe('function');
      expect(typeof content.isGridBlock).toBe('function');
      expect(typeof content.isContainerBlock).toBe('function');
    });

    it('exports block factory functions', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.createTextBlock).toBe('function');
      expect(typeof content.createHeadingBlock).toBe('function');
      expect(typeof content.createImageBlock).toBe('function');
      expect(typeof content.createCodeBlock).toBe('function');
    });

    it('exports block utilities', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.findBlockById).toBe('function');
      expect(typeof content.walkBlocks).toBe('function');
      expect(typeof content.countBlocks).toBe('function');
      expect(typeof content.estimateWordCount).toBe('function');
      expect(typeof content.computePagePath).toBe('function');
      expect(typeof content.getPageBreadcrumbs).toBe('function');
      expect(content.BLOCK_SCHEMA_VERSION).toBeDefined();
    });

    it('exports page permission helpers', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.isPageLocked).toBe('function');
      expect(typeof content.isLockedByUser).toBe('function');
      expect(typeof content.canUserPerformAction).toBe('function');
      expect(typeof content.canAgentEditSite).toBe('function');
    });

    it('validates page status enum', async () => {
      const { content } = await import('../index.js');

      const result = content.PageStatusSchema.safeParse('draft');
      expect(result.success).toBe(true);

      const invalid = content.PageStatusSchema.safeParse('deleted');
      expect(invalid.success).toBe(false);
    });
  });

  describe('products', () => {
    it('exports db tables', async () => {
      const { products } = await import('../index.js');

      expect(products.products).toBeDefined();
      expect(products.orders).toBeDefined();
    });

    it('exports subscription tier constants', async () => {
      const { products } = await import('../index.js');

      expect(products.SUBSCRIPTION_TIERS).toBeDefined();
      expect(Array.isArray(products.SUBSCRIPTION_TIERS)).toBe(true);
      expect(products.SUBSCRIPTION_TIERS.length).toBeGreaterThan(0);
    });

    it('exports perpetual tier constants', async () => {
      const { products } = await import('../index.js');

      expect(products.PERPETUAL_TIERS).toBeDefined();
      expect(Array.isArray(products.PERPETUAL_TIERS)).toBe(true);
      expect(products.PERPETUAL_TIERS.length).toBeGreaterThan(0);
    });

    it('exports tier limit and display maps', async () => {
      const { products } = await import('../index.js');

      expect(products.TIER_LIMITS).toBeDefined();
      expect(products.TIER_COLORS).toBeDefined();
      expect(products.TIER_LABELS).toBeDefined();
      expect(typeof products.getTierColor).toBe('function');
      expect(typeof products.getTierLabel).toBe('function');
      expect(typeof products.getTiersFromCurrent).toBe('function');
    });

    it('exports RevealCoin token config', async () => {
      const { products } = await import('../index.js');

      expect(products.RVUI_TOKEN_CONFIG).toBeDefined();
      expect(products.RVUI_TOKEN_CONFIG.symbol).toBe('RVUI');
      expect(typeof products.RVUI_TOKEN_CONFIG.decimals).toBe('number');
      expect(products.RVUI_MINT_ADDRESSES).toBeDefined();
      expect(products.RVUI_ALLOCATIONS).toBeDefined();
      expect(products.RVUI_DISCOUNT_RATES).toBeDefined();
    });

    it('exports RevealCoin utility functions', async () => {
      const { products } = await import('../index.js');

      expect(typeof products.getRvuiMintAddress).toBe('function');
      expect(typeof products.formatRvuiAmount).toBe('function');
      expect(typeof products.parseRvuiAmount).toBe('function');
    });

    it('round-trips RVUI amount formatting', async () => {
      const { products } = await import('../index.js');

      const amount = 1_000_000n;
      const formatted = products.formatRvuiAmount(amount);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);

      const parsed = products.parseRvuiAmount(formatted);
      expect(parsed).toBe(amount);
    });

    it('exports credit bundles', async () => {
      const { products } = await import('../index.js');

      expect(products.CREDIT_BUNDLES).toBeDefined();
      expect(Array.isArray(products.CREDIT_BUNDLES)).toBe(true);
      expect(products.CREDIT_BUNDLES.length).toBeGreaterThan(0);
    });
  });

  describe('payments', () => {
    it('exports Stripe functions', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.getStripe).toBe('function');
      expect(payments.protectedStripe).toBeDefined();
      expect(typeof payments.createPaymentIntent).toBe('function');
    });

    it('exports license gate functions', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.isLicensed).toBe('function');
      expect(typeof payments.isFeatureEnabled).toBe('function');
      expect(typeof payments.getCurrentTier).toBe('function');
      expect(typeof payments.getMaxSites).toBe('function');
      expect(typeof payments.getMaxUsers).toBe('function');
      expect(typeof payments.getFeatures).toBe('function');
      expect(typeof payments.getFeaturesForTier).toBe('function');
      expect(typeof payments.getRequiredTier).toBe('function');
    });

    it('exports license key management', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.initializeLicense).toBe('function');
      expect(typeof payments.validateLicenseKey).toBe('function');
      expect(typeof payments.generateLicenseKey).toBe('function');
    });

    it('exports all billing tables', async () => {
      const { payments } = await import('../index.js');

      expect(payments.accounts).toBeDefined();
      expect(payments.licenses).toBeDefined();
      expect(payments.accountSubscriptions).toBeDefined();
      expect(payments.accountMemberships).toBeDefined();
      expect(payments.accountEntitlements).toBeDefined();
      expect(payments.usageMeters).toBeDefined();
    });

    it('exports RevealCoin payment functions', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.configureRevealCoin).toBe('function');
      expect(typeof payments.getRevealCoinConfig).toBe('function');
      expect(typeof payments.getRvuiBalance).toBe('function');
      expect(typeof payments.fetchRvuiPrice).toBe('function');
      expect(typeof payments.rvuiToUsd).toBe('function');
      expect(typeof payments.usdToRvui).toBe('function');
      expect(typeof payments.verifyRvuiPayment).toBe('function');
    });

    it('exports price oracle functions', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.configurePriceOracle).toBe('function');
      expect(typeof payments.startPriceOracle).toBe('function');
      expect(typeof payments.stopPriceOracle).toBe('function');
    });

    it('exports service safeguard functions', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.configureSafeguards).toBe('function');
      expect(typeof payments.checkServicesLicense).toBe('function');
      expect(typeof payments.validatePayment).toBe('function');
    });
  });

  describe('intelligence', () => {
    it('exports AI license check', async () => {
      const { intelligence } = await import('../index.js');

      expect(typeof intelligence.checkAiLicense).toBe('function');
    });

    it('exports all agent db tables', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.agentContexts).toBeDefined();
      expect(intelligence.agentMemories).toBeDefined();
      expect(intelligence.conversations).toBeDefined();
      expect(intelligence.agentActions).toBeDefined();
      expect(intelligence.ragDocuments).toBeDefined();
      expect(intelligence.ragChunks).toBeDefined();
      expect(intelligence.codeProvenance).toBeDefined();
      expect(intelligence.codeReviews).toBeDefined();
    });

    it('exports agent definition schema with validation', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.AgentDefinitionSchema).toBeDefined();
      expect(typeof intelligence.AgentDefinitionSchema.parse).toBe('function');
      expect(intelligence.AGENT_SCHEMA_VERSION).toBeDefined();
    });

    it('exports agent state and context schemas', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.AgentStateSchema).toBeDefined();
      expect(intelligence.AgentContextSchema).toBeDefined();
      expect(intelligence.AgentActionRecordSchema).toBeDefined();
      expect(intelligence.AgentMemorySchema).toBeDefined();
      expect(typeof intelligence.createAgentContext).toBe('function');
      expect(typeof intelligence.createAgentMemory).toBe('function');
    });

    it('exports A2A protocol schemas', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.A2AAgentCardSchema).toBeDefined();
      expect(typeof intelligence.A2AAgentCardSchema.parse).toBe('function');
      expect(typeof intelligence.agentDefinitionToCard).toBe('function');
    });

    it('exports conversation schemas and factories', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.ConversationSchema).toBeDefined();
      expect(intelligence.ConversationMessageSchema).toBeDefined();
      expect(typeof intelligence.createConversation).toBe('function');
      expect(typeof intelligence.createMessage).toBe('function');
    });

    it('exports embedding utilities', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.EmbeddingSchema).toBeDefined();
      expect(typeof intelligence.createEmbedding).toBe('function');
      expect(intelligence.DEFAULT_EMBEDDING_MODEL).toBeDefined();
      expect(intelligence.DEFAULT_EMBEDDING_DIMENSION).toBeDefined();
      expect(intelligence.EMBEDDING_DIMENSIONS).toBeDefined();
    });

    it('exports tool and intent schemas', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.ToolDefinitionSchema).toBeDefined();
      expect(typeof intelligence.toolDefinitionToSkill).toBe('function');
      expect(intelligence.IntentSchema).toBeDefined();
    });
  });

  describe('cross-engine consistency', () => {
    it('users db tables are Drizzle table objects', async () => {
      const { users } = await import('../index.js');

      const drizzleName = Symbol.for('drizzle:Name');
      for (const table of [
        users.users,
        users.sessions,
        users.failedAttempts,
        users.magicLinks,
        users.oauthAccounts,
        users.passkeys,
        users.passwordResetTokens,
      ]) {
        expect(drizzleName in (table as object)).toBe(true);
      }
    });

    it('content db tables are Drizzle table objects', async () => {
      const { content } = await import('../index.js');

      const drizzleName = Symbol.for('drizzle:Name');
      for (const table of [
        content.pages,
        content.sites,
        content.siteCollaborators,
        content.pageRevisions,
        content.posts,
        content.media,
      ]) {
        expect(drizzleName in (table as object)).toBe(true);
      }
    });

    it('payments db tables are Drizzle table objects', async () => {
      const { payments } = await import('../index.js');

      const drizzleName = Symbol.for('drizzle:Name');
      for (const table of [
        payments.accounts,
        payments.licenses,
        payments.accountSubscriptions,
        payments.accountMemberships,
        payments.accountEntitlements,
        payments.usageMeters,
      ]) {
        expect(drizzleName in (table as object)).toBe(true);
      }
    });

    it('intelligence db tables are Drizzle table objects', async () => {
      const { intelligence } = await import('../index.js');

      const drizzleName = Symbol.for('drizzle:Name');
      for (const table of [
        intelligence.agentContexts,
        intelligence.agentMemories,
        intelligence.conversations,
        intelligence.agentActions,
        intelligence.ragDocuments,
        intelligence.ragChunks,
        intelligence.codeProvenance,
        intelligence.codeReviews,
      ]) {
        expect(drizzleName in (table as object)).toBe(true);
      }
    });

    it('all namespaces are distinct objects', async () => {
      const engines = await import('../index.js');

      const namespaces = [
        engines.users,
        engines.content,
        engines.products,
        engines.payments,
        engines.intelligence,
      ];

      for (let i = 0; i < namespaces.length; i++) {
        for (let j = i + 1; j < namespaces.length; j++) {
          expect(namespaces[i]).not.toBe(namespaces[j]);
        }
      }
    });
  });
});
