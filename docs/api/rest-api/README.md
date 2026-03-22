# REST API Reference

**Version:** 1.0.0

**Base URL (production):** `https://api.revealui.com/api`

**Interactive docs:** Start the API server (`pnpm dev:api`) and open [http://localhost:3004](http://localhost:3004) for full Swagger UI with request builder.

> **Note:** This reference is generated from `examples/api/openapi.json`. To regenerate from the live API spec, run:
> ```bash
> curl http://localhost:3004/openapi.json > examples/api/openapi.json
> pnpm docs:generate:api
> ```

---

## Authentication

RevealUI uses **session-based authentication** (no JWTs). Sign in via `POST /auth/sign-in` to receive a `revealui-session` cookie. Include this cookie in all subsequent requests. Routes marked 🔒 require an active session.

---

## Endpoints

- [Authentication](#authentication)
- [Memory](#memory)
- [Shapes](#shapes)
- [Health](#health)

---

## Authentication

User authentication and session management

### `POST` `/auth/sign-in`

**Sign in**

Authenticate user and create session

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string (email)` | ✓ |  |
| `password` | `string (password)` | ✓ |  |

**Responses**

- `200` — Sign in successful
- `401` — Invalid credentials

---

### `POST` `/auth/sign-up`

**Sign up**

Create new user account

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string (email)` | ✓ |  |
| `password` | `string (password)` | ✓ |  |
| `name` | `string` | ✓ |  |

**Responses**

- `201` — User created successfully
- `400` — Invalid input

---

### `POST` `/auth/sign-out`

**Sign out**

End user session

**Responses**

- `200` — Sign out successful

---

### `GET` `/auth/me` 🔒

**Get current user**

Returns authenticated user information

**Responses**

- `200` — User information
- `401` — Unauthorized

---

## Memory

AI memory operations (episodic, working, vector)

### `POST` `/memory/search`

**Search memories**

Vector similarity search for agent memories

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `query` | `string` | ✓ |  |
| `limit` | `integer` | — |  |
| `threshold` | `number` | — |  |

**Responses**

- `200` — Search results

---

## Shapes

ElectricSQL shape subscriptions

### `GET` `/shapes/agent-contexts`

**Subscribe to agent contexts**

ElectricSQL shape subscription for agent contexts

**Responses**

- `200` — Shape subscription established

---

### `GET` `/shapes/conversations`

**Subscribe to conversations**

ElectricSQL shape subscription for conversations

**Responses**

- `200` — Shape subscription established

---

## Health

Health check endpoints

### `GET` `/health`

**Health check**

Returns API health status

**Responses**

- `200` — API is healthy

---

### `GET` `/health/ready`

**Readiness check**

Returns API readiness status

**Responses**

- `200` — API is ready

---
