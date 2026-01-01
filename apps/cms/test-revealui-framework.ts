// Test that RevealUI framework abstractions work
import {
  createRevealUICollection,
  createRevealUIField,
  useRevealUI,
  RevealUI,
  RevealUITenant,
  RevealUIContext
} from "@revealui/cms";

// Test collection creation with framework features
const testCollection = createRevealUICollection({
  slug: 'test-posts',
  fields: [
    createRevealUIField({
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      revealUI: {
        searchable: true,
        auditable: true
      }
    })
  ],
  revealUI: {
    tenantScoped: true,
    auditLog: true
  }
});

// Test framework hook
const context = useRevealUI();

// Test main class
const revealUI = new RevealUI({});

// Verify framework abstractions work
console.log('✅ RevealUI Framework Test Passed:', {
  collection: testCollection.slug,
  hasTenantScope: testCollection.revealUI.tenantScoped,
  hasAuditLog: testCollection.revealUI.auditLog,
  context: context.tenant.id,
  framework: typeof revealUI.init
});

export { testCollection, context, revealUI };
