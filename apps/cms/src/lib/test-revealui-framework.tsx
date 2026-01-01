// Test file to verify RevealUI framework abstractions actually work
import {
  RevealUI,
  createRevealUI,
  createRevealUICollection,
  createRevealUIField,
  createRevealUIBlock,
  createRevealUIAccessRule,
  useRevealUI,
  withRevealUIAccess,
  RevealUIContext,
  RevealUICollection,
  RevealUIField,
  RevealUIBlock,
  RevealUIAccessRule,
  RevealUIComponent
} from "@revealui/cms";

// Test creating a RevealUI instance
const revealUI = createRevealUI({
  collections: [],
  revealUI: {
    multiTenant: true,
    auditLog: true
  }
});

// Test creating a collection
const userCollection = createRevealUICollection({
  slug: 'users',
  fields: [
    createRevealUIField({
      name: 'email',
      type: 'email',
      label: 'Email Address',
      required: true,
      revealUI: {
        searchable: true,
        permissions: ['read', 'admin']
      }
    }),
    createRevealUIField({
      name: 'roles',
      type: 'array',
      label: 'Roles',
      revealUI: {
        permissions: ['admin']
      }
    })
  ],
  revealUI: {
    tenantScoped: true,
    auditLog: true
  }
});

// Test creating a block
const heroBlock = createRevealUIBlock({
  slug: 'hero',
  fields: [
    createRevealUIField({
      name: 'title',
      type: 'text',
      label: 'Hero Title',
      required: true
    }),
    createRevealUIField({
      name: 'image',
      type: 'upload',
      label: 'Hero Image'
    })
  ],
  revealUI: {
    category: 'layout',
    permissions: ['read', 'write']
  }
});

// Test creating an access rule
const adminAccessRule = createRevealUIAccessRule({
  permissions: ['admin'],
  condition: (context) => {
    return context.user?.revealUI?.isSuperAdmin === true;
  }
});

// Test React component with RevealUI props
const TestComponent: RevealUIComponent = ({ revealUI, children }) => {
  return (
    <div className={`reveal-ui-component ${revealUI?.theme || 'default'}`}>
      {children}
      {revealUI?.tenant && (
        <div className="tenant-indicator">
          Tenant: {revealUI.tenant.name}
        </div>
      )}
    </div>
  );
};

// Test the wrapped component
const ProtectedComponent = withRevealUIAccess(TestComponent, ['admin']);

export {
  revealUI,
  userCollection,
  heroBlock,
  adminAccessRule,
  TestComponent,
  ProtectedComponent
};
