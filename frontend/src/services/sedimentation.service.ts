/**
 * 知识沉淀治理服务
 *
 * 对接后端 /api/v1/governance/sedimentation/* 接口
 * 提供候选审核、口径收敛、沉淀效果统计等能力
 */

import { httpClient } from './http-client';

/**
 * 候选资产（前端展示用）
 */
export interface KnowledgeCandidateItem {
  id: string;
  type: 'ALIAS' | 'TEMPORAL_FIELD_HINT' | 'ORGANIZATION_NORMALIZATION' | 'VALIDATED_EXAMPLE' | 'NEGATIVE_EXAMPLE';
  name: string;
  status: string;
  reviewStatus: string;
  source: string;
  matchKeywords: string[];
  canonicalLabel?: string;
  synonyms?: string[];
  questionText?: string;
  sqlHint?: string;
  hint?: string;
  blockReason?: string;
  evidenceCount?: number;
  confidence?: number;
  proposedAt?: string;
  expiresAt?: string;
  derivedFromQueryIds?: string[];
}

/**
 * 口径冲突待办
 */
export interface CalibrationConflictItem {
  conflictId: string;
  term: string;
  resolutions: Record<string, string[]>;
  queryIds: string[];
  detectedAt: string;
  resolved: boolean;
}

/**
 * 沉淀效果统计
 */
export interface SedimentationEffectStats {
  totalProposed: number;
  totalApproved: number;
  totalRejected: number;
  totalExpired: number;
  approvalRate: number;
  byType: Record<string, { proposed: number; approved: number; rejected: number }>;
  recentRuns: Array<{ runAt: string; trigger: string; generatedCount: number }>;
}

/**
 * 沉淀运行结果
 */
export interface SedimentationRunResult {
  runAt: string;
  trigger: string;
  scannedEventCount: number;
  generatedCandidates: Array<{
    candidateId: string;
    candidateType: string;
    name: string;
    confidence: number;
    evidenceCount: number;
    derivedFromQueryIds: string[];
  }>;
  skippedReasons: string[];
}

export const sedimentationService = {
  /** 获取候选列表 */
  async getCandidates(): Promise<{ items: KnowledgeCandidateItem[]; total: number }> {
    return httpClient.get<{ items: KnowledgeCandidateItem[]; total: number }>(
      '/governance/sedimentation/candidates',
    );
  },

  /** 审核候选 */
  async reviewCandidate(
    assetId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<{ accepted: boolean; reviewStatus: string }> {
    return httpClient.post<{ accepted: boolean; reviewStatus: string }>(
      `/governance/sedimentation/candidates/${assetId}/review`,
      { action, reason },
    );
  },

  /** 手动触发沉淀扫描 */
  async runSedimentation(sinceHours = 24): Promise<SedimentationRunResult> {
    return httpClient.post<SedimentationRunResult>(
      '/governance/sedimentation/run',
      { sinceHours },
    );
  },

  /** 获取沉淀配置 */
  async getConfig(): Promise<Record<string, unknown>> {
    return httpClient.get<Record<string, unknown>>('/governance/sedimentation/config');
  },

  /** 获取沉淀效果统计 */
  async getEffectStats(): Promise<SedimentationEffectStats> {
    return httpClient.get<SedimentationEffectStats>(
      '/governance/sedimentation/effect-stats',
    );
  },

  /** 获取口径冲突列表 */
  async getCalibrationConflicts(): Promise<CalibrationConflictItem[]> {
    return httpClient.get<CalibrationConflictItem[]>(
      '/governance/sedimentation/calibration-conflicts',
    );
  },

  /** 收敛口径冲突 */
  async resolveCalibrationConflict(
    conflictId: string,
    resolution: string,
  ): Promise<{ accepted: boolean; conflictId: string }> {
    return httpClient.post<{ accepted: boolean; conflictId: string }>(
      `/governance/sedimentation/calibration-conflicts/${conflictId}/resolve`,
      { resolution },
    );
  },
};
