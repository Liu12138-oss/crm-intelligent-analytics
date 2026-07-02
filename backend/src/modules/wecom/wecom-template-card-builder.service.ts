/**
 * 企微模板卡片构建器（补问选择 + 口径收敛投票 + 卡片更新）
 *
 * 第 3 期新增的 3 种模板卡片能力：
 * 1. button_interaction：补问场景，用户点选替代文字输入
 * 2. vote_interaction：口径收敛投票，收集相关角色的意见
 * 3. update_template_card：按钮点击后卡片更新
 *
 * 参考企微开发者文档 path/101032 模板卡片类型
 */

import { Injectable } from '@nestjs/common';

/**
 * 补问选项
 */
export interface ClarificationOption {
  /** 选项 ID（点击回调时返回） */
  optionId: string;
  /** 选项展示文案 */
  label: string;
}

/**
 * 补问卡片构建参数
 */
export interface ClarificationCardParams {
  /** 任务 ID（企微要求唯一，用 queryId + 时间戳生成） */
  taskId: string;
  /** 卡片标题 */
  title: string;
  /** 补问说明 */
  description: string;
  /** 选项列表（最多 6 个） */
  options: ClarificationOption[];
  /** 关联的 queryId（用于 feedback.id） */
  queryId: string;
}

/**
 * 口径收敛投票选项
 */
export interface CalibrationVoteOption {
  optionId: string;
  label: string;
}

/**
 * 口径收敛投票卡片参数
 */
export interface CalibrationVoteCardParams {
  taskId: string;
  title: string;
  description: string;
  /** 投票选项（最多 20 个） */
  options: CalibrationVoteOption[];
  /** 是否允许多选 */
  multiSelect?: boolean;
  queryId: string;
}

@Injectable()
export class WecomTemplateCardBuilder {
  /**
   * 构建 button_interaction 补问选择卡片
   *
   * 用于 AI 识别到歧义需要补问时，用按钮让用户直接点选，
   * 替代纯文字补问，降低用户输入成本。
   *
   * 约束：button_list 最多 6 个，超过改用文字补问
   */
  buildClarificationCard(params: ClarificationCardParams): Record<string, unknown> {
    const buttonList = params.options.slice(0, 6).map((opt) => ({
      text: opt.label,
      style: 1,
      key: opt.optionId,
    }));

    return {
      card_type: 'button_interaction',
      main_title: {
        title: params.title,
        desc: '需要补充信息',
      },
      subtitle: {
        text: params.description,
      },
      button_list: buttonList,
      task_id: params.taskId,
      feedback: {
        id: params.queryId,
      },
    };
  }

  /**
   * 构建 vote_interaction 口径收敛投票卡片
   *
   * 用于学习闭环检测到口径冲突时，向相关角色发起投票。
   * 投票结果作为管理员裁定参考。
   *
   * 约束：checkbox 选项最多 20 个
   */
  buildCalibrationVoteCard(params: CalibrationVoteCardParams): Record<string, unknown> {
    const optionList = params.options.slice(0, 20).map((opt) => ({
      id: opt.optionId,
      text: opt.label,
    }));

    return {
      card_type: 'vote_interaction',
      main_title: {
        title: params.title,
        desc: '口径收敛投票',
      },
      subtitle: {
        text: params.description,
      },
      checkbox: {
        option_list: optionList,
        disable: false,
      },
      task_id: params.taskId,
      feedback: {
        id: params.queryId,
      },
    };
  }

  /**
   * 构建卡片更新请求
   *
   * 用户点击 button_interaction 按钮后，
   * 用 update_template_card 把卡片更新为"已选择：XXX，正在查询..."
   *
   * 参数说明：
   * - `taskId` 原卡片的 task_id
   * - `selectedText` 用户选择的选项文案
   */
  buildCardUpdateParams(taskId: string, selectedText: string): Record<string, unknown> {
    return {
      card_type: 'text_notice',
      main_title: {
        title: '已选择',
        desc: `已选择：${selectedText}`,
      },
      emphasis_content: {
        title: '正在查询',
        desc: '请稍候，正在根据您的选择查询数据...',
      },
      task_id: taskId,
    };
  }

  /**
   * 生成唯一的 task_id
   * 企微要求 task_id 不可重复，用 queryId + 时间戳生成
   */
  generateTaskId(queryId: string): string {
    return `${queryId}_${Date.now()}`;
  }

  /**
   * 从企微按钮点击回调解析用户选择
   */
  static parseButtonCallback(frame: Record<string, unknown>): {
    taskId?: string;
    selectedKey?: string;
    selectedText?: string;
    queryId?: string;
  } {
    const data = (frame.data ?? frame.event ?? frame) as Record<string, unknown>;
    const taskid = String(data.taskid ?? data.task_id ?? data.taskId ?? '');
    const selectedKey = String(data.selectedKey ?? data.selected_key ?? data.key ?? '');
    const selectedText = String(data.selectedText ?? data.selected_text ?? data.text ?? '');
    const queryId = String(data.feedbackId ?? data.feedback_id ?? data.feedbackid ?? '');

    return {
      taskId: taskid || undefined,
      selectedKey: selectedKey || undefined,
      selectedText: selectedText || undefined,
      queryId: queryId || undefined,
    };
  }

  /**
   * 从企微投票回调解析投票结果
   */
  static parseVoteCallback(frame: Record<string, unknown>): {
    taskId?: string;
    selectedOptionIds?: string[];
    queryId?: string;
  } {
    const data = (frame.data ?? frame.event ?? frame) as Record<string, unknown>;
    const taskid = String(data.taskid ?? data.task_id ?? data.taskId ?? '');
    const queryId = String(data.feedbackId ?? data.feedback_id ?? data.feedbackid ?? '');

    // 投票结果可能是数组或单个值
    const rawSelected = data.selectedOptions ?? data.selected_options ?? data.optionKeys ?? data.option_keys;
    const selectedOptionIds = Array.isArray(rawSelected)
      ? rawSelected.map((v) => String(v))
      : rawSelected
        ? [String(rawSelected)]
        : [];

    return {
      taskId: taskid || undefined,
      selectedOptionIds: selectedOptionIds.length > 0 ? selectedOptionIds : undefined,
      queryId: queryId || undefined,
    };
  }
}
