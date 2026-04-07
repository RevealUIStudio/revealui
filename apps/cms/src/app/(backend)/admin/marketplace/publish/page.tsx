'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { getApiUrl } from '@/lib/config/api';

// =============================================================================
// Types
// =============================================================================

interface SkillDefinition {
  name: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
}

interface ValidationError {
  field: string;
  message: string;
}

const CATEGORIES = [
  'coding',
  'writing',
  'data',
  'design',
  'devops',
  'security',
  'testing',
  'other',
] as const;

const PRICING_MODELS = [
  { value: 'per-task', label: 'Per Task — charge once per execution' },
  { value: 'per-minute', label: 'Per Minute — charge by execution time' },
] as const;

// =============================================================================
// Publish Agent Page
// =============================================================================

export default function PublishAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [tags, setTags] = useState('');

  // Step 2: Configuration
  const [pricingModel, setPricingModel] = useState('per-task');
  const [basePriceUsdc, setBasePriceUsdc] = useState('0.10');
  const [maxExecutionSecs, setMaxExecutionSecs] = useState(300);
  const [definitionJson, setDefinitionJson] = useState(
    '{\n  "capabilities": [],\n  "model": "",\n  "systemPrompt": ""\n}',
  );

  // Step 3: Skills
  const [skills, setSkills] = useState<SkillDefinition[]>([
    { name: '', description: '', inputSchema: '{}', outputSchema: '{}' },
  ]);

  const apiUrl = getApiUrl();

  function validate(): ValidationError[] {
    const errs: ValidationError[] = [];

    if (name.length < 3)
      errs.push({ field: 'name', message: 'Name must be at least 3 characters' });
    if (description.length < 10)
      errs.push({ field: 'description', message: 'Description must be at least 10 characters' });

    try {
      JSON.parse(definitionJson);
    } catch {
      errs.push({ field: 'definition', message: 'Definition must be valid JSON' });
    }

    const price = Number.parseFloat(basePriceUsdc);
    if (Number.isNaN(price) || price < 0) {
      errs.push({ field: 'basePriceUsdc', message: 'Price must be a non-negative number' });
    }

    for (const [i, skill] of skills.entries()) {
      if (skill.name.length < 2) {
        errs.push({ field: `skill-${i}-name`, message: `Skill ${i + 1}: name required` });
      }
      if (skill.description.length < 5) {
        errs.push({
          field: `skill-${i}-description`,
          message: `Skill ${i + 1}: description required`,
        });
      }
      try {
        JSON.parse(skill.inputSchema);
      } catch {
        errs.push({
          field: `skill-${i}-input`,
          message: `Skill ${i + 1}: invalid input schema JSON`,
        });
      }
      try {
        JSON.parse(skill.outputSchema);
      } catch {
        errs.push({
          field: `skill-${i}-output`,
          message: `Skill ${i + 1}: invalid output schema JSON`,
        });
      }
    }

    return errs;
  }

  async function handlePublish() {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);

    try {
      // Create agent
      const agentRes = await fetch(`${apiUrl}/api/revmarket/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          definition: JSON.parse(definitionJson),
          category,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          pricingModel,
          basePriceUsdc,
          maxExecutionSecs,
        }),
      });

      if (!agentRes.ok) {
        const body = (await agentRes.json()) as { error?: string };
        throw new Error(body.error ?? `Failed to create agent (${agentRes.status})`);
      }

      const { agent } = (await agentRes.json()) as { agent: { id: string } };

      // Add skills
      for (const skill of skills) {
        if (!skill.name) continue;
        await fetch(`${apiUrl}/api/revmarket/agents/${agent.id}/skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: skill.name,
            description: skill.description,
            inputSchema: JSON.parse(skill.inputSchema),
            outputSchema: JSON.parse(skill.outputSchema),
          }),
        });
      }

      router.push(`/admin/marketplace/${agent.id}`);
    } catch (err) {
      setErrors([
        { field: 'submit', message: err instanceof Error ? err.message : 'Failed to publish' },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  function addSkill() {
    setSkills([...skills, { name: '', description: '', inputSchema: '{}', outputSchema: '{}' }]);
  }

  function updateSkill(index: number, field: keyof SkillDefinition, value: string) {
    setSkills(skills.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeSkill(index: number) {
    if (skills.length <= 1) return;
    setSkills(skills.filter((_, i) => i !== index));
  }

  function fieldError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Link href="/admin/marketplace" className="text-sm text-zinc-500 hover:text-zinc-300">
            RevMarket
          </Link>
          <span className="mx-2 text-zinc-700">/</span>
          <span className="text-sm text-zinc-300">Publish Agent</span>
          <h1 className="mt-1 text-xl font-semibold text-white">Publish a New Agent</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            Define your agent, add skills, and publish to the marketplace
          </p>
        </div>

        {/* Step indicator */}
        <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
          <div className="flex gap-2">
            {[
              { num: 1, label: 'Basic Info' },
              { num: 2, label: 'Configuration' },
              { num: 3, label: 'Skills' },
              { num: 4, label: 'Review & Publish' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
                  step === s.num
                    ? 'bg-zinc-800 text-white'
                    : step > s.num
                      ? 'text-green-400'
                      : 'text-zinc-600'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    step === s.num
                      ? 'bg-blue-600 text-white'
                      : step > s.num
                        ? 'bg-green-900 text-green-400'
                        : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="max-w-2xl">
            {step === 1 && (
              <StepBasicInfo
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                category={category}
                setCategory={setCategory}
                tags={tags}
                setTags={setTags}
                fieldError={fieldError}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <StepConfiguration
                pricingModel={pricingModel}
                setPricingModel={setPricingModel}
                basePriceUsdc={basePriceUsdc}
                setBasePriceUsdc={setBasePriceUsdc}
                maxExecutionSecs={maxExecutionSecs}
                setMaxExecutionSecs={setMaxExecutionSecs}
                definitionJson={definitionJson}
                setDefinitionJson={setDefinitionJson}
                fieldError={fieldError}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <StepSkills
                skills={skills}
                addSkill={addSkill}
                updateSkill={updateSkill}
                removeSkill={removeSkill}
                fieldError={fieldError}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}
            {step === 4 && (
              <StepReview
                name={name}
                description={description}
                category={category}
                tags={tags}
                pricingModel={pricingModel}
                basePriceUsdc={basePriceUsdc}
                maxExecutionSecs={maxExecutionSecs}
                skills={skills}
                errors={errors}
                submitting={submitting}
                onBack={() => setStep(3)}
                onPublish={handlePublish}
              />
            )}
          </div>
        </div>
      </div>
    </LicenseGate>
  );
}

// =============================================================================
// Step 1: Basic Info
// =============================================================================

function StepBasicInfo({
  name,
  setName,
  description,
  setDescription,
  category,
  setCategory,
  tags,
  setTags,
  fieldError,
  onNext,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  fieldError: (f: string) => string | undefined;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-white">Basic Information</h2>

      <label className="block">
        <span className="text-sm text-zinc-400">Agent Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
          placeholder="Code Reviewer Pro"
        />
        {fieldError('name') && <p className="mt-1 text-xs text-red-400">{fieldError('name')}</p>}
      </label>

      <label className="block">
        <span className="text-sm text-zinc-400">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
          placeholder="An AI agent that reviews code for best practices, security issues, and performance..."
        />
        {fieldError('description') && (
          <p className="mt-1 text-xs text-red-400">{fieldError('description')}</p>
        )}
      </label>

      <label className="block">
        <span className="text-sm text-zinc-400">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-zinc-400">Tags (comma-separated)</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
          placeholder="typescript, react, code-review"
        />
      </label>

      <div className="pt-4">
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Next: Configuration
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Step 2: Configuration
// =============================================================================

function StepConfiguration({
  pricingModel,
  setPricingModel,
  basePriceUsdc,
  setBasePriceUsdc,
  maxExecutionSecs,
  setMaxExecutionSecs,
  definitionJson,
  setDefinitionJson,
  fieldError,
  onBack,
  onNext,
}: {
  pricingModel: string;
  setPricingModel: (v: string) => void;
  basePriceUsdc: string;
  setBasePriceUsdc: (v: string) => void;
  maxExecutionSecs: number;
  setMaxExecutionSecs: (v: number) => void;
  definitionJson: string;
  setDefinitionJson: (v: string) => void;
  fieldError: (f: string) => string | undefined;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-white">Configuration</h2>

      <div>
        <span className="block text-sm text-zinc-400 mb-2">Pricing Model</span>
        <div className="space-y-2">
          {PRICING_MODELS.map((pm) => (
            <label
              key={pm.value}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 cursor-pointer hover:border-zinc-600 transition-colors"
            >
              <input
                type="radio"
                name="pricingModel"
                value={pm.value}
                checked={pricingModel === pm.value}
                onChange={(e) => setPricingModel(e.target.value)}
                className="accent-blue-500"
              />
              <span className="text-sm text-zinc-300">{pm.label}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm text-zinc-400">Base Price (USDC)</span>
        <input
          type="text"
          value={basePriceUsdc}
          onChange={(e) => setBasePriceUsdc(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
          placeholder="0.10"
        />
        {fieldError('basePriceUsdc') && (
          <p className="mt-1 text-xs text-red-400">{fieldError('basePriceUsdc')}</p>
        )}
      </label>

      <label className="block">
        <span className="text-sm text-zinc-400">Max Execution Time (seconds)</span>
        <input
          type="number"
          value={maxExecutionSecs}
          onChange={(e) => setMaxExecutionSecs(Number(e.target.value))}
          min={10}
          max={3600}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-sm text-zinc-400">Agent Definition (JSON)</span>
        <textarea
          value={definitionJson}
          onChange={(e) => setDefinitionJson(e.target.value)}
          rows={8}
          className="mt-1 w-full font-mono rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
        />
        {fieldError('definition') && (
          <p className="mt-1 text-xs text-red-400">{fieldError('definition')}</p>
        )}
      </label>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Next: Skills
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Step 3: Skills
// =============================================================================

function StepSkills({
  skills,
  addSkill,
  updateSkill,
  removeSkill,
  fieldError,
  onBack,
  onNext,
}: {
  skills: SkillDefinition[];
  addSkill: () => void;
  updateSkill: (i: number, field: keyof SkillDefinition, value: string) => void;
  removeSkill: (i: number) => void;
  fieldError: (f: string) => string | undefined;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Skills</h2>
        <button
          type="button"
          onClick={addSkill}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          + Add Skill
        </button>
      </div>
      <p className="text-sm text-zinc-500">
        Define the capabilities your agent offers. Each skill has an input and output schema.
      </p>

      {skills.map((skill, i) => (
        <div
          key={skill.name || `skill-${i}`}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Skill {i + 1}</h3>
            {skills.length > 1 && (
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>

          <label className="block">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              type="text"
              value={skill.name}
              onChange={(e) => updateSkill(i, 'name', e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              placeholder="code-review"
            />
            {fieldError(`skill-${i}-name`) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(`skill-${i}-name`)}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Description</span>
            <input
              type="text"
              value={skill.description}
              onChange={(e) => updateSkill(i, 'description', e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              placeholder="Reviews code for bugs, security issues, and best practices"
            />
            {fieldError(`skill-${i}-description`) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(`skill-${i}-description`)}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Input Schema (JSON)</span>
            <textarea
              value={skill.inputSchema}
              onChange={(e) => updateSkill(i, 'inputSchema', e.target.value)}
              rows={3}
              className="mt-1 w-full font-mono rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:border-zinc-500 focus:outline-none"
            />
            {fieldError(`skill-${i}-input`) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(`skill-${i}-input`)}</p>
            )}
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Output Schema (JSON)</span>
            <textarea
              value={skill.outputSchema}
              onChange={(e) => updateSkill(i, 'outputSchema', e.target.value)}
              rows={3}
              className="mt-1 w-full font-mono rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:border-zinc-500 focus:outline-none"
            />
            {fieldError(`skill-${i}-output`) && (
              <p className="mt-1 text-xs text-red-400">{fieldError(`skill-${i}-output`)}</p>
            )}
          </label>
        </div>
      ))}

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Next: Review
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Step 4: Review & Publish
// =============================================================================

function StepReview({
  name,
  description,
  category,
  tags,
  pricingModel,
  basePriceUsdc,
  maxExecutionSecs,
  skills,
  errors,
  submitting,
  onBack,
  onPublish,
}: {
  name: string;
  description: string;
  category: string;
  tags: string;
  pricingModel: string;
  basePriceUsdc: string;
  maxExecutionSecs: number;
  skills: SkillDefinition[];
  errors: ValidationError[];
  submitting: boolean;
  onBack: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-white">Review & Publish</h2>

      {/* Summary */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500">Name:</span>{' '}
            <span className="text-white">{name || '—'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Category:</span>{' '}
            <span className="text-white">{category}</span>
          </div>
          <div className="col-span-2">
            <span className="text-zinc-500">Description:</span>{' '}
            <span className="text-zinc-300">{description || '—'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Tags:</span>{' '}
            <span className="text-zinc-300">{tags || 'none'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Pricing:</span>{' '}
            <span className="text-white">
              ${basePriceUsdc} / {pricingModel}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Max execution:</span>{' '}
            <span className="text-white">{maxExecutionSecs}s</span>
          </div>
          <div>
            <span className="text-zinc-500">Skills:</span>{' '}
            <span className="text-white">{skills.filter((s) => s.name).length}</span>
          </div>
        </div>
      </div>

      {/* Skills summary */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-2">Skills</h3>
        <div className="space-y-2">
          {skills
            .filter((s) => s.name)
            .map((skill) => (
              <div
                key={skill.name}
                className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <span className="text-sm font-medium text-white">{skill.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{skill.description}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm font-medium text-red-400 mb-2">Please fix the following:</p>
          <ul className="space-y-1">
            {errors.map((err) => (
              <li key={err.field} className="text-sm text-red-400">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={submitting}
          className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Publishing...' : 'Publish Agent'}
        </button>
      </div>

      <p className="text-xs text-zinc-600">
        Your agent will be created in draft status. You can publish it to the marketplace from your
        agent dashboard.
      </p>
    </div>
  );
}
