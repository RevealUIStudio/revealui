import { describe, expect, it, vi } from 'vitest';
import {
  convertFromRevealUIField,
  convertToRevealUIField,
  enhanceFieldWithRevealUI,
  validateRevealUIField,
} from '../field-conversion.js';

// ---------------------------------------------------------------------------
// Tests  -  convertToRevealUIField
// ---------------------------------------------------------------------------
describe('convertToRevealUIField', () => {
  it('converts a basic text field', () => {
    const result = convertToRevealUIField({
      name: 'title',
      type: 'text',
      label: 'Title',
    });

    expect(result.name).toBe('title');
    expect(result.type).toBe('text');
    expect(result.label).toBe('Title');
    expect(result.revealUI).toBeDefined();
    expect(result.revealUI?.searchable).toBe(false);
    expect(result.revealUI?.tenantScoped).toBe(false);
    expect(result.revealUI?.permissions).toEqual(['read', 'write']);
  });

  it('adds required validation rule when required is true', () => {
    const result = convertToRevealUIField({
      name: 'email',
      type: 'text',
      required: true,
      label: 'Email',
    });

    expect(result.revealUI?.validation).toHaveLength(1);
    expect(result.revealUI?.validation?.[0]).toEqual({
      type: 'required',
      message: 'Email is required',
    });
  });

  it('uses name as label fallback in required message', () => {
    const result = convertToRevealUIField({
      name: 'email',
      type: 'text',
      required: true,
    });

    expect(result.revealUI?.validation?.[0]?.message).toBe('email is required');
  });

  it('uses "Field" as fallback label', () => {
    const result = convertToRevealUIField({
      name: '',
      type: 'text',
      required: true,
    });

    expect(result.revealUI?.validation?.[0]?.message).toBe('Field is required');
  });

  it('preserves text field properties (maxLength, minLength)', () => {
    const result = convertToRevealUIField({
      name: 'code',
      type: 'text',
      maxLength: 10,
      minLength: 2,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.maxLength).toBe(10);
    expect(typed.minLength).toBe(2);
  });

  it('recursively converts array field children', () => {
    const result = convertToRevealUIField({
      name: 'items',
      type: 'array',
      fields: [{ name: 'label', type: 'text' }],
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.fields).toHaveLength(1);
    expect(typed.fields[0].name).toBe('label');
    expect(typed.fields[0].revealUI).toBeDefined();
  });

  it('preserves array field minRows/maxRows', () => {
    const result = convertToRevealUIField({
      name: 'items',
      type: 'array',
      fields: [],
      minRows: 1,
      maxRows: 5,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.minRows).toBe(1);
    expect(typed.maxRows).toBe(5);
  });

  it('preserves checkbox defaultValue', () => {
    const result = convertToRevealUIField({
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.defaultValue).toBe(true);
  });

  it('preserves richText editor', () => {
    const editor = { name: 'lexical' };
    const result = convertToRevealUIField({
      name: 'content',
      type: 'richText',
      editor,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.editor).toBe(editor);
  });

  it('wraps existing validate function', () => {
    const validate = vi.fn(() => true);
    const result = convertToRevealUIField({
      name: 'title',
      type: 'text',
      validate,
    });

    expect(result.validate).toBeTypeOf('function');
    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  calling validate with mock args
    const validateResult = result.validate!('value', {} as any);
    expect(validate).toHaveBeenCalledWith('value', expect.anything());
    expect(validateResult).toBe(true);
  });

  it('wraps validate function that returns string', () => {
    const validate = vi.fn(() => 'Error message');
    const result = convertToRevealUIField({
      name: 'title',
      type: 'text',
      validate,
    });

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  calling validate with mock args
    expect(result.validate!('value', {} as any)).toBe('Error message');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  convertFromRevealUIField
// ---------------------------------------------------------------------------
describe('convertFromRevealUIField', () => {
  it('converts a RevealUI field back to standard field', () => {
    const revealUIField = convertToRevealUIField({ name: 'title', type: 'text', label: 'Title' });
    const result = convertFromRevealUIField(revealUIField);

    expect(result.name).toBe('title');
    expect(result.type).toBe('text');
    expect(result.label).toBe('Title');
  });

  it('preserves text field maxLength/minLength', () => {
    const revealUIField = convertToRevealUIField({
      name: 'code',
      type: 'text',
      maxLength: 10,
      minLength: 2,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);
    const result = convertFromRevealUIField(revealUIField);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.maxLength).toBe(10);
    expect(typed.minLength).toBe(2);
  });

  it('recursively converts array field children back', () => {
    const revealUIField = convertToRevealUIField({
      name: 'items',
      type: 'array',
      fields: [{ name: 'label', type: 'text' }],
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);
    const result = convertFromRevealUIField(revealUIField);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    const typed = result as any;
    expect(typed.fields).toHaveLength(1);
    expect(typed.fields[0].name).toBe('label');
    // Should NOT have revealUI property after conversion back
    expect(typed.fields[0].revealUI).toBeUndefined();
  });

  it('preserves checkbox defaultValue on round-trip', () => {
    const revealUIField = convertToRevealUIField({
      name: 'active',
      type: 'checkbox',
      defaultValue: false,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);
    const result = convertFromRevealUIField(revealUIField);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    expect((result as any).defaultValue).toBe(false);
  });

  it('preserves richText editor on round-trip', () => {
    const editor = { name: 'lexical' };
    const revealUIField = convertToRevealUIField({
      name: 'content',
      type: 'richText',
      editor,
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal field shape
    } as any);
    const result = convertFromRevealUIField(revealUIField);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  accessing type-specific props
    expect((result as any).editor).toBe(editor);
  });

  it('wraps validate function from RevealUI field', () => {
    const validate = vi.fn(() => 'Invalid');
    const revealUIField = { name: 'x', type: 'text', validate } as never;
    const result = convertFromRevealUIField(revealUIField);

    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  calling validate with mock args
    expect(result.validate!('val', {} as any)).toBe('Invalid');
  });
});

// ---------------------------------------------------------------------------
// Tests  -  enhanceFieldWithRevealUI
// ---------------------------------------------------------------------------
describe('enhanceFieldWithRevealUI', () => {
  it('converts and adds revealUI options', () => {
    const result = enhanceFieldWithRevealUI(
      { name: 'title', type: 'text' },
      { searchable: true, tenantScoped: true },
    );

    expect(result.revealUI?.searchable).toBe(true);
    expect(result.revealUI?.tenantScoped).toBe(true);
    // Defaults preserved
    expect(result.revealUI?.permissions).toEqual(['read', 'write']);
  });

  it('works without revealUI options', () => {
    const result = enhanceFieldWithRevealUI({ name: 'title', type: 'text' });

    expect(result.revealUI?.searchable).toBe(false);
  });

  it('overrides default revealUI options', () => {
    const result = enhanceFieldWithRevealUI(
      { name: 'title', type: 'text' },
      { permissions: ['read'], auditLog: true },
    );

    expect(result.revealUI?.permissions).toEqual(['read']);
    expect(result.revealUI?.auditLog).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  validateRevealUIField
// ---------------------------------------------------------------------------
describe('validateRevealUIField', () => {
  const baseContext = {
    data: {},
    siblingData: {},
    operation: 'create' as const,
  };

  it('returns true when no validation rules', () => {
    const field = convertToRevealUIField({ name: 'title', type: 'text' });
    const result = validateRevealUIField(field, 'hello', baseContext);

    expect(result).toBe(true);
  });

  describe('required validation', () => {
    it('fails on empty value', () => {
      const field = convertToRevealUIField({ name: 'title', type: 'text', required: true });
      const result = validateRevealUIField(field, '', baseContext);

      expect(result).toBe('title is required');
    });

    it('fails on null/undefined', () => {
      const field = convertToRevealUIField({
        name: 'title',
        type: 'text',
        required: true,
        label: 'Title',
      });

      expect(validateRevealUIField(field, null, baseContext)).toBe('Title is required');
      expect(validateRevealUIField(field, undefined, baseContext)).toBe('Title is required');
    });

    it('passes on valid value', () => {
      const field = convertToRevealUIField({ name: 'title', type: 'text', required: true });
      const result = validateRevealUIField(field, 'hello', baseContext);

      expect(result).toBe(true);
    });
  });

  describe('min validation', () => {
    it('fails on short string', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'code', type: 'text' },
        {
          validation: [{ type: 'min', value: 3 }],
        },
      );
      const result = validateRevealUIField(field, 'ab', baseContext);

      expect(result).toBe('code must be at least 3 characters');
    });

    it('fails on small number', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'age', type: 'number' },
        {
          validation: [{ type: 'min', value: 18, message: 'Must be 18+' }],
        },
      );
      const result = validateRevealUIField(field, 5, baseContext);

      expect(result).toBe('Must be 18+');
    });

    it('passes on valid string length', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'code', type: 'text' },
        {
          validation: [{ type: 'min', value: 3 }],
        },
      );

      expect(validateRevealUIField(field, 'abc', baseContext)).toBe(true);
    });
  });

  describe('max validation', () => {
    it('fails on long string', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'code', type: 'text' },
        {
          validation: [{ type: 'max', value: 5 }],
        },
      );
      const result = validateRevealUIField(field, 'abcdef', baseContext);

      expect(result).toBe('code must be no more than 5 characters');
    });

    it('fails on large number', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'qty', type: 'number' },
        {
          validation: [{ type: 'max', value: 100 }],
        },
      );

      expect(validateRevealUIField(field, 101, baseContext)).toContain('must be no more than');
    });

    it('passes on valid value', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'code', type: 'text' },
        {
          validation: [{ type: 'max', value: 5 }],
        },
      );

      expect(validateRevealUIField(field, 'abc', baseContext)).toBe(true);
    });
  });

  describe('pattern validation', () => {
    it('fails when pattern does not match', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'email', type: 'text' },
        {
          validation: [{ type: 'pattern', value: /^[^@]+@[^@]+$/ }],
        },
      );

      expect(validateRevealUIField(field, 'invalid', baseContext)).toBe('email format is invalid');
    });

    it('passes when pattern matches', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'email', type: 'text' },
        {
          validation: [{ type: 'pattern', value: /^[^@]+@[^@]+$/ }],
        },
      );

      expect(validateRevealUIField(field, 'a@b.com', baseContext)).toBe(true);
    });
  });

  describe('custom validation', () => {
    it('runs custom validate function', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'slug', type: 'text' },
        {
          validation: [
            {
              type: 'custom',
              validate: (value) => {
                if (typeof value === 'string' && value.includes(' ')) return 'No spaces allowed';
                return true;
              },
            },
          ],
        },
      );

      expect(validateRevealUIField(field, 'has space', baseContext)).toBe('No spaces allowed');
      expect(validateRevealUIField(field, 'no-space', baseContext)).toBe(true);
    });

    it('uses fallback message when validate returns non-string falsy', () => {
      const field = enhanceFieldWithRevealUI(
        { name: 'x', type: 'text', label: 'MyField' },
        {
          validation: [{ type: 'custom', validate: () => false }],
        },
      );

      expect(validateRevealUIField(field, 'any', baseContext)).toBe('MyField is invalid');
    });
  });

  describe('original field validator', () => {
    it('runs the original validate function after revealUI rules', () => {
      const field = enhanceFieldWithRevealUI({ name: 'title', type: 'text' });
      field.validate = vi.fn(() => 'Original error');

      const result = validateRevealUIField(field, 'value', baseContext);

      expect(result).toBe('Original error');
    });

    it('returns fallback message for non-string non-true result', () => {
      const field = enhanceFieldWithRevealUI({ name: 'title', type: 'text', label: 'Title' });
      field.validate = vi.fn(() => false);

      const result = validateRevealUIField(field, 'value', baseContext);

      expect(result).toBe('Title is invalid');
    });
  });
});
