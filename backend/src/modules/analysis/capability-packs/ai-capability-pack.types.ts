import type { AiStructuredOutputMode, AiWireApi } from '../../../shared/types/domain';

export type AiCapabilityPackFailureReason =
  | 'PACK_NOT_REGISTERED'
  | 'PACK_DISABLED'
  | 'PACK_NONE'
  | 'PACK_VALIDATION_FAILED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT';

export interface AiCapabilityRequestOverrides {
  wireApi?: AiWireApi;
  structuredOutputMode?: AiStructuredOutputMode;
  disableResponseStorage?: boolean;
  enableThinking?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  retryOnTimeout?: boolean;
}

export interface AiCapabilityProviderContext {
  providerCode: string;
  model: string;
  wireApi?: AiWireApi;
  structuredOutputMode?: AiStructuredOutputMode;
  sdkOptions?: Record<string, unknown>;
}

export interface AiCapabilityProviderTuning {
  requestOverrides?: AiCapabilityRequestOverrides;
  fewShotExamples?: string[];
}

export interface AiCapabilityStructuredRequest {
  prompt: string;
  system?: string;
  outputSchema: Record<string, unknown>;
}

export interface AiCapabilityPackDefinition<
  TContext,
  TRaw extends object,
  TOutput extends object,
> {
  packCode: string;
  packVersion: string;
  buildStructuredRequest: (
    context: TContext,
    tuning: AiCapabilityProviderTuning,
  ) => AiCapabilityStructuredRequest;
  normalize: (raw: TRaw, context: TContext) => TOutput;
  validate?: (output: TOutput, context: TContext) => string | undefined;
  isNone?: (output: TOutput, context: TContext) => boolean;
  resolveProviderTuning?: (
    providerContext: AiCapabilityProviderContext,
  ) => AiCapabilityProviderTuning | undefined;
}

export interface AiCapabilityPackExecutionResult<TOutput extends object> {
  status: 'SUCCEEDED' | 'FAILED' | 'NONE';
  packCode: string;
  packVersion: string;
  providerCode: string;
  model: string;
  output?: TOutput;
  failureReason?: AiCapabilityPackFailureReason;
  fallbackReason?: AiCapabilityPackFailureReason;
  failureMessage?: string;
  validationFailureReason?: string;
  rawResponsePreview?: string;
  rawResponseLength?: number;
  requestOverrides?: AiCapabilityRequestOverrides;
}
