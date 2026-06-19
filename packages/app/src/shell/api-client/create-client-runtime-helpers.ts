import { Effect } from "effect"

import { asStrictApiClient } from "../../core/axioms.js"
import { toError } from "./create-client-response.js"
import type { FetchWithRequestInitExtension, HeaderRecord } from "./create-client-runtime-types.js"
import type {
  BodySerializer,
  ClientOptions,
  MergedOptions,
  MiddlewareRequestParameters,
  ParseAs,
  PathSerializer,
  QuerySerializer,
  QuerySerializerOptions
} from "./create-client-types.js"
import { createQuerySerializer } from "./openapi-compat-utilities.js"

export const hasRequestInitExtensionSupport = (): boolean => (
  typeof process === "object"
  && Number(process.versions.node.slice(0, 2)) >= 18
  && typeof process.versions["undici"] === "string"
)

export const randomID = (): string => (
  crypto.randomUUID().replaceAll("-", "").slice(0, 9)
)

const isQuerySerializerOptions = (
  value: QuerySerializer<unknown> | QuerySerializerOptions | undefined
): value is QuerySerializerOptions => (
  value !== undefined && typeof value === "object"
)

export const resolveQuerySerializer = (
  globalQuerySerializer: ClientOptions["querySerializer"],
  requestQuerySerializer: QuerySerializer<unknown> | QuerySerializerOptions | undefined
): QuerySerializer<unknown> => {
  let serializer = typeof globalQuerySerializer === "function"
    ? globalQuerySerializer
    : createQuerySerializer(globalQuerySerializer)

  if (requestQuerySerializer) {
    serializer = typeof requestQuerySerializer === "function"
      ? requestQuerySerializer
      : createQuerySerializer({
        ...(isQuerySerializerOptions(globalQuerySerializer) && globalQuerySerializer),
        ...requestQuerySerializer
      })
  }

  return serializer
}

const isHeaderPrimitive = (value: unknown): value is string | number | boolean => (
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
)

export const toHeaderOverrides = (headers: MiddlewareRequestParameters["header"]): HeaderRecord => {
  if (headers === undefined) {
    return {}
  }

  const normalized: HeaderRecord = {}
  for (const [key, rawValue] of Object.entries(headers)) {
    if (rawValue === undefined || rawValue === null || isHeaderPrimitive(rawValue)) {
      normalized[key] = rawValue
      continue
    }

    if (Array.isArray(rawValue)) {
      normalized[key] = rawValue.filter((item) => isHeaderPrimitive(item))
    }
  }

  return normalized
}

const isBodyInit = (value: BodyInit | object): value is BodyInit => (
  typeof value === "string"
  || value instanceof Blob
  || value instanceof URLSearchParams
  || value instanceof ArrayBuffer
  || value instanceof FormData
  || value instanceof ReadableStream
)

export type SerializedBody = Readonly<{
  hasBody: boolean
  value: BodyInit | undefined
}>

export const serializeBody = (
  body: BodyInit | object | undefined,
  serializer: BodySerializer<unknown>,
  headers: Headers
): SerializedBody => {
  if (body === undefined) {
    return { hasBody: false, value: undefined }
  }

  if (isBodyInit(body)) {
    return { hasBody: true, value: body }
  }

  return { hasBody: true, value: serializer(body, headers) }
}

export const setCustomRequestFields = (request: Request, init: Record<string, unknown>): void => {
  for (const key in init) {
    if (!Reflect.has(request, key)) {
      Reflect.set(request, key, init[key])
    }
  }
}

export const invokeFetch = (
  fetch: NonNullable<ClientOptions["fetch"]>,
  request: Request,
  requestInitExtension?: Record<string, unknown>
): Effect.Effect<Response, Error> => {
  const fetchWithExtension = asStrictApiClient<FetchWithRequestInitExtension>(fetch)
  return Effect.tryPromise({
    try: () => fetchWithExtension(request, requestInitExtension),
    catch: toError
  })
}

export const createMergedOptions = (options: {
  baseUrl: string
  parseAs: ParseAs
  querySerializer: QuerySerializer<unknown>
  bodySerializer: BodySerializer<unknown>
  pathSerializer: PathSerializer
  fetch: NonNullable<ClientOptions["fetch"]>
}): MergedOptions =>
  Object.freeze<MergedOptions>({
    baseUrl: options.baseUrl,
    parseAs: options.parseAs,
    querySerializer: options.querySerializer,
    bodySerializer: options.bodySerializer,
    pathSerializer: options.pathSerializer,
    fetch: asStrictApiClient<typeof globalThis.fetch>(options.fetch)
  })
