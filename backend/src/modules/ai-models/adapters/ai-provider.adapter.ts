import type {
  AiModelProfileRecord,
  AiSdkType,
  AiStructuredOutputMode,
  AiWireApi,
} from '../../../shared/types/domain';

export type AiExecutableProfile = AiModelProfileRecord & {
  apiKey?: string;
};

export interface AiProviderHealthCheckResult {
  status: 'SUCCEEDED' | 'FAILED';
  latencyMs: number;
  failureStage?:
    | 'STATIC_VALIDATION'
    | 'SDK_INIT'
    | 'SDK_CALL'
    | 'MCP_INIT'
    | 'HTTP_REQUEST'
    | 'HTTP_STATUS'
    | 'RESPONSE_PARSE'
    | 'SCHEMA_VALIDATION';
  failureReason?: string;
  providerSummary: string;
  mcpStatuses?: Array<{
    name?: string;
    status?: string;
    error?: string;
  }>;
}

export interface AiProviderTextInvokeParams {
  profile: AiExecutableProfile;
  prompt: string;
  system?: string;
  cwd?: string;
  requestOverrides?: {
    wireApi?: AiWireApi;
    structuredOutputMode?: AiStructuredOutputMode;
    disableResponseStorage?: boolean;
    enableThinking?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
  };
}

export interface AiProviderStructuredInvokeParams extends AiProviderTextInvokeParams {
  outputSchema: Record<string, unknown>;
}

/**
 * 统一抽象不同 AI SDK 的调用与健康检查入口，避免业务层直接感知具体 provider。
 */
export interface AiProviderAdapter {
  readonly sdkType: AiSdkType;
  validateProfile(profile: AiExecutableProfile): void;
  healthCheck(profile: AiExecutableProfile): Promise<AiProviderHealthCheckResult>;
  invokeText(params: AiProviderTextInvokeParams): Promise<string>;
  invokeStructured(params: AiProviderStructuredInvokeParams): Promise<unknown>;
}
