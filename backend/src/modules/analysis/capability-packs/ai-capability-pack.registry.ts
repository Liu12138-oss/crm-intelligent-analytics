import { Injectable } from '@nestjs/common';
import type { AiCapabilityPackDefinition } from './ai-capability-pack.types';
import { analysisFollowUpPack } from './packs/analysis-follow-up.pack';
import { analysisIntentPack } from './packs/analysis-intent.pack';
import { businessAnalysisIntentPack } from './packs/business-analysis-intent.pack';
import { groundedExplanationPack } from './packs/grounded-explanation.pack';
import { richAnalysisReportPack } from './packs/rich-analysis-report.pack';
import { wecomActiveTaskReplyPack } from './packs/wecom-active-task-reply.pack';
import { wecomExplanationReplyPack } from './packs/wecom-explanation-reply.pack';
import { wecomIdleEntryPack } from './packs/wecom-idle-entry.pack';

type UnknownCapabilityPack = AiCapabilityPackDefinition<
  any,
  any,
  any
>;

const DEFAULT_CAPABILITY_PACKS: UnknownCapabilityPack[] = [
  wecomIdleEntryPack as UnknownCapabilityPack,
  wecomActiveTaskReplyPack as UnknownCapabilityPack,
  businessAnalysisIntentPack as UnknownCapabilityPack,
  analysisIntentPack as UnknownCapabilityPack,
  analysisFollowUpPack as UnknownCapabilityPack,
  groundedExplanationPack as UnknownCapabilityPack,
  richAnalysisReportPack as UnknownCapabilityPack,
  wecomExplanationReplyPack as UnknownCapabilityPack,
];

@Injectable()
export class AiCapabilityPackRegistry {
  private readonly packs = new Map<string, UnknownCapabilityPack>();

  constructor() {
    this.registerMany(DEFAULT_CAPABILITY_PACKS);
  }

  static fromPacks(initialPacks: UnknownCapabilityPack[]): AiCapabilityPackRegistry {
    const registry = new AiCapabilityPackRegistry();
    registry.packs.clear();
    registry.registerMany(initialPacks);
    return registry;
  }

  private registerMany(initialPacks: UnknownCapabilityPack[]): void {
    for (const pack of initialPacks) {
      this.packs.set(pack.packCode, pack);
    }
  }

  getPack<TContext, TRaw extends object, TOutput extends object>(
    packCode: string,
  ): AiCapabilityPackDefinition<TContext, TRaw, TOutput> | undefined {
    return this.packs.get(packCode) as
      | AiCapabilityPackDefinition<TContext, TRaw, TOutput>
      | undefined;
  }
}
