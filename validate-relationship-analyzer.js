// Manual validation of relationship analyzer
// This is a simple Node.js script to test the relationship analyzer functionality

const toSnakeCase = require('to-snake-case');

// Mock the relationship analyzer logic inline for testing
function getRelationshipFields(collectionConfig) {
  const relationships = [];
  const tableName = toSnakeCase(collectionConfig.slug);

  // Recursively traverse fields to find all relationships
  function traverseFields(fields, currentPath = '') {
    for (const field of fields) {
      const fieldPath = currentPath ? `${currentPath}.${field.name}` : field.name;

      // Check if this is a relationship field
      if (field.type === 'relationship' || field.type === 'upload') {
        const metadata = createRelationshipMetadata(field, fieldPath, tableName);
        if (metadata) {
          relationships.push(metadata);
        }
      }

      // Recursively check nested fields (for arrays, groups, etc.)
      if ('fields' in field && Array.isArray(field.fields)) {
        traverseFields(field.fields, fieldPath);
      }
    }
  }

  traverseFields(collectionConfig.fields);
  return relationships;
}

function createRelationshipMetadata(field, fieldPath, parentTableName) {
  // Skip if not a relationship field
  if (field.type !== 'relationship' && field.type !== 'upload') {
    return null;
  }

  // Skip if no relationTo (shouldn't happen but safety check)
  if (!field.relationTo) {
    return null;
  }

  const relationTo = field.relationTo;
  const hasMany = field.hasMany || false;
  const isPolymorphic = Array.isArray(relationTo);

  // Determine storage type based on PayloadCMS analysis
  let storageType;
  if (isPolymorphic) {
    storageType = 'polymorphic';
  } else if (hasMany) {
    storageType = 'junction_table';
  } else {
    storageType = 'direct_fk';
  }

  // Generate table/column names
  const tableName = storageType === 'direct_fk'
    ? parentTableName // main table for direct FKs
    : `${parentTableName}_rels`; // junction table

  const fkColumnName = storageType === 'direct_fk'
    ? `${field.name}_id` // e.g., author_id
    : ''; // junction tables have multiple FK columns

  return {
    fieldName: field.name,
    storageType,
    relationTo,
    hasMany,
    localized: false, // TODO: detect localization from collection/global context
    tableName,
    fkColumnName,
    path: fieldPath,
  };
}

function validateRelationshipMetadata(metadata) {
  const errors = [];

  for (const rel of metadata) {
    // Validate storage type logic
    if (rel.storageType === 'polymorphic' && !Array.isArray(rel.relationTo)) {
      errors.push(`Polymorphic relationship ${rel.fieldName} must have array relationTo`);
    }

    if (rel.storageType === 'direct_fk' && rel.hasMany) {
      errors.push(`Direct FK relationship ${rel.fieldName} cannot have hasMany=true`);
    }

    if (rel.storageType !== 'direct_fk' && rel.fkColumnName) {
      errors.push(`Non-direct-FK relationship ${rel.fieldName} should not have fkColumnName`);
    }

    // Validate table name format
    if (rel.storageType === 'direct_fk' && rel.tableName.includes('_rels')) {
      errors.push(`Direct FK relationship ${rel.fieldName} should not use _rels table`);
    }

    if (rel.storageType !== 'direct_fk' && !rel.tableName.includes('_rels')) {
      errors.push(`Junction table relationship ${rel.fieldName} should use _rels table`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Test data
const testCollections = {
  posts: {
    slug: 'posts',
    fields: [
      {
        name: 'author',
        type: 'relationship',
        relationTo: 'users',
        required: true,
      },
      {
        name: 'categories',
        type: 'relationship',
        relationTo: 'categories',
        hasMany: true,
      },
      {
        name: 'featuredMedia',
        type: 'upload',
        relationTo: 'media',
      },
      {
        name: 'contentBlocks',
        type: 'array',
        fields: [
          {
            name: 'media',
            type: 'upload',
            relationTo: 'media',
          },
        ],
      },
    ],
  },

  users: {
    slug: 'users',
    fields: [
      {
        name: 'avatar',
        type: 'upload',
        relationTo: 'media',
      },
      {
        name: 'tenants',
        type: 'relationship',
        relationTo: ['tenants', 'organizations'], // Polymorphic
        hasMany: true,
      },
    ],
  },
};

console.log('🧪 VALIDATING RELATIONSHIP ANALYZER');
console.log('=====================================\n');

// Test posts collection
console.log('📝 Testing Posts Collection:');
const postsRelationships = getRelationshipFields(testCollections.posts);
console.log(`Found ${postsRelationships.length} relationships:`);

postsRelationships.forEach(rel => {
  console.log(`  - ${rel.fieldName}: ${rel.storageType} -> ${Array.isArray(rel.relationTo) ? rel.relationTo.join(',') : rel.relationTo} (${rel.hasMany ? 'hasMany' : 'single'})`);
  console.log(`    Table: ${rel.tableName}, FK: ${rel.fkColumnName || 'N/A'}, Path: ${rel.path}`);
});

// Test users collection
console.log('\n📝 Testing Users Collection:');
const usersRelationships = getRelationshipFields(testCollections.users);
console.log(`Found ${usersRelationships.length} relationships:`);

usersRelationships.forEach(rel => {
  console.log(`  - ${rel.fieldName}: ${rel.storageType} -> ${Array.isArray(rel.relationTo) ? rel.relationTo.join(',') : rel.relationTo} (${rel.hasMany ? 'hasMany' : 'single'})`);
  console.log(`    Table: ${rel.tableName}, FK: ${rel.fkColumnName || 'N/A'}, Path: ${rel.path}`);
});

// Test validation
console.log('\n🔍 VALIDATION RESULTS:');
const allRelationships = [...postsRelationships, ...usersRelationships];
const validation = validateRelationshipMetadata(allRelationships);

if (validation.valid) {
  console.log('✅ All relationships are valid!');
} else {
  console.log('❌ Validation errors found:');
  validation.errors.forEach(error => {
    console.log(`  - ${error}`);
  });
}

console.log('\n🎉 RELATIONSHIP ANALYZER VALIDATION COMPLETE!');
console.log('Expected results:');
console.log('  - Posts: 4 relationships (author: direct_fk, categories: junction_table, featuredMedia: direct_fk, contentBlocks.media: direct_fk)');
console.log('  - Users: 2 relationships (avatar: direct_fk, tenants: polymorphic)');
console.log('  - All validations should pass');
