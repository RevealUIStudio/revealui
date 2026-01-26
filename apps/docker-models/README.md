# Docker Model Runner (mock)

This folder contains a small mock TGI-compatible server used for local testing of the Docker provider.

Recommended environment variables (to avoid ambiguity):

- `DOCKER_MODEL_FILE_URL` (optional): direct link to a model file (e.g. `.gguf`, `.safetensors`) for a container to download at startup. This is commonly used by startup scripts inside the container.
- `DOCKER_INFERENCE_URL` (recommended): full inference endpoint URL that callers should use, e.g. `http://ai-server:8080/generate` or `http://localhost:8000/v1/chat/completions`.
- `DOCKER_MODEL_URL` (legacy/fallback): historically used in some projects for the inference endpoint, but often overloaded to mean the model-file URL. We support it as a fallback for compatibility.
- `DOCKER_MODEL_BASE` + `DOCKER_MODEL_PATH` (alternate): split base and path (e.g. `http://localhost:8080` + `/generate`).

Which variable to use

- If you control both the container and the client code: set `DOCKER_INFERENCE_URL` for the provider and `DOCKER_MODEL_FILE_URL` for container startup (if the container needs to download a file).
- If you don't control the container but it expects `DOCKER_MODEL_URL` for the model file, supply `DOCKER_INFERENCE_URL` separately for callers.

Docker Compose example

This example demonstrates both model-file and inference endpoint configuration.

```yaml
services:
  ai-server:
    image: your-ai-image:latest
    ports:
      - "8080:8080"
    environment:
      # Model file to download at container startup (optional)
      - DOCKER_MODEL_FILE_URL=https://huggingface.co/your/repo/resolve/main/model.gguf
      # Inference endpoint for callers (recommended)
      - DOCKER_INFERENCE_URL=http://ai-server:8080/generate
    volumes:
      - ./models:/models
    restart: always
```

Local test (using the mock server)

Start the mock server (already provided in this repo):

```bash
node --loader ts-node/esm apps/docker-models/mock-server.ts
```

Then run the provider test pointing at the mock server (example):

```bash
DOCKER_INFERENCE_URL='http://localhost:8000/generate' \
  node --loader ts-node/esm apps/agent-gateway/test/providers.ts
```

Notes

- The mock server accepts POSTs to both `/generate` and `/v1/chat/completions` for compatibility with different provider conventions.
- Prefer `DOCKER_INFERENCE_URL` in new code to avoid confusion with `DOCKER_MODEL_URL` which may mean "model-file URL" in other projects.
