'use client';

import {
  ButtonCVA,
  Card,
  Input,
  Radio,
  RadioField,
  RadioGroup,
  Select,
  Textarea,
} from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { apiFetch } from '@/lib/utils/csrf';

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
  { value: 'per-task', label: 'Per Task  -  charge once per execution' },
  { value: 'per-minute', label: 'Per Minute  -  charge by execution time' },
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

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

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
      const agentRes = await apiFetch(`${apiUrl}/api/revmarket/agents`, {
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
        await apiFetch(`${apiUrl}/api/revmarket/agents/${agent.id}/skills`, {
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

      router.push(`/marketplace/${agent.id}`);
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
        <div className="border-b border-border bg-card px-6 py-4">
          <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            RevMarket
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">Publish Agent</span>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Publish a New Agent</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Define your agent, add skills, and publish to the marketplace
          </p>
        </div>

        {/* Step indicator */}
        <div className="border-b border-border bg-muted px-6 py-3">
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
                    ? 'bg-primary text-primary-foreground'
                    : step > s.num
                      ? 'text-success'
                      : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    step === s.num
                      ? 'bg-primary text-primary-foreground'
                      : step > s.num
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s.num ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    s.num
                  )}
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
      <h2 className="text-lg font-medium text-foreground">Basic Information</h2>

      <Field>
        <Label className="text-sm text-muted-foreground">Agent Name</Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full"
          placeholder="Code Reviewer Pro"
        />
        {fieldError('name') && <p className="mt-1 text-xs text-error">{fieldError('name')}</p>}
      </Field>

      <Field>
        <Label className="text-sm text-muted-foreground">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1"
          placeholder="An AI agent that reviews code for best practices, security issues, and performance..."
        />
        {fieldError('description') && (
          <p className="mt-1 text-xs text-error">{fieldError('description')}</p>
        )}
      </Field>

      <Field>
        <Label className="text-sm text-muted-foreground">Category</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1">
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label className="text-sm text-muted-foreground">Tags (comma-separated)</Label>
        <Input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 w-full"
          placeholder="typescript, react, code-review"
        />
      </Field>

      <div className="pt-4">
        <ButtonCVA type="button" onClick={onNext}>
          Next: Configuration
        </ButtonCVA>
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
      <h2 className="text-lg font-medium text-foreground">Configuration</h2>

      <div>
        <span className="block text-sm text-muted-foreground mb-2">Pricing Model</span>
        <RadioGroup
          name="pricingModel"
          value={pricingModel}
          onChange={(value) => setPricingModel(value)}
        >
          {PRICING_MODELS.map((pm) => (
            <RadioField key={pm.value}>
              <Radio value={pm.value} />
              <span className="text-sm text-muted-foreground">{pm.label}</span>
            </RadioField>
          ))}
        </RadioGroup>
      </div>

      <Field>
        <Label className="text-sm text-muted-foreground">Base Price (USDC)</Label>
        <Input
          type="text"
          value={basePriceUsdc}
          onChange={(e) => setBasePriceUsdc(e.target.value)}
          className="mt-1 w-full"
          placeholder="0.10"
        />
        {fieldError('basePriceUsdc') && (
          <p className="mt-1 text-xs text-error">{fieldError('basePriceUsdc')}</p>
        )}
      </Field>

      <Field>
        <Label className="text-sm text-muted-foreground">Max Execution Time (seconds)</Label>
        <Input
          type="number"
          value={maxExecutionSecs}
          onChange={(e) => setMaxExecutionSecs(Number(e.target.value))}
          min={10}
          max={3600}
          className="mt-1 w-full"
        />
      </Field>

      <Field>
        <Label className="text-sm text-muted-foreground">Agent Definition (JSON)</Label>
        <Textarea
          value={definitionJson}
          onChange={(e) => setDefinitionJson(e.target.value)}
          rows={8}
          className="mt-1 font-mono"
        />
        {fieldError('definition') && (
          <p className="mt-1 text-xs text-error">{fieldError('definition')}</p>
        )}
      </Field>

      <div className="flex gap-3 pt-4">
        <ButtonCVA type="button" appearance="outline" variant="neutral" onClick={onBack}>
          Back
        </ButtonCVA>
        <ButtonCVA type="button" onClick={onNext}>
          Next: Skills
        </ButtonCVA>
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
        <h2 className="text-lg font-medium text-foreground">Skills</h2>
        <ButtonCVA type="button" appearance="outline" variant="neutral" onClick={addSkill}>
          + Add Skill
        </ButtonCVA>
      </div>
      <p className="text-sm text-muted-foreground">
        Define the capabilities your agent offers. Each skill has an input and output schema.
      </p>

      {skills.map((skill, i) => (
        <Card key={skill.name || `skill-${i}`} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Skill {i + 1}</h3>
            {skills.length > 1 && (
              <ButtonCVA
                type="button"
                appearance="ghost"
                onClick={() => removeSkill(i)}
                className="text-xs text-error hover:text-error"
              >
                Remove
              </ButtonCVA>
            )}
          </div>

          <Field>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              type="text"
              value={skill.name}
              onChange={(e) => updateSkill(i, 'name', e.target.value)}
              className="mt-1 w-full"
              placeholder="code-review"
            />
            {fieldError(`skill-${i}-name`) && (
              <p className="mt-1 text-xs text-error">{fieldError(`skill-${i}-name`)}</p>
            )}
          </Field>

          <Field>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input
              type="text"
              value={skill.description}
              onChange={(e) => updateSkill(i, 'description', e.target.value)}
              className="mt-1 w-full"
              placeholder="Reviews code for bugs, security issues, and best practices"
            />
            {fieldError(`skill-${i}-description`) && (
              <p className="mt-1 text-xs text-error">{fieldError(`skill-${i}-description`)}</p>
            )}
          </Field>

          <Field>
            <Label className="text-xs text-muted-foreground">Input Schema (JSON)</Label>
            <Textarea
              value={skill.inputSchema}
              onChange={(e) => updateSkill(i, 'inputSchema', e.target.value)}
              rows={3}
              className="mt-1 font-mono text-xs"
            />
            {fieldError(`skill-${i}-input`) && (
              <p className="mt-1 text-xs text-error">{fieldError(`skill-${i}-input`)}</p>
            )}
          </Field>

          <Field>
            <Label className="text-xs text-muted-foreground">Output Schema (JSON)</Label>
            <Textarea
              value={skill.outputSchema}
              onChange={(e) => updateSkill(i, 'outputSchema', e.target.value)}
              rows={3}
              className="mt-1 font-mono text-xs"
            />
            {fieldError(`skill-${i}-output`) && (
              <p className="mt-1 text-xs text-error">{fieldError(`skill-${i}-output`)}</p>
            )}
          </Field>
        </Card>
      ))}

      <div className="flex gap-3 pt-4">
        <ButtonCVA type="button" appearance="outline" variant="neutral" onClick={onBack}>
          Back
        </ButtonCVA>
        <ButtonCVA type="button" onClick={onNext}>
          Next: Review
        </ButtonCVA>
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
      <h2 className="text-lg font-medium text-foreground">Review & Publish</h2>

      {/* Summary */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span>{' '}
            <span className="text-foreground">{name || ' - '}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Category:</span>{' '}
            <span className="text-foreground">{category}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Description:</span>{' '}
            <span className="text-muted-foreground">{description || ' - '}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tags:</span>{' '}
            <span className="text-muted-foreground">{tags || 'none'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pricing:</span>{' '}
            <span className="text-foreground">
              ${basePriceUsdc} / {pricingModel}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Max execution:</span>{' '}
            <span className="text-foreground">{maxExecutionSecs}s</span>
          </div>
          <div>
            <span className="text-muted-foreground">Skills:</span>{' '}
            <span className="text-foreground">{skills.filter((s) => s.name).length}</span>
          </div>
        </div>
      </Card>

      {/* Skills summary */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Skills</h3>
        <div className="space-y-2">
          {skills
            .filter((s) => s.name)
            .map((skill) => (
              <div key={skill.name} className="rounded border border-border bg-muted px-3 py-2">
                <span className="text-sm font-medium text-foreground">{skill.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{skill.description}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-error/30 bg-error/10 p-4">
          <p className="text-sm font-medium text-error mb-2">Please fix the following:</p>
          <ul className="space-y-1">
            {errors.map((err) => (
              <li key={err.field} className="text-sm text-error">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <ButtonCVA type="button" appearance="outline" variant="neutral" onClick={onBack}>
          Back
        </ButtonCVA>
        <ButtonCVA type="button" onClick={onPublish} disabled={submitting}>
          {submitting ? 'Publishing...' : 'Publish Agent'}
        </ButtonCVA>
      </div>

      <p className="text-xs text-muted-foreground">
        Your agent will be created in draft status. You can publish it to the marketplace from your
        agent dashboard.
      </p>
    </div>
  );
}
