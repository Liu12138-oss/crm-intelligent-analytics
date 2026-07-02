import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AnalysisSemanticKnowledgeAssetRecord,
  AnalysisSemanticKnowledgePublicationRecord,
  CrmUser,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { AnalysisSemanticKnowledgeRepository } from './analysis-semantic-knowledge.repository';
import {
  semanticKnowledgeAssetStatusSchema,
  semanticKnowledgeAssetWriteSchema,
  semanticKnowledgePublishSchema,
  semanticKnowledgeRollbackSchema,
} from './analysis-semantic-knowledge.schema';

@Injectable()
export class AnalysisSemanticKnowledgeGovernanceService {
  constructor(
    private readonly repository: AnalysisSemanticKnowledgeRepository,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
  ) {}

  list() {
    const draftItems = this.repository.listDraftAll().map((item) => this.decorate(item));
    const latestPublication = this.repository.listPublications()[0];
    return {
      draftItems,
      publishedSummary: {
        version: latestPublication?.version,
        assetCount: latestPublication?.assetCount ?? this.repository.listPublishedAll().length,
        publishedBy: latestPublication?.publishedBy,
        publishedAt: latestPublication?.publishedAt,
        changeSummary: latestPublication?.changeSummary,
      },
    };
  }

  getDetail(assetId: string) {
    const record = this.repository.findDraftById(assetId);
    if (!record) {
      throw new NotFoundException('语义资产不存在。');
    }

    return this.decorate(record);
  }

  create(user: CrmUser, payload: unknown) {
    const parsed = semanticKnowledgeAssetWriteSchema.parse(payload);
    const record: AnalysisSemanticKnowledgeAssetRecord = {
      id: buildEntityId('semantic_asset'),
      ...parsed,
      synonyms: parsed.synonyms ? [...parsed.synonyms] : undefined,
      matchKeywords: [...parsed.matchKeywords],
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    };
    const saved = this.repository.saveDraft(record);
    this.auditAssetEvent(user, 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED', {
      assetId: saved.id,
      assetType: saved.type,
      after: saved,
    });
    return this.decorate(saved);
  }

  update(user: CrmUser, assetId: string, payload: unknown) {
    const before = this.repository.findDraftById(assetId);
    if (!before) {
      throw new NotFoundException('语义资产不存在。');
    }

    const parsed = semanticKnowledgeAssetWriteSchema.parse(payload);
    const saved = this.repository.saveDraft({
      ...before,
      ...parsed,
      synonyms: parsed.synonyms ? [...parsed.synonyms] : undefined,
      matchKeywords: [...parsed.matchKeywords],
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });
    this.auditAssetEvent(user, 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED', {
      assetId: saved.id,
      assetType: saved.type,
      before,
      after: saved,
    });
    return this.decorate(saved);
  }

  setStatus(user: CrmUser, assetId: string, payload: unknown) {
    const before = this.repository.findDraftById(assetId);
    if (!before) {
      throw new NotFoundException('语义资产不存在。');
    }

    const parsed = semanticKnowledgeAssetStatusSchema.parse(payload);
    const saved = this.repository.saveDraft({
      ...before,
      status: parsed.status,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });
    this.auditAssetEvent(
      user,
      'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_STATUS_UPDATED',
      {
        assetId: saved.id,
        assetType: saved.type,
        before,
        after: saved,
      },
    );
    return this.decorate(saved);
  }

  publish(user: CrmUser, payload: unknown): AnalysisSemanticKnowledgePublicationRecord {
    const parsed = semanticKnowledgePublishSchema.parse(payload);
    const draftItems = this.repository.listDraftAll();
    if (draftItems.length === 0) {
      throw new BadRequestException('当前没有可发布的语义资产。');
    }

    const version = `semantic-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
    const snapshot = draftItems.map((item) => ({
      ...item,
      matchKeywords: [...item.matchKeywords],
      synonyms: item.synonyms ? [...item.synonyms] : undefined,
    }));
    const publication = this.repository.savePublication({
      version,
      changeSummary: parsed.changeSummary,
      assetCount: snapshot.length,
      publishedBy: user.id,
      publishedAt: new Date().toISOString(),
      snapshot,
    });
    this.repository.replacePublishedAssets(snapshot);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLISHED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        version: publication.version,
        assetCount: publication.assetCount,
        changeSummary: publication.changeSummary,
      },
      riskLevel: 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: `已发布语义资产版本 ${publication.version}。`,
      createdAt: new Date().toISOString(),
    });
    return publication;
  }

  rollback(user: CrmUser, payload: unknown) {
    const parsed = semanticKnowledgeRollbackSchema.parse(payload);
    const publication = this.repository.findPublicationByVersion(parsed.version);
    if (!publication) {
      throw new NotFoundException('目标语义资产版本不存在。');
    }

    this.repository.replacePublishedAssets(publication.snapshot);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'ANALYSIS_SEMANTIC_KNOWLEDGE_ROLLED_BACK',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        restoredVersion: publication.version,
        reason: parsed.reason,
        assetCount: publication.assetCount,
      },
      riskLevel: 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: `已回退到语义资产版本 ${publication.version}。`,
      createdAt: new Date().toISOString(),
    });
    return {
      restoredVersion: publication.version,
      assetCount: publication.assetCount,
      restoredAt: new Date().toISOString(),
    };
  }

  private decorate(record: AnalysisSemanticKnowledgeAssetRecord) {
    const latestPublishedVersion = this.resolveLatestPublishedVersion(record.id);
    return {
      ...record,
      latestPublishedVersion,
    };
  }

  private resolveLatestPublishedVersion(assetId: string): string | undefined {
    for (const publication of this.repository.listPublications()) {
      if (publication.snapshot.some((item) => item.id === assetId)) {
        return publication.version;
      }
    }

    return undefined;
  }

  private auditAssetEvent(
    user: CrmUser,
    eventType:
      | 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED'
      | 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_STATUS_UPDATED',
    params: {
      assetId: string;
      assetType: AnalysisSemanticKnowledgeAssetRecord['type'];
      before?: AnalysisSemanticKnowledgeAssetRecord;
      after: AnalysisSemanticKnowledgeAssetRecord;
    },
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        assetId: params.assetId,
        assetType: params.assetType,
        before: params.before,
        after: params.after,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `语义资产 ${params.after.name} 已更新。`,
      createdAt: new Date().toISOString(),
    });
  }
}
