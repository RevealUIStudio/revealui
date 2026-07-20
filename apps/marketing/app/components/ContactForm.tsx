import { Button, Callout, FormField, Input, Select, Textarea } from '@revealui/presentation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { z } from 'zod';
import { submitContact } from '../lib/api';

const topics = [
  { value: 'enterprise', label: 'Enterprise / Custom Pricing' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'support', label: 'Technical Support' },
  { value: 'general', label: 'General Question' },
];

interface FieldErrors {
  name?: string;
  email?: string;
  message?: string;
}

function validateField(field: keyof FieldErrors, value: string): string | undefined {
  switch (field) {
    case 'name':
      if (!value.trim()) return 'Name is required';
      return undefined;
    case 'email':
      if (!value.trim()) return 'Email is required';
      if (!z.string().email().safeParse(value).success) return 'Enter a valid email address';
      return undefined;
    case 'message':
      if (!value.trim()) return 'Message is required';
      if (value.trim().length < 10) return 'Message must be at least 10 characters';
      return undefined;
  }
}

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'general',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleBlur(field: keyof FieldErrors) {
    const error = validateField(field, formData[field]);
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;

    const errors: FieldErrors = {
      name: validateField('name', formData.name),
      email: validateField('email', formData.email),
      message: validateField('message', formData.message),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setStatus('loading');
    const error = await submitContact(formData);
    if (error === null) {
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMessage(error);
    }
  }

  if (status === 'success') {
    return (
      <Callout variant="success" title="Message sent" role="status">
        <p className="text-sm">
          We&apos;ll get back to you within 1-2 business days.{' '}
          <a
            href="https://docs.revealui.com"
            className="font-semibold text-primary hover:underline"
          >
            Explore the docs &rarr;
          </a>
        </p>
      </Callout>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField id="contact-name" label="Name" error={fieldErrors.name} required>
          <Input
            id="contact-name"
            type="text"
            required
            autoComplete="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onBlur={() => handleBlur('name')}
            aria-invalid={fieldErrors.name ? true : undefined}
            invalid={!!fieldErrors.name}
            placeholder="Your name"
          />
        </FormField>
        <FormField id="contact-email" label="Email" error={fieldErrors.email} required>
          <Input
            id="contact-email"
            type="email"
            required
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            onBlur={() => handleBlur('email')}
            aria-invalid={fieldErrors.email ? true : undefined}
            invalid={!!fieldErrors.email}
            placeholder="you@company.com"
          />
        </FormField>
      </div>
      <FormField id="contact-topic" label="Topic">
        <Select
          id="contact-topic"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
        >
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="contact-message" label="Message" error={fieldErrors.message} required>
        <Textarea
          id="contact-message"
          required
          rows={5}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          onBlur={() => handleBlur('message')}
          aria-invalid={fieldErrors.message ? true : undefined}
          invalid={!!fieldErrors.message}
          placeholder="Tell us about your project or question..."
        />
      </FormField>
      {status === 'error' && (
        <Callout variant="error" role="alert">
          {errorMessage}
        </Callout>
      )}
      <Button
        type="submit"
        variant="brand"
        isLoading={status === 'loading'}
        disabled={status === 'loading'}
        className="w-full"
      >
        {status === 'loading' ? 'Sending…' : 'Send Message'}
      </Button>
    </form>
  );
}
