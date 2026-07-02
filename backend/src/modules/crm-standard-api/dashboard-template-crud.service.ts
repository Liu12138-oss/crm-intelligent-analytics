/**
 * 看板模板自定义管理服务
 *
 * 提供自定义看板模板的增删改查能力。
 * 持久化到 .runtime/dashboard-templates-custom.json，
 * 与内置模板（dashboard-templates.ts 硬编码）分离，
 * 列表接口自动合并两者。
 *
 * 设计要点：
 * - 自定义模板 ID 前缀为 'custom_'，与内置模板 'tpl_' 区分
 * - 内置模板不可编辑/删除（只读）
 * - 自定义模板支持完整的生命周期管理
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type { DashboardTemplate, DashboardRewriteableField } from './dashboard-templates';
import type { DashboardProfile } from './dashboard-report-composer.service';
import type { DashboardAnalyticsQuery } from './dashboard-analytics.service';
import { buildEntityId } from '../../shared/utils/id.util';

export interface CustomDashboardTemplate extends DashboardTemplate {
  /** 创建者 ID */
  createdBy: string;
  /** 创建者名称 */
  createdByName: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

const VALID_PROFILES: DashboardProfile[] = [
  'channel-order-summary',
  'agent-development',
  'region-overview',
  'owner-performance',
];

const VALID_CATEGORIES: CustomDashboardTemplate['category'][] = [
  'channel',
  'agent',
  'region',
  'owner',
];

/** 每种 profile 的默认 rewriteableFields */
const PROFILE_DEFAULT_REWRITEABLE_FIELDS: Record<DashboardProfile, DashboardRewriteableField[]> = {
  'channel-order-summary': [
    { key: 'region', label: '区域', type: 'text', placeholder: '如：广州办' },
    {
      key: 'bigRegion',
      label: '大区',
      type: 'select',
      options: [
        { value: '', label: '全部大区' },
        { value: '大北区', label: '大北区' },
        { value: '大东区', label: '大东区' },
        { value: '大南区', label: '大南区' },
        { value: '大西区', label: '大西区' },
      ],
    },
    { key: 'limit', label: '返回条数', type: 'text', placeholder: '默认 50' },
  ],
  'agent-development': [
    {
      key: 'bigRegion',
      label: '大区',
      type: 'select',
      options: [
        { value: '', label: '全国' },
        { value: '大北区', label: '大北区' },
        { value: '大东区', label: '大东区' },
        { value: '大南区', label: '大南区' },
        { value: '大西区', label: '大西区' },
      ],
    },
    { key: 'limit', label: '返回条数', type: 'text', placeholder: '默认 50' },
  ],
  'region-overview': [],
  'owner-performance': [],
  auto: [],
};

@Injectable()
export class DashboardTemplateCrudService {
  private readonly logger = new Logger('DashboardTemplateCrud');
  private templates: CustomDashboardTemplate[] = [];
  private readonly storageFilePath: string;
  private readonly persistenceEnabled: boolean;

  constructor(private readonly localRuntimeConfigService: LocalRuntimeConfigService) {
    this.persistenceEnabled = process.env.NODE_ENV !== 'test';
    this.storageFilePath = join(
      this.localRuntimeConfigService.getRepoRoot(),
      '.runtime',
      'dashboard-templates-custom.json',
    );
    this.loadFromFile();
  }

  /**
   * 列出所有自定义模板
   */
  listAll(): CustomDashboardTemplate[] {
    return [...this.templates].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * 按 ID 查找自定义模板（仅自定义，不含内置）
   */
  findById(templateId: string): CustomDashboardTemplate | undefined {
    return this.templates.find((t) => t.templateId === templateId);
  }

  /**
   * 创建自定义模板
   */
  create(
    dto: CreateDashboardTemplateDto,
    actor: { id: string; name: string },
  ): CustomDashboardTemplate {
    const templateId = `custom_${buildEntityId('tpl').replace('tpl_', '').slice(0, 12)}`;
    const now = new Date().toISOString();

    // 计算排序号：当前最大 displayOrder + 1
    const maxOrder = this.templates.reduce(
      (max, t) => Math.max(max, t.displayOrder),
      0,
    );

    const newTemplate: CustomDashboardTemplate = {
      templateId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      profile: dto.profile,
      defaultQuery: (dto.defaultQuery ?? {}) as DashboardAnalyticsQuery,
      applicableRoles: dto.applicableRoles ?? [],
      rewriteableFields:
        dto.rewriteableFields ??
        (PROFILE_DEFAULT_REWRITEABLE_FIELDS[dto.profile] ?? []),
      category: dto.category ?? 'channel',
      displayOrder: dto.displayOrder ?? maxOrder + 1,
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: now,
      updatedAt: now,
    };

    this.validateTemplate(newTemplate);
    this.templates.push(newTemplate);
    this.persist();
    this.logger.log(`创建自定义看板模板: ${templateId} (${newTemplate.name}) by ${actor.name}`);
    return newTemplate;
  }

  /**
   * 更新自定义模板
   */
  update(
    templateId: string,
    dto: UpdateDashboardTemplateDto,
    actor: { id: string; name: string },
  ): CustomDashboardTemplate {
    const idx = this.templates.findIndex((t) => t.templateId === templateId);
    if (idx === -1) {
      throw new Error(`自定义模板 ${templateId} 不存在`);
    }

    const existing = this.templates[idx];
    const updated: CustomDashboardTemplate = {
      ...existing,
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description?.trim() ?? '' }),
      ...(dto.profile !== undefined && {
        profile: dto.profile,
        rewriteableFields:
          dto.rewriteableFields ??
          (PROFILE_DEFAULT_REWRITEABLE_FIELDS[dto.profile] ?? existing.rewriteableFields),
      }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      ...(dto.applicableRoles !== undefined && { applicableRoles: dto.applicableRoles }),
      ...(dto.rewriteableFields !== undefined && { rewriteableFields: dto.rewriteableFields }),
      updatedAt: new Date().toISOString(),
    };

    this.validateTemplate(updated);
    this.templates[idx] = updated;
    this.persist();
    this.logger.log(`更新自定义看板模板: ${templateId} by ${actor.name}`);
    return updated;
  }

  /**
   * 删除自定义模板
   */
  delete(templateId: string, actor: { id: string; name: string }): void {
    const idx = this.templates.findIndex((t) => t.templateId === templateId);
    if (idx === -1) {
      throw new Error(`自定义模板 ${templateId} 不存在`);
    }
    const removed = this.templates.splice(idx, 1)[0];
    this.persist();
    this.logger.log(`删除自定义看板模板: ${templateId} (${removed.name}) by ${actor.name}`);
  }

  /**
   * 获取可用于新建模板的 profile 选项清单
   */
  getProfileOptions(): Array<{
    value: DashboardProfile;
    label: string;
    description: string;
  }> {
    return [
      {
        value: 'channel-order-summary',
        label: '渠道下单汇总',
        description: '按渠道统计下单金额、数量、集中度和排名，含 KPI 指标卡 + 集中度分析 + 渠道排名表',
      },
      {
        value: 'agent-development',
        label: '代理商发展运营',
        description: '按大区/团队/合作级别统计签约额、商机数和省份覆盖，含 KPI + 分组柱状图 + 地图覆盖 + 团队明细表',
      },
      {
        value: 'region-overview',
        label: '区域经营概览',
        description: '按区域统计下单、商机、报价等经营指标，含 KPI + 区域排名表',
      },
      {
        value: 'owner-performance',
        label: '负责人业绩看板',
        description: '按负责人统计下单金额、数量、商机等业绩指标，含 KPI + 负责人排名表',
      },
    ];
  }

  /**
   * 获取指定 profile 的默认改写字段（供前端表单预填）
   */
  getDefaultRewriteableFields(profile: DashboardProfile): DashboardRewriteableField[] {
    return structuredClone(PROFILE_DEFAULT_REWRITEABLE_FIELDS[profile] ?? []);
  }

  private validateTemplate(t: CustomDashboardTemplate): void {
    if (!t.name || t.name.length < 2) {
      throw new Error('模板名称至少需要 2 个字符');
    }
    if (!VALID_PROFILES.includes(t.profile)) {
      throw new Error(`无效的看板类型: ${t.profile}`);
    }
    if (!VALID_CATEGORIES.includes(t.category)) {
      throw new Error(`无效的分类: ${t.category}`);
    }
  }

  private loadFromFile(): void {
    if (!this.persistenceEnabled || !existsSync(this.storageFilePath)) {
      this.templates = [];
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(this.storageFilePath, 'utf8'));
      this.templates = Array.isArray(raw) ? raw : [];
      this.logger.debug(`从文件加载 ${this.templates.length} 个自定义模板`);
    } catch (error) {
      this.logger.warn('读取自定义模板文件失败，使用空列表', error instanceof Error ? error.message : String(error));
      this.templates = [];
    }
  }

  private persist(): void {
    if (!this.persistenceEnabled) return;

    try {
      mkdirSync(dirname(this.storageFilePath), { recursive: true });
      const tmpPath = `${this.storageFilePath}.tmp`;
      writeFileSync(tmpPath, JSON.stringify(this.templates, null, 2), 'utf8');
      renameSync(tmpPath, this.storageFilePath);
    } catch (error) {
      this.logger.error('持久化自定义模板失败', error instanceof Error ? error.message : String(error));
    }
  }
}

// ─── DTO 类型定义 ───

export interface CreateDashboardTemplateDto {
  name: string;
  description?: string;
  profile: DashboardProfile;
  category?: CustomDashboardTemplate['category'];
  defaultQuery?: Partial<DashboardAnalyticsQuery>;
  applicableRoles?: string[];
  rewriteableFields?: DashboardRewriteableField[];
  displayOrder?: number;
}

export interface UpdateDashboardTemplateDto {
  name?: string;
  description?: string;
  profile?: DashboardProfile;
  category?: CustomDashboardTemplate['category'];
  defaultQuery?: Partial<DashboardAnalyticsQuery>;
  applicableRoles?: string[];
  rewriteableFields?: DashboardRewriteableField[];
  displayOrder?: number;
}
