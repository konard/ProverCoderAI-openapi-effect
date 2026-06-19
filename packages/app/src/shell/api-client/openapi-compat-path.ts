import {
  serializeArrayParameter,
  serializeObjectParameter,
  serializePrimitiveParameter
} from "./openapi-compat-serializers.js"
import { isPrimitive, isRecord } from "./openapi-compat-value-guards.js"

const PATH_PARAM_RE = /\{[^{}]+\}/g

type PathStyle = "simple" | "label" | "matrix"

type PathTokenMeta = {
  name: string
  explode: boolean
  style: PathStyle
}

const toPathTokenMeta = (rawName: string): PathTokenMeta => {
  let name = rawName
  let isExplode = false
  let style: PathStyle = "simple"

  if (name.endsWith("*")) {
    isExplode = true
    name = name.slice(0, Math.max(0, name.length - 1))
  }

  if (name.startsWith(".")) {
    style = "label"
    name = name.slice(1)
  } else if (name.startsWith(";")) {
    style = "matrix"
    name = name.slice(1)
  }

  return { name, explode: isExplode, style }
}

const serializePathValue = (
  name: string,
  value: unknown,
  meta: PathTokenMeta
): string | undefined => {
  if (Array.isArray(value)) {
    return serializeArrayParameter(name, value, { style: meta.style, explode: meta.explode })
  }

  if (isRecord(value)) {
    return serializeObjectParameter(name, value, { style: meta.style, explode: meta.explode })
  }

  if (!isPrimitive(value)) {
    return
  }

  if (meta.style === "matrix") {
    return `;${serializePrimitiveParameter(name, value)}`
  }

  const encoded = encodeURIComponent(String(value))
  return meta.style === "label" ? `.${encoded}` : encoded
}

export const defaultPathSerializer = (
  pathname: string,
  pathParameters: Record<string, unknown>
): string => {
  let nextURL = pathname
  const pathParameterMatches = pathname.match(PATH_PARAM_RE) ?? []

  for (const match of pathParameterMatches) {
    const rawName = match.slice(1, -1)
    const meta = toPathTokenMeta(rawName)
    const value = pathParameters[meta.name]

    if (value === undefined || value === null) {
      continue
    }

    const serializedValue = serializePathValue(meta.name, value, meta)
    if (serializedValue !== undefined) {
      nextURL = nextURL.replace(match, () => serializedValue)
    }
  }

  return nextURL
}
