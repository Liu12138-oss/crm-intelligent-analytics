/**
 * 看板服务
 *
 * 对接后端 /api/dashboard/* 接口
 * 提供看板模板列表、看板组装、按模板运行等能力
 */

import { httpClient } from './http-client';

/**
 * 看板模板（前端展示用）
 */
export interface DashboardTemplateItem {
  templateId: string;
  name: string;
  description: string;
  profile: string;
  defaultQuery: Record<string, unknown>;
  applicableRoles: string[];
  rewriteableFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'select';
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
  }>;
  category: string;
  displayOrder: number;
}

/**
 * 看板 block（前端渲染用，与 management-report.ts 对齐）
 */
export interface DashboardBlock {
  blockId: string;
  blockType: string;
  title: string;
  [key: string]: unknown;
}

/**
 * 看板组装结果
 */
export interface DashboardComposeResult {
  blocks: DashboardBlock[];
  reportTitle: string;
  executiveSummary: string;
  dataSource: string;
  fetchedAt: string;
  scopeSummary: string;
  errors: string[];
  requestedBy?: string;
  requestedByName?: string;
  templateId?: string;
  templateName?: string;
}

export const dashboardService = {
  /**
   * 获取看板模板列表（内置 + 自定义合并）
   */
  getTemplates(): Promise<{ code: number; data: DashboardTemplateItem[] }> {
    return httpClient.get('/dashboard/templates');
  },

  /**
   * 获取可用看板类型选项（供新建/编辑表单下拉使用）
   */
  getProfileOptions(): Promise<{
    code: number;
    data: Array<{ value: string; label: string; description: string }>;
  }> {
    return httpClient.get('/dashboard/templates/profile-options');
  },

  /**
   * 创建自定义看板模板
   */
  createTemplate(dto: {
    name: string;
    description?: string;
    profile: string;
    category?: string;
    displayOrder?: number;
    rewriteableFields?: Array<DashboardTemplateItem['rewriteableFields'][number]>;
  }): Promise<{ code: number; message: string; data: DashboardTemplateItem | null }> {
    return httpClient.post('/dashboard/templates', dto);
  },

  /**
   * 更新自定义看板模板
   */
  updateTemplate(
    templateId: string,
    dto: {
      name?: string;
      description?: string;
      profile?: string;
      category?: string;
      displayOrder?: number;
      rewriteableFields?: Array<DashboardTemplateItem['rewriteableFields'][number]>;
    },
  ): Promise<{ code: number; message: string; data: DashboardTemplateItem | null }> {
    return httpClient.put(`/dashboard/templates/${templateId}`, dto);
  },

  /**
   * 删除自定义看板模板
   */
  deleteTemplate(templateId: string): Promise<{ code: number; message: string }> {
    return httpClient.delete(`/dashboard/templates/${templateId}`);
  },

  /**
   * 直接组装看板
   */
  compose(params: {
    profile: string;
    query?: Record<string, unknown>;
    questionText?: string;
  }): Promise<{ code: number; data: DashboardComposeResult }> {
    return httpClient.post('/dashboard/compose', params);
  },

  /**
   * 按模板运行看板（支持条件改写）
   */
  runTemplate(
    templateId: string,
    params: {
      overrides?: Record<string, unknown>;
      questionText?: string;
    },
  ): Promise<{ code: number; data: DashboardComposeResult }> {
    return httpClient.post(`/dashboard/templates/${templateId}/run`, params);
  },
};
