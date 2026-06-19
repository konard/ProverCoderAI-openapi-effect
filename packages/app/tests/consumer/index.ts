// Consumer proof: external project imports createClientEffect and compiles with tsc --noEmit.
// This file must compile cleanly with no local module declaration overrides.
import type {
  serializeArrayParameter,
  serializeObjectParameter,
  serializePrimitiveParameter
} from "@prover-coder-ai/openapi-effect"
import {
  createClientEffect,
  serializeArrayParam,
  serializeObjectParam,
  serializePrimitiveParam
} from "@prover-coder-ai/openapi-effect"

type Paths = {
  "/health": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { ok: boolean }
          }
        }
      }
    }
  }
}

const client = createClientEffect<Paths>()

// Verify .GET exists and returns something (compile-time only).
export const requestHealth = () => client.GET("/health")

const legacyArraySerializer: typeof serializeArrayParameter = serializeArrayParam
const legacyObjectSerializer: typeof serializeObjectParameter = serializeObjectParam
const legacyPrimitiveSerializer: typeof serializePrimitiveParameter = serializePrimitiveParam

export const createCompatibilityProof = () => [
  legacyArraySerializer("id", [1], { style: "form", explode: true }),
  legacyObjectSerializer("filter", { status: "open" }, { style: "deepObject", explode: true }),
  legacyPrimitiveSerializer("ok", true)
]
