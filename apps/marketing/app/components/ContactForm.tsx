import type { FormEvent } from 'react';
import { useState } from 'react';
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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
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
      <div className="rounded-2xl bg-emerald-50 p-8 text-center ring-1 ring-emerald-200">
        <svg
          className="mx-auto h-12 w-12 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <title>Success</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Message sent</h3>
        <p className="mt-2 text-sm text-gray-600">
          We will get back to you within 1-2 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-gray-900">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onBlur={() => handleBlur('name')}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined}
            className={`mt-2 block w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 shadow-sm ring-1 placeholder:text-gray-400 focus:ring-2 sm:text-sm ${
              fieldErrors.name
                ? 'ring-red-300 focus:ring-red-600'
                : 'ring-gray-300 focus:ring-blue-600'
            }`}
            placeholder="Your name"
          />
          {fieldErrors.name && (
            <p id="contact-name-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-gray-900">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            onBlur={() => handleBlur('email')}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
            className={`mt-2 block w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 shadow-sm ring-1 placeholder:text-gray-400 focus:ring-2 sm:text-sm ${
              fieldErrors.email
                ? 'ring-red-300 focus:ring-red-600'
                : 'ring-gray-300 focus:ring-blue-600'
            }`}
            placeholder="you@company.com"
          />
          {fieldErrors.email && (
            <p id="contact-email-error" className="mt-1 text-xs text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="contact-topic" className="block text-sm font-medium text-gray-900">
          Topic
        </label>
        <select
          id="contact-topic"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          className="mt-2 block w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 shadow-sm ring-1 ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm"
        >
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-gray-900">
          Message
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          onBlur={() => handleBlur('message')}
          aria-invalid={fieldErrors.message ? true : undefined}
          aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
          className={`mt-2 block w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 shadow-sm ring-1 placeholder:text-gray-400 focus:ring-2 sm:text-sm ${
            fieldErrors.message
              ? 'ring-red-300 focus:ring-red-600'
              : 'ring-gray-300 focus:ring-blue-600'
          }`}
          placeholder="Tell us about your project or question..."
        />
        {fieldErrors.message && (
          <p id="contact-message-error" className="mt-1 text-xs text-red-600">
            {fieldErrors.message}
          </p>
        )}
      </div>
      {status === 'error' && <p className="text-sm text-red-600">{errorMessage}</p>}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
