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
    });

    it('exports db tables', async () => {
      const { users } = await import('../index.js');

      expect(users.users).toBeDefined();
      expect(users.sessions).toBeDefined();
    });

    it('exports contract schemas', async () => {
      const { users } = await import('../index.js');

      expect(users.UserSchema).toBeDefined();
      expect(users.CreateUserInputSchema).toBeDefined();
      expect(typeof users.createUser).toBe('function');
    });
  });

  describe('content', () => {
    it('exports core factories', async () => {
      const { content } = await import('../index.js');

      expect(typeof content.createRevealUI).toBe('function');
      expect(typeof content.buildConfig).toBe('function');
    });

    it('exports db tables', async () => {
      const { content } = await import('../index.js');

      expect(content.pages).toBeDefined();
      expect(content.sites).toBeDefined();
    });

    it('exports contract schemas', async () => {
      const { content } = await import('../index.js');

      expect(content.PageSchema).toBeDefined();
      expect(content.SiteSchema).toBeDefined();
      expect(typeof content.createPage).toBe('function');
    });
  });

  describe('products', () => {
    it('exports db tables', async () => {
      const { products } = await import('../index.js');

      expect(products.products).toBeDefined();
      expect(products.orders).toBeDefined();
    });

    it('exports pricing contracts', async () => {
      const { products } = await import('../index.js');

      expect(products.SUBSCRIPTION_TIERS).toBeDefined();
      expect(products.PERPETUAL_TIERS).toBeDefined();
      expect(products.TIER_LIMITS).toBeDefined();
    });
  });

  describe('payments', () => {
    it('exports Stripe functions', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.getStripe).toBe('function');
      expect(typeof payments.createPaymentIntent).toBe('function');
    });

    it('exports license gates', async () => {
      const { payments } = await import('../index.js');

      expect(typeof payments.isLicensed).toBe('function');
      expect(typeof payments.isFeatureEnabled).toBe('function');
      expect(typeof payments.getCurrentTier).toBe('function');
    });

    it('exports billing tables', async () => {
      const { payments } = await import('../index.js');

      expect(payments.accounts).toBeDefined();
      expect(payments.licenses).toBeDefined();
    });
  });

  describe('intelligence', () => {
    it('exports AI license check', async () => {
      const { intelligence } = await import('../index.js');

      expect(typeof intelligence.checkAiLicense).toBe('function');
    });

    it('exports agent tables', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.agentContexts).toBeDefined();
      expect(intelligence.agentMemories).toBeDefined();
      expect(intelligence.conversations).toBeDefined();
    });

    it('exports agent contract schemas', async () => {
      const { intelligence } = await import('../index.js');

      expect(intelligence.AgentMemorySchema).toBeDefined();
      expect(intelligence.ToolDefinitionSchema).toBeDefined();
      expect(typeof intelligence.createAgentMemory).toBe('function');
    });
  });
});
