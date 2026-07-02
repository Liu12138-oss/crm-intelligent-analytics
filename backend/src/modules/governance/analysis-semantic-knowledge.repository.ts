import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  AnalysisSemanticKnowledgeAssetRecord,
  AnalysisSemanticKnowledgePublicationRecord,
} from '../../shared/types/domain';

@Injectable()
export class AnalysisSemanticKnowledgeRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  listDraftAll(): AnalysisSemanticKnowledgeAssetRecord[] {
    this.ensureInitialized();
    return [...this.appStorage.state.analysisSemanticKnowledgeDraftAssets];
  }

  listPublishedAll(): AnalysisSemanticKnowledgeAssetRecord[] {
    this.ensureInitialized();
    return [...this.appStorage.state.analysisSemanticKnowledgePublishedAssets];
  }

  listPublishedActive(): AnalysisSemanticKnowledgeAssetRecord[] {
    this.ensureInitialized();
    return this.appStorage.state.analysisSemanticKnowledgePublishedAssets.filter(
      (item) => item.status === 'ACTIVE',
    );
  }

  findDraftById(id: string): AnalysisSemanticKnowledgeAssetRecord | undefined {
    this.ensureInitialized();
    return this.appStorage.state.analysisSemanticKnowledgeDraftAssets.find(
      (item) => item.id === id,
    );
  }

  saveDraft(
    record: AnalysisSemanticKnowledgeAssetRecord,
  ): AnalysisSemanticKnowledgeAssetRecord {
    this.ensureInitialized();
    const currentIndex = this.appStorage.state.analysisSemanticKnowledgeDraftAssets.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.analysisSemanticKnowledgeDraftAssets[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.analysisSemanticKnowledgeDraftAssets.unshift(record);
    this.appStorage.persist();
    return record;
  }

  replacePublishedAssets(
    records: AnalysisSemanticKnowledgeAssetRecord[],
  ): AnalysisSemanticKnowledgeAssetRecord[] {
    this.ensureInitialized();
    this.appStorage.state.analysisSemanticKnowledgePublishedAssets = records.map((item) => ({
      ...item,
      matchKeywords: [...item.matchKeywords],
      synonyms: item.synonyms ? [...item.synonyms] : undefined,
    }));
    this.appStorage.persist();
    return this.listPublishedAll();
  }

  listPublications(): AnalysisSemanticKnowledgePublicationRecord[] {
    this.ensureInitialized();
    return [...this.appStorage.state.analysisSemanticKnowledgePublications];
  }

  findPublicationByVersion(
    version: string,
  ): AnalysisSemanticKnowledgePublicationRecord | undefined {
    this.ensureInitialized();
    return this.appStorage.state.analysisSemanticKnowledgePublications.find(
      (item) => item.version === version,
    );
  }

  savePublication(
    record: AnalysisSemanticKnowledgePublicationRecord,
  ): AnalysisSemanticKnowledgePublicationRecord {
    this.ensureInitialized();
    this.appStorage.state.analysisSemanticKnowledgePublications.unshift(record);
    this.appStorage.persist();
    return record;
  }

  private ensureInitialized(): void {
    if (!Array.isArray(this.appStorage.state.analysisSemanticKnowledgeDraftAssets)) {
      this.appStorage.state.analysisSemanticKnowledgeDraftAssets = [];
    }
    if (!Array.isArray(this.appStorage.state.analysisSemanticKnowledgePublishedAssets)) {
      this.appStorage.state.analysisSemanticKnowledgePublishedAssets = [];
    }
    if (!Array.isArray(this.appStorage.state.analysisSemanticKnowledgePublications)) {
      this.appStorage.state.analysisSemanticKnowledgePublications = [];
    }
  }
}
