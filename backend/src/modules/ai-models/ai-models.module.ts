import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AiContextPolicyRepository } from './ai-context-policy.repository';
import { AiContextPolicyService } from './ai-context-policy.service';
import { AiModelProfileService } from './ai-model-profile.service';
import { AiHealthCheckService } from './ai-health-check.service';
import { AiModelAuditService } from './ai-model-audit.service';
import { AiProfileActivationService } from './ai-profile-activation.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiRuntimeConfigResolver } from './ai-runtime-config.resolver';
import { AiSecretCryptoService } from './ai-secret-crypto.service';
import { UnifiedAiExecutionService } from './unified-ai-execution.service';
import { AiModelEnvBootstrapService } from './ai-model-env-bootstrap.service';
import { ClaudeProviderAdapter } from './adapters/claude-provider.adapter';
import { CodexProviderAdapter } from './adapters/codex-provider.adapter';
import { OpenAiCompatibleHttpAdapter } from './adapters/openai-compatible-http.adapter';

@Module({
  imports: [DatabaseModule],
  providers: [
    AiSecretCryptoService,
    AuditEventRepository,
    AiContextPolicyRepository,
    AiContextPolicyService,
    AiModelProfileService,
    AiHealthCheckService,
    AiModelAuditService,
    AiProfileActivationService,
    AiRuntimeConfigResolver,
    UnifiedAiExecutionService,
    AiModelEnvBootstrapService,
    CodexProviderAdapter,
    ClaudeProviderAdapter,
    OpenAiCompatibleHttpAdapter,
    {
      provide: AiProviderRegistryService,
      useFactory: (
        codexProviderAdapter: CodexProviderAdapter,
        claudeProviderAdapter: ClaudeProviderAdapter,
        openAiCompatibleHttpAdapter: OpenAiCompatibleHttpAdapter,
      ) =>
        new AiProviderRegistryService([
          codexProviderAdapter,
          claudeProviderAdapter,
          openAiCompatibleHttpAdapter,
        ]),
      inject: [
        CodexProviderAdapter,
        ClaudeProviderAdapter,
        OpenAiCompatibleHttpAdapter,
      ],
    },
  ],
  exports: [
    AiSecretCryptoService,
    AiContextPolicyService,
    AiModelProfileService,
    AiHealthCheckService,
    AiModelAuditService,
    AiProfileActivationService,
    AiRuntimeConfigResolver,
    UnifiedAiExecutionService,
    AiModelEnvBootstrapService,
    CodexProviderAdapter,
    ClaudeProviderAdapter,
    OpenAiCompatibleHttpAdapter,
    AiProviderRegistryService,
  ],
})
export class AiModelsModule {}
