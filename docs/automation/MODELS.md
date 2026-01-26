# Model

This document provides quick guidance for using instruction models (e.g. `mistralai/Mistral-7B-Instruct-v0.3`) in this repo.

Key points

- Prefer the `Instruct`-specific model (e.g. `mistralai/Mistral-7B-Instruct-v0.3`) when you want short-form instruction-following behavior.
- Instruct models expect the instruction to be wrapped with the chat template tokens: `<s>[INST] ... [/INST]`.
- Tokenization differences between the reference `model_common` code and Hugging Face `transformers` may cause small tokenization differences; use the recommended transformers version if you rely on exact token-level parity.

Example: calling Vultr inference (Node, using repo demo)

The repo includes a small demo script at `packages/ai/scripts/test-vultr.ts` that POSTs to the configured `VULTR_BASE_URL` using `VULTR_API_KEY` and `VULTR_MODEL` from your `.env`.

To use the updated Mistral model locally (this repo uses `.env`), edit your `.env` and set:

```dotenv
VULTR_MODEL=mistralai/Mistral-7B-Instruct-v0.3
VULTR_API_KEY=your_vultr_inference_key
VULTR_BASE_URL=https://api.vultrinference.com/v1
```

Then run the demo with the repo env exported in your shell:

```bash
set -a
. ./.env
set +a
node --loader ts-node/esm packages/ai/scripts/test-vultr.ts
```

Notes about tokenizers and transformers

- If you plan to run Mistral locally with `transformers`, some users have needed to install a newer `transformers` from source to avoid `KeyError: 'mistral'`. Usually upgrading to `transformers>=4.33.4` or installing from the repo solves the issue.
- Example Python snippet (reference):

```python
from mistral_common.tokens.tokenizers.mistral import MistralTokenizer
from mistral_common.protocol.instruct.messages import UserMessage
from mistral_common.protocol.instruct.request import ChatCompletionRequest

tokenizer = MistralTokenizer.v1()
completion_request = ChatCompletionRequest(messages=[UserMessage(content="Explain Machine Learning to me in a nutshell.")])
tokens = tokenizer.encode_chat_completion(completion_request).tokens
```

If you'd like, I can add a small `packages/ai/scripts/mistral-example.ts` that demonstrates using `transformers` or wraps the tokenization call; say the word and I'll add it.
