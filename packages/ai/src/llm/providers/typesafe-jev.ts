/**
 * TypeSafe Jev — System One decision adapter.
 *
 * Not a chat model. Send state plus typed questions. The response is
 * choices, scores, and noul probabilities. No TypeSafe SDK: one HTTPS POST.
 * The key is the caller's TYPESAFE_API_KEY. RevealUI does not host one.
 *
 * Docs: https://docs.typesafe.ai/introduction/quickstart
 */

export const JEV_MODEL = 'jev-latest';
export const TYPESAFE_SYSTEMONE_URL = 'https://api.typesafe.ai/v1/systemone';

export interface JevChoiceQuestion {
  readonly type: 'choice';
  readonly instructions: string;
  readonly criteria: Readonly<Record<string, string>>;
}

export interface JevScoreQuestion {
  readonly type: 'score';
  readonly instructions: string;
  readonly criteria: readonly string[];
}

export interface JevNoulQuestion {
  readonly type: 'noul';
  readonly instructions: string;
}

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export interface JevEvaluateInput {
  readonly state: string | Record<string, unknown> | readonly unknown[];
  readonly questions: Readonly<Record<string, JevQuestion>>;
  readonly model?: string;
}

export interface JevUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
}

export interface JevEvaluateResult {
  readonly model: string;
  readonly answers: Readonly<Record<string, unknown>>;
  readonly usage?: JevUsage;
}

export class JevConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JevConfigError';
  }
}

export function typesafeApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.TYPESAFE_API_KEY?.trim();
  if (!key) {
    throw new JevConfigError('TYPESAFE_API_KEY is required for Jev. RevealUI does not ship one.');
  }
  return key;
}

/**
 * One System One call. Does not generate text and is not the local snap default.
 */
export async function evaluateJev(
  input: JevEvaluateInput,
  options?: { readonly fetchImpl?: typeof fetch; readonly apiKey?: string; readonly url?: string },
): Promise<JevEvaluateResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(options?.url ?? TYPESAFE_SYSTEMONE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options?.apiKey ?? typesafeApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state: input.state,
      model: input.model ?? JEV_MODEL,
      questions: input.questions,
    }),
  });
  if (!response.ok) {
    throw new Error(`Jev request failed: HTTP ${response.status}`);
  }
  const body = (await response.json()) as JevEvaluateResult;
  if (!body || typeof body !== 'object' || !body.answers) {
    throw new Error('Jev response missing answers');
  }
  return body;
}
