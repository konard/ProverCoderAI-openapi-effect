import type {
  FilterKeys,
  HttpMethod,
  IsOperationRequestBodyOptional,
  OperationRequestBodyContent,
  PathsWithMethod,
  RequiredKeysOf,
  Writable
} from "openapi-typescript-helpers"

export interface ClientOptions extends Omit<RequestInit, "headers"> {
  baseUrl?: string
  fetch?: (input: Request) => ReturnType<typeof globalThis.fetch>
  Request?: typeof Request
  querySerializer?: QuerySerializer<unknown> | QuerySerializerOptions
  bodySerializer?: BodySerializer<unknown>
  pathSerializer?: PathSerializer
  headers?: HeadersOptions
  requestInitExt?: Record<string, unknown>
}

export type HeadersOptions =
  | Required<RequestInit>["headers"]
  | Record<
    string,
    string | number | boolean | Array<string | number | boolean> | null | undefined
  >

export type QuerySerializer<T> = (
  query: T extends { parameters: infer Parameters } ? Parameters extends { query?: infer Query } ? NonNullable<Query>
    : Record<string, unknown>
    : Record<string, unknown>
) => string

export type QuerySerializerOptions = {
  array?: {
    style: "form" | "spaceDelimited" | "pipeDelimited"
    explode: boolean
  }
  object?: {
    style: "form" | "deepObject"
    explode: boolean
  }
  allowReserved?: boolean
}

export type BodySerializer<T> = (
  body: Writable<OperationRequestBodyContent<T>> | BodyInit | object,
  headers?: Headers | HeadersOptions
) => BodyInit

export type PathSerializer = (
  pathname: string,
  pathParameters: Record<string, unknown>
) => string

type BodyType<T = unknown> = {
  json: T
  text: Awaited<ReturnType<Response["text"]>>
  blob: Awaited<ReturnType<Response["blob"]>>
  arrayBuffer: Awaited<ReturnType<Response["arrayBuffer"]>>
  stream: Response["body"]
}

export type ParseAs = keyof BodyType

export interface DefaultParametersOption {
  params?: {
    query?: Record<string, unknown>
  }
}

export type DefaultParamsOption = DefaultParametersOption

export type ParametersOption<T> = T extends { parameters: infer Parameters }
  ? RequiredKeysOf<Parameters> extends never ? { params?: Parameters }
  : { params: Parameters }
  : DefaultParametersOption

export type ParamsOption<T> = ParametersOption<T>

export type RequestBodyOption<T> = Writable<OperationRequestBodyContent<T>> extends never ? { body?: never }
  : IsOperationRequestBodyOptional<T> extends true ? { body?: Writable<OperationRequestBodyContent<T>> }
  : { body: Writable<OperationRequestBodyContent<T>> }

export type FetchOptions<T> = RequestOptions<T> & Omit<RequestInit, "body" | "headers">

export type RequestOptions<T> =
  & ParametersOption<T>
  & RequestBodyOption<T>
  & {
    baseUrl?: string
    querySerializer?: QuerySerializer<T> | QuerySerializerOptions
    bodySerializer?: BodySerializer<T>
    pathSerializer?: PathSerializer
    parseAs?: ParseAs
    fetch?: ClientOptions["fetch"]
    headers?: HeadersOptions
    middleware?: Array<Middleware>
  }

export type MergedOptions<T = unknown> = {
  baseUrl: string
  parseAs: ParseAs
  querySerializer: QuerySerializer<T>
  bodySerializer: BodySerializer<T>
  pathSerializer: PathSerializer
  fetch: typeof globalThis.fetch
}

export interface MiddlewareRequestParameters {
  query?: Record<string, unknown>
  header?: Record<string, unknown>
  path?: Record<string, unknown>
  cookie?: Record<string, unknown>
}

export type MiddlewareRequestParams = MiddlewareRequestParameters

export interface MiddlewareCallbackParameters {
  request: Request
  readonly schemaPath: string
  readonly params: MiddlewareRequestParameters
  readonly id: string
  readonly options: MergedOptions
}

export type MiddlewareCallbackParams = MiddlewareCallbackParameters

export type Thenable<T> = {
  readonly then: <Success = T, Failure = never>(
    onFulfilled?: ((value: T) => Success | Thenable<Success>) | null,
    onRejected?: ((reason: unknown) => Failure | Thenable<Failure>) | null
  ) => Thenable<Success | Failure>
}

export type AsyncValue<T> = T | undefined | Thenable<T | undefined>

export type MiddlewareOnRequest =
  | ((options: MiddlewareCallbackParameters) => AsyncValue<Request | Response>)
  | ((options: MiddlewareCallbackParameters) => void)

export type MiddlewareOnResponse =
  | ((options: MiddlewareCallbackParameters & { response: Response }) => AsyncValue<Response>)
  | ((options: MiddlewareCallbackParameters & { response: Response }) => void)

export type MiddlewareOnError =
  | ((options: MiddlewareCallbackParameters & { error: unknown }) => AsyncValue<Response | Error>)
  | ((options: MiddlewareCallbackParameters & { error: unknown }) => void)

export type Middleware =
  | {
    onRequest: MiddlewareOnRequest
    onResponse?: MiddlewareOnResponse
    onError?: MiddlewareOnError
  }
  | {
    onRequest?: MiddlewareOnRequest
    onResponse: MiddlewareOnResponse
    onError?: MiddlewareOnError
  }
  | {
    onRequest?: MiddlewareOnRequest
    onResponse?: MiddlewareOnResponse
    onError: MiddlewareOnError
  }

export type MaybeOptionalInit<Parameters_, Location extends keyof Parameters_> = RequiredKeysOf<
  FetchOptions<FilterKeys<Parameters_, Location>>
> extends never ? FetchOptions<FilterKeys<Parameters_, Location>> | undefined
  : FetchOptions<FilterKeys<Parameters_, Location>>

export type InitParameter<Init> = RequiredKeysOf<Init> extends never ? [(Init & { [key: string]: unknown })?]
  : [Init & { [key: string]: unknown }]

export type InitParam<Init> = InitParameter<Init>

export type OperationFor<
  Paths extends object,
  Path extends keyof Paths,
  Method extends HttpMethod
> = Paths[Path] extends Record<Method, infer Operation> ? Operation & Record<string | number, unknown>
  : never

export type MethodArguments<
  Paths extends object,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init extends MaybeOptionalInit<Paths[Path], Extract<Method, keyof Paths[Path]>>
> = [url: Path, ...init: InitParameter<Init>]

export type MethodArgs<
  Paths extends object,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init extends MaybeOptionalInit<Paths[Path], Extract<Method, keyof Paths[Path]>>
> = MethodArguments<Paths, Method, Path, Init>

export type RequestMethodArguments<Method extends HttpMethod, Arguments extends ReadonlyArray<unknown>> = [
  method: Method,
  ...args: Arguments
]

export type RequestMethodArgs<Method extends HttpMethod, Arguments extends ReadonlyArray<unknown>> =
  RequestMethodArguments<Method, Arguments>
