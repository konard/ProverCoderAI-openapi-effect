# Strict Effect API Client

Type-safe OpenAPI Effect client with exhaustive error handling and mathematically provable guarantees.

## Overview

This library generates a type-safe HTTP client from OpenAPI specifications that:

- Returns `Effect<Success, Failure, never>` for all requests
- Provides **correlated sum types** where `status → body type`
- Handles **all protocol invariants** through explicit error branches
- Never throws uncaught exceptions - all errors are typed in the `Effect` channel
- Enforces exhaustive pattern matching at compile time

## Mathematical Guarantees

### Core Invariants

```
∀ operation ∈ Operations:
  execute(operation) → Effect<Success<Op>, Failure<Op>, never>

where:
  Success<Op> = ⋃(s∈Success2xx) { status: s, contentType: CT(s), body: Body(s, CT(s)) }
  Failure<Op> = HttpError<Op> | BoundaryError
  BoundaryError = TransportError | UnexpectedStatus | UnexpectedContentType | ParseError | DecodeError
```

### Type Safety Properties

1. **No `any` or `unknown` in generated code** - All types are explicitly defined
2. **Correlated status → body** - TypeScript prevents incorrect body types for status codes
3. **Exhaustive error handling** - Missing error cases cause compile-time errors
4. **No runtime exceptions** - All errors captured in Effect channel

## Installation

```bash
pnpm add @effect-template/strict-effect-api-client effect @effect/schema
pnpm add -D openapi-typescript openapi-typescript-helpers
```

## Quick Start

### 1. Generate TypeScript Types

```bash
npx openapi-typescript your-api.json -o api.d.ts
```

### 2. Generate Strict Client Code

```bash
pnpm gen:strict-api your-api.json src/generated
```

This creates:
- `src/generated/dispatch.ts` - Exhaustive status/content-type dispatchers
- `src/generated/decoders.ts` - Runtime validation stubs
- `src/generated/index.ts` - Exports

### 3. Use the Client

```typescript
import { Effect, pipe } from "effect"
import { createStrictClient } from "@effect-template/strict-effect-api-client"
import type { paths } from "./api.js"
import { dispatcherlistPets } from "./generated/dispatch.js"

type ApiPaths = paths & Record<string, unknown>

const client = createStrictClient<ApiPaths>()

// Example: List pets
const listPets = client.GET("/pets", {
  baseUrl: "https://api.example.com",
  dispatcher: dispatcherlistPets,
  query: { limit: 10 }
})

// Execute with exhaustive error handling
const program = pipe(
  listPets,
  Effect.match({
    onFailure: (error) => {
      // All errors are typed - compiler enforces exhaustive handling
      switch (error._tag) {
        case "TransportError":
          console.error("Network failure:", error.error.message)
          break
        case "UnexpectedStatus":
          console.error(`Unexpected status ${error.status}:`, error.body)
          break
        case "UnexpectedContentType":
          console.error(`Expected ${error.expected}, got ${error.actual}`)
          break
        case "ParseError":
          console.error("JSON parse failed:", error.error.message)
          break
        case "DecodeError":
          console.error("Schema validation failed:", error.error)
          break
        default:
          // HTTP errors from schema (e.g., 500)
          if ("status" in error) {
            console.error(`HTTP ${error.status}:`, error.body)
          }
      }
    },
    onSuccess: (response) => {
      // Response is correlated: status determines body type
      if (response.status === 200) {
        console.log("Pets:", response.body) // body is Pet[]
      }
    }
  })
)
```

## Error Classification

### Success Responses (2xx)

```typescript
type Success =
  | { status: 200; contentType: "application/json"; body: Pet[] }
  | { status: 201; contentType: "application/json"; body: Pet }
  | { status: 204; contentType: "none"; body: void }
```

### HTTP Errors (from schema)

```typescript
type HttpError =
  | { status: 400; contentType: "application/json"; body: ErrorResponse }
  | { status: 404; contentType: "application/json"; body: ErrorResponse }
  | { status: 500; contentType: "application/json"; body: ErrorResponse }
```

### Boundary Errors (protocol failures)

Always present regardless of schema:

```typescript
type BoundaryError =
  | { _tag: "TransportError"; error: Error }
  | { _tag: "UnexpectedStatus"; status: number; body: string }
  | { _tag: "UnexpectedContentType"; status: number; expected: string[]; actual: string | undefined; body: string }
  | { _tag: "ParseError"; status: number; contentType: string; error: Error; body: string }
  | { _tag: "DecodeError"; status: number; contentType: string; error: unknown; body: string }
```

## Acceptance Criteria Verification

### A) Static Totality

#### A1. Generation

```bash
pnpm gen:strict-api
```

Generates:
- ✅ `src/generated/dispatch.ts` - No `any` or `unknown`
- ✅ `src/generated/decoders.ts` - Type-safe decoder stubs

#### A2. Type Safety

```bash
pnpm typecheck
```

- ✅ Compiles with `strict: true` and `exactOptionalPropertyTypes: true`
- ✅ Adding `any`/`unknown` causes build failures (enforced by ESLint)

#### A3. Exhaustive Coverage

```typescript
// This code will fail to compile if any status is not handled
const handleResponse = (result: Either<Failure, Success>) => {
  if (result._tag === "Left") {
    switch (result.left._tag) {
      case "TransportError": return "transport"
      case "UnexpectedStatus": return "unexpected status"
      case "UnexpectedContentType": return "unexpected content-type"
      case "ParseError": return "parse"
      case "DecodeError": return "decode"
      default:
        // HTTP errors
        if ("status" in result.left) {
          switch (result.left.status) {
            case 400: return "bad request"
            case 404: return "not found"
            case 500: return "server error"
            // Omitting a status causes compile error
            default:
              return assertNever(result.left) // ← TypeScript error if incomplete
          }
        }
    }
  }
}
```

### B) Schema Adaptation

#### B1. Adding New Status

1. Update OpenAPI schema with new status (e.g., `401`)
2. Run `pnpm gen:strict-api`
3. Run `pnpm typecheck`

**Result**: Build fails until:
- Decoder for `401` is added
- User code handles `401` in exhaustive switch

### C) Runtime Safety

All boundary errors return typed failures, never throw exceptions:

#### C1. Unexpected Status (418)
```typescript
// Mock returns 418 (not in schema)
// Result: Effect.fail({ _tag: "UnexpectedStatus", status: 418, body: "..." })
```

#### C2. Unexpected Content-Type
```typescript
// Mock returns 200 with text/html (schema expects application/json)
// Result: Effect.fail({ _tag: "UnexpectedContentType", expected: ["application/json"], actual: "text/html", body: "..." })
```

#### C3. Parse Error
```typescript
// Mock returns invalid JSON
// Result: Effect.fail({ _tag: "ParseError", error: SyntaxError, body: "{bad json" })
```

#### C4. Decode Error
```typescript
// Mock returns valid JSON that fails schema validation
// Result: Effect.fail({ _tag: "DecodeError", error: ValidationError, body: "..." })
```

## Architecture

### Functional Core, Imperative Shell

```
CORE (Pure):
- strict-types.ts: Type-level operations, no runtime code
- All type computations at compile time

SHELL (Effects):
- strict-client.ts: HTTP execution with Effect
- Generated dispatchers: Status/content-type classification
- Generated decoders: Runtime validation
```

### Separation of Concerns

1. **Core Types** (`src/core/`) - Never change with schema updates
2. **Generator** (`scripts/`) - Deterministic code generation
3. **Generated Code** (`src/generated/`) - Regenerated on schema changes

## Development

### Generate Client

```bash
pnpm gen:strict-api [openapi.json] [output-dir]
```

Default: `tests/fixtures/petstore.openapi.json` → `src/generated`

### Run Tests

```bash
pnpm test
```

Tests verify:
- All boundary error cases (C1-C4)
- Generated dispatchers handle all statuses
- No uncaught exceptions

### Type Check

```bash
pnpm typecheck
```

Verifies:
- Strict TypeScript compilation
- No `any` or `unknown`
- Exhaustive pattern matching

## Contributing

When adding features:

1. Maintain mathematical invariants
2. No `any` or `unknown` in production code
3. All errors in Effect channel, never throw
4. Use `assertNever` for exhaustive switches
5. Document proof obligations

## License

ISC
