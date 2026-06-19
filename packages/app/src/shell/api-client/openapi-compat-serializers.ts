import type { QuerySerializer, QuerySerializerOptions } from "./create-client-types.js"
import { isPrimitive, isRecord, type Primitive } from "./openapi-compat-value-guards.js"

type PathStyle = "simple" | "label" | "matrix"
type ObjectParameterStyle = PathStyle | "form" | "deepObject"
type ArrayParameterStyle = PathStyle | "form" | "spaceDelimited" | "pipeDelimited"

const OBJECT_JOINER_BY_STYLE: Readonly<Record<ObjectParameterStyle, string>> = {
  simple: ",",
  label: ".",
  matrix: ";",
  form: "&",
  deepObject: "&"
}

const ARRAY_JOINER_BY_STYLE: Readonly<
  Record<ArrayParameterStyle, { explodeFalse: string; explodeTrue: string }>
> = {
  simple: { explodeFalse: ",", explodeTrue: "," },
  label: { explodeFalse: ",", explodeTrue: "." },
  matrix: { explodeFalse: ",", explodeTrue: ";" },
  form: { explodeFalse: ",", explodeTrue: "&" },
  spaceDelimited: { explodeFalse: "%20", explodeTrue: "&" },
  pipeDelimited: { explodeFalse: "|", explodeTrue: "&" }
}

const encodeValue = (value: Primitive, shouldAllowReserved: boolean): string => (
  shouldAllowReserved ? String(value) : encodeURIComponent(String(value))
)

const formatExplodeFalse = (
  name: string,
  style: ObjectParameterStyle | ArrayParameterStyle,
  value: string
): string => {
  if (style === "simple") {
    return value
  }
  if (style === "label") {
    return `.${value}`
  }
  if (style === "matrix") {
    return `;${name}=${value}`
  }
  return `${name}=${value}`
}

const formatExplodeTrue = (
  style: ObjectParameterStyle | ArrayParameterStyle,
  joiner: string,
  value: string
): string => (
  style === "label" || style === "matrix" ? `${joiner}${value}` : value
)

const toPrimitiveList = (value: Array<unknown>): Array<Primitive> => {
  const items: Array<Primitive> = []
  for (const item of value) {
    if (isPrimitive(item)) {
      items.push(item)
    }
  }
  return items
}

const getQueryEntries = (queryParameters: unknown): Array<[string, unknown]> => (
  isRecord(queryParameters) ? Object.entries(queryParameters) : []
)

const toObjectPairs = (
  name: string,
  value: Record<string, unknown>,
  shouldAllowReserved: boolean,
  shouldExplode: boolean,
  style: ObjectParameterStyle
): Array<string> => {
  const entries: Array<string> = []

  for (const [key, rawValue] of Object.entries(value)) {
    if (!isPrimitive(rawValue)) {
      continue
    }

    if (!shouldExplode) {
      entries.push(key, encodeValue(rawValue, shouldAllowReserved))
      continue
    }

    const nextName = style === "deepObject" ? `${name}[${key}]` : key
    entries.push(
      serializePrimitiveParameter(nextName, rawValue, {
        allowReserved: shouldAllowReserved
      })
    )
  }

  return entries
}

const toArrayValues = (
  name: string,
  value: Array<unknown>,
  style: ArrayParameterStyle,
  shouldAllowReserved: boolean,
  shouldExplode: boolean
): Array<string> => {
  const entries: Array<string> = []

  for (const item of toPrimitiveList(value)) {
    if (shouldExplode && style !== "simple" && style !== "label") {
      entries.push(
        serializePrimitiveParameter(name, item, {
          allowReserved: shouldAllowReserved
        })
      )
      continue
    }

    entries.push(encodeValue(item, shouldAllowReserved))
  }

  return entries
}

const finalizeSerializedParameter = (options: {
  name: string
  style: ObjectParameterStyle | ArrayParameterStyle
  explode: boolean
  values: Array<string>
  joinerWhenExplodeFalse: string
  joinerWhenExplodeTrue: string
}): string => {
  const joiner = options.explode ? options.joinerWhenExplodeTrue : options.joinerWhenExplodeFalse
  const serializedValue = options.values.join(joiner)

  return options.explode
    ? formatExplodeTrue(options.style, options.joinerWhenExplodeTrue, serializedValue)
    : formatExplodeFalse(options.name, options.style, serializedValue)
}

export const serializePrimitiveParameter = (
  name: string,
  value: Primitive,
  options?: { allowReserved?: boolean }
): string => (
  `${name}=${encodeValue(value, options?.allowReserved === true)}`
)

export const serializeObjectParameter = (
  name: string,
  value: unknown,
  options: {
    style: ObjectParameterStyle
    explode: boolean
    allowReserved?: boolean
  }
): string => {
  if (!isRecord(value)) {
    return ""
  }

  const pairs = toObjectPairs(
    name,
    value,
    options.allowReserved === true,
    options.explode,
    options.style
  )

  return finalizeSerializedParameter({
    name,
    style: options.style,
    explode: options.explode,
    values: pairs,
    joinerWhenExplodeFalse: ",",
    joinerWhenExplodeTrue: OBJECT_JOINER_BY_STYLE[options.style]
  })
}

export const serializeArrayParameter = (
  name: string,
  value: Array<unknown>,
  options: {
    style: ArrayParameterStyle
    explode: boolean
    allowReserved?: boolean
  }
): string => {
  if (!Array.isArray(value)) {
    return ""
  }

  const values = toArrayValues(
    name,
    value,
    options.style,
    options.allowReserved === true,
    options.explode
  )

  return finalizeSerializedParameter({
    name,
    style: options.style,
    explode: options.explode,
    values,
    joinerWhenExplodeFalse: ARRAY_JOINER_BY_STYLE[options.style].explodeFalse,
    joinerWhenExplodeTrue: ARRAY_JOINER_BY_STYLE[options.style].explodeTrue
  })
}

const serializeQueryEntry = (
  name: string,
  value: unknown,
  options?: QuerySerializerOptions
): string => {
  if (value === undefined || value === null) {
    return ""
  }

  if (Array.isArray(value)) {
    return serializeArrayQueryEntry(name, value, options)
  }

  return serializeNonArrayQueryEntry(name, value, options)
}

const serializeArrayQueryEntry = (
  name: string,
  value: Array<unknown>,
  options?: QuerySerializerOptions
): string => {
  if (value.length === 0) {
    return ""
  }

  return serializeArrayParameter(name, value, {
    style: "form",
    explode: true,
    ...options?.array,
    allowReserved: options?.allowReserved === true
  })
}

const serializeNonArrayQueryEntry = (
  name: string,
  value: unknown,
  options?: QuerySerializerOptions
): string => {
  if (isRecord(value)) {
    return serializeObjectParameter(name, value, {
      style: "deepObject",
      explode: true,
      ...options?.object,
      allowReserved: options?.allowReserved === true
    })
  }

  if (isPrimitive(value)) {
    return serializePrimitiveParameter(name, value, options)
  }

  return ""
}

export const createQuerySerializer = <T = unknown>(
  options?: QuerySerializerOptions
): QuerySerializer<T> =>
(queryParameters) => {
  const serialized: Array<string> = []

  for (const [name, value] of getQueryEntries(queryParameters)) {
    const entry = serializeQueryEntry(name, value, options)
    if (entry.length > 0) {
      serialized.push(entry)
    }
  }

  return serialized.join("&")
}
