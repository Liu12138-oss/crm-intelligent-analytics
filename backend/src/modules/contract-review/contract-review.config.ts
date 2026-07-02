import { Injectable } from '@nestjs/common';
import { join } from 'node:path';

@Injectable()
export class ContractReviewConfigService {
  private readonly storageRoot =
    process.env.CONTRACT_REVIEW_STORAGE_DIR?.trim() ||
    join(process.cwd(), '.runtime', 'contract-review');

  private readonly maxFileSizeBytes =
    Number(process.env.CONTRACT_REVIEW_MAX_FILE_SIZE_MB ?? '10') * 1024 * 1024;

  private readonly reviewerRoleIds = this.parseRoleIds(
    process.env.CONTRACT_REVIEW_REVIEWER_ROLE_IDS,
    ['role_admin'],
  );

  private readonly downloaderRoleIds = this.parseRoleIds(
    process.env.CONTRACT_REVIEW_DOWNLOADER_ROLE_IDS,
    ['role_admin'],
  );

  private readonly skillPackRootDir =
    process.env.CONTRACT_REVIEW_SKILL_PACK_ROOT_DIR?.trim() ||
    join(process.cwd(), 'resources', 'contract-review-skill-packs');

  private readonly activeSkillPackCode =
    process.env.CONTRACT_REVIEW_SKILL_PACK_CODE?.trim() || 'company-commercial-v1';

  private readonly aiReviewTimeoutMs = Number(
    process.env.CONTRACT_REVIEW_AI_TIMEOUT_MS ?? '150000',
  );

  private readonly aiMaxParallelGroups = this.parsePositiveInteger(
    process.env.CONTRACT_REVIEW_AI_MAX_PARALLEL_GROUPS,
    1,
  );

  private readonly aiSupplementalReviewTimeoutMs = Number(
    process.env.CONTRACT_REVIEW_AI_SUPPLEMENTAL_TIMEOUT_MS ?? '45000',
  );

  private readonly aiSupplementalMaxChecksPerBatch = this.parsePositiveInteger(
    process.env.CONTRACT_REVIEW_AI_SUPPLEMENTAL_MAX_CHECKS_PER_BATCH,
    1,
  );

  getStorageRoot(): string {
    return this.storageRoot;
  }

  getAllowedExtensions(): string[] {
    return ['.docx'];
  }

  getMaxFileSizeBytes(): number {
    return this.maxFileSizeBytes;
  }

  getReviewerRoleIds(): string[] {
    return [...this.reviewerRoleIds];
  }

  getDownloaderRoleIds(): string[] {
    return [...this.downloaderRoleIds];
  }

  getSkillPackRootDir(): string {
    return this.skillPackRootDir;
  }

  getActiveSkillPackCode(): string {
    return this.activeSkillPackCode;
  }

  getAiReviewTimeoutMs(): number {
    return this.aiReviewTimeoutMs;
  }

  getAiMaxParallelGroups(): number {
    return this.aiMaxParallelGroups;
  }

  getAiSupplementalReviewTimeoutMs(): number {
    return this.aiSupplementalReviewTimeoutMs;
  }

  getAiSupplementalMaxChecksPerBatch(): number {
    return this.aiSupplementalMaxChecksPerBatch;
  }

  private parseRoleIds(value: string | undefined, defaults: string[]): string[] {
    const roleIds = value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return roleIds && roleIds.length > 0 ? roleIds : defaults;
  }

  private parsePositiveInteger(value: string | undefined, fallback: number): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
