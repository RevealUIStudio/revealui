import { describe, expect, it } from 'vitest';
import { formBuilderPlugin } from '../form-builder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
function createBaseConfig(collections: any[] = []) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  return { collections } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('formBuilderPlugin', () => {
  describe('forms collection', () => {
    it('adds forms and form-submissions collections', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const slugs = result.collections.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain('forms');
      expect(slugs).toContain('form-submissions');
    });

    it('forms collection has required default fields', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const forms = result.collections.find((c: { slug: string }) => c.slug === 'forms');
      const fieldNames = forms.fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain('title');
      expect(fieldNames).toContain('fields');
      expect(fieldNames).toContain('confirmationMessage');
      expect(fieldNames).toContain('redirect');
      expect(fieldNames).toContain('emails');
    });

    it('forms collection uses title as admin title', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const forms = result.collections.find((c: { slug: string }) => c.slug === 'forms');
      expect(forms.admin.useAsTitle).toBe('title');
    });

    it('forms collection has timestamps', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const forms = result.collections.find((c: { slug: string }) => c.slug === 'forms');
      expect(forms.timestamps).toBe(true);
    });

    it('fields array includes all expected field types', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const forms = result.collections.find((c: { slug: string }) => c.slug === 'forms');
      const fieldsField = forms.fields.find((f: { name: string }) => f.name === 'fields');
      const typeField = fieldsField.fields.find((f: { name: string }) => f.name === 'type');
      const optionValues = typeField.options.map((o: { value: string }) => o.value);
      expect(optionValues).toEqual([
        'text',
        'email',
        'textarea',
        'checkbox',
        'select',
        'radio',
        'number',
        'date',
        'phone',
        'country',
      ]);
    });
  });

  describe('submissions collection', () => {
    it('has required default fields', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const submissions = result.collections.find(
        (c: { slug: string }) => c.slug === 'form-submissions',
      );
      const fieldNames = submissions.fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain('form');
      expect(fieldNames).toContain('submissionData');
      expect(fieldNames).toContain('submittedAt');
    });

    it('form field is a relationship to forms', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig();

      const result = plugin(config);

      const submissions = result.collections.find(
        (c: { slug: string }) => c.slug === 'form-submissions',
      );
      const formField = submissions.fields.find((f: { name: string }) => f.name === 'form');
      expect(formField.type).toBe('relationship');
      expect(formField.relationTo).toBe('forms');
    });
  });

  describe('overrides', () => {
    it('applies form slug override', () => {
      const plugin = formBuilderPlugin({
        formOverrides: { slug: 'custom-forms' },
      });
      const config = createBaseConfig();

      const result = plugin(config);

      const slugs = result.collections.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain('custom-forms');
      expect(slugs).not.toContain('forms');
    });

    it('applies submission slug override', () => {
      const plugin = formBuilderPlugin({
        formSubmissionOverrides: { slug: 'responses' },
      });
      const config = createBaseConfig();

      const result = plugin(config);

      const slugs = result.collections.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain('responses');
      expect(slugs).not.toContain('form-submissions');
    });

    it('applies form field overrides', () => {
      const plugin = formBuilderPlugin({
        formOverrides: {
          fields: ({ defaultFields }) => [
            ...defaultFields,
            { name: 'category', type: 'text' } as never,
          ],
        },
      });
      const config = createBaseConfig();

      const result = plugin(config);

      const forms = result.collections.find((c: { slug: string }) => c.slug === 'forms');
      const fieldNames = forms.fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain('category');
    });

    it('applies submission field overrides', () => {
      const plugin = formBuilderPlugin({
        formSubmissionOverrides: {
          fields: ({ defaultFields }) => [...defaultFields, { name: 'ip', type: 'text' } as never],
        },
      });
      const config = createBaseConfig();

      const result = plugin(config);

      const submissions = result.collections.find(
        (c: { slug: string }) => c.slug === 'form-submissions',
      );
      const fieldNames = submissions.fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain('ip');
    });

    it('applies admin overrides to forms', () => {
      const plugin = formBuilderPlugin({
        formOverrides: {
          admin: { defaultColumns: ['title', 'createdAt'] },
        },
      });
      const config = createBaseConfig();

      const result = plugin(config);

      const forms = result.collections.find((c: { slug: string }) => c.slug === 'forms');
      expect(forms.admin.defaultColumns).toEqual(['title', 'createdAt']);
    });

    it('preserves existing collections', () => {
      const plugin = formBuilderPlugin();
      const config = createBaseConfig([{ slug: 'pages', fields: [] }]);

      const result = plugin(config);

      expect(result.collections).toHaveLength(3);
      const slugs = result.collections.map((c: { slug: string }) => c.slug);
      expect(slugs).toEqual(['pages', 'forms', 'form-submissions']);
    });
  });
});
