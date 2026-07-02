import { Injectable } from '@nestjs/common';
import type { AiContextPolicyRecord } from '../../shared/types/domain';
import { AiContextPolicyRepository } from './ai-context-policy.repository';

export interface AiContextPolicyUpdateInput {
  turnRetentionLimit: number;
  historySummaryMaxLength: number;
  latestQuestionMaxLength: number;
  latestSummaryMaxLength: number;
  analysisSessionIdleTimeoutSeconds: number;
  taskSessionIdleTimeoutSeconds: number;
}

@Injectable()
export class AiContextPolicyService {
  constructor(
    private readonly aiContextPolicyRepository: AiContextPolicyRepository,
  ) {}

  getCurrent(): AiContextPolicyRecord {
    return this.aiContextPolicyRepository.getCurrent();
  }

  update(
    actorId: string,
    input: AiContextPolicyUpdateInput,
  ): AiContextPolicyRecord {
    const currentPolicy = this.aiContextPolicyRepository.getCurrent();
    return this.aiContextPolicyRepository.save({
      ...currentPolicy,
      ...input,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    });
  }

  trimTextByLimit(value: string | undefined, limit: number): string | undefined {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
      return undefined;
    }

    if (normalizedValue.length <= limit) {
      return normalizedValue;
    }

    return normalizedValue.slice(0, limit);
  }

  trimLatestQuestion(value: string | undefined): string | undefined {
    return this.trimTextByLimit(
      value,
      this.getCurrent().latestQuestionMaxLength,
    );
  }

  trimLatestSummary(value: string | undefined): string | undefined {
    return this.trimTextByLimit(
      value,
      this.getCurrent().latestSummaryMaxLength,
    );
  }

  trimHistorySummary(value: string | undefined): string | undefined {
    return this.trimTextByLimit(
      value,
      this.getCurrent().historySummaryMaxLength,
    );
  }

  isAnalysisSessionExpired(
    updatedAt: string | undefined,
    referenceAt: string,
  ): boolean {
    return this.isExpired(
      updatedAt,
      referenceAt,
      this.getCurrent().analysisSessionIdleTimeoutSeconds,
    );
  }

  isTaskSessionExpired(
    updatedAt: string | undefined,
    referenceAt: string,
  ): boolean {
    return this.isExpired(
      updatedAt,
      referenceAt,
      this.getCurrent().taskSessionIdleTimeoutSeconds,
    );
  }

  private isExpired(
    updatedAt: string | undefined,
    referenceAt: string,
    timeoutSeconds: number,
  ): boolean {
    const updatedAtValue = Date.parse(updatedAt ?? '');
    const referenceAtValue = Date.parse(referenceAt);
    if (!Number.isFinite(updatedAtValue) || !Number.isFinite(referenceAtValue)) {
      return false;
    }

    return referenceAtValue - updatedAtValue > timeoutSeconds * 1000;
  }
}
