/**
 * 企微看板卡片构建器
 *
 * 构建企微模板卡片，用于看板在企微会话中的展示。
 * 采用 stream_with_template_card 三段式：
 * 1. 流式阶段：stream 输出分析进度和关键结论文字
 * 2. 卡片阶段：优先用 news_notice 模板卡片展示图表图片 + KPI 摘要 + 跳转链接
 * 3. 备查链接：卡片 jump_list 指向只读报告页，作为企微内结果的补充备查
 *
 * 参考企微开发者文档 path/101032 模板卡片类型
 */

import { Injectable } from '@nestjs/common';

/**
 * 看板卡片 KPI 摘要项
 */
export interface DashboardCardKpiItem {
  label: string;
  value: string;
}

/**
 * 看板卡片构建参数
 */
export interface DashboardCardParams {
  /** 查询 ID，用于 feedback.id 和 Web 跳转链接 */
  queryId: string;
  /** 看板标题 */
  title: string;
  /** KPI 摘要项（最多 6 项，对应 horizontal_content_list） */
  kpiItems: DashboardCardKpiItem[];
  /** 关键发现摘要（emphasis_content 的 secondary_text） */
  summary: string;
  /** 只读备查报告 URL（jump_list 跳转地址） */
  webDashboardUrl: string;
  /** 数据来源标记（实时/快照） */
  dataSourceLabel?: string;
  /** 来源标识，展示在卡片顶部 */
  sourceDesc?: string;
  /** 卡片引用区标题，用于展示关键对比或图表摘要 */
  quoteTitle?: string;
  /** 卡片引用区正文，用于让企微首屏直接看到分析判断 */
  quoteText?: string;
  /** 企微可访问的图表图片地址；有值时使用 news_notice 图文卡片 */
  imageUrl?: string;
  /** 图文卡片中的图表说明标题 */
  imageTitle?: string;
  /** 图文卡片中的图表说明正文 */
  imageDesc?: string;
  /** 图表图片宽高比，企微要求大于 1.3 且小于 2.25 */
  imageAspectRatio?: number;
}

/**
 * 看板流式进度文案片段
 */
export interface DashboardStreamChunk {
  content: string;
  finish: boolean;
}

@Injectable()
export class WecomDashboardCardBuilder {
  /**
   * 构建看板模板卡片。
   *
   * 参数说明：`params` 为看板卡片构建参数。
   * 返回值说明：返回企微 template_card 对象，可直接传给 sendTemplateCardMessage。
   * 有图表图片时返回 news_notice；无图片时回退 text_notice。
   * 调用注意事项：horizontal_content_list 最多 6 行，jump_list 最多 3 个。
   */
  buildDashboardCard(params: DashboardCardParams): Record<string, unknown> {
    // 设计要求卡片突出一个主指标，其余指标放入横向列表，避免把卡片做成长篇报告。
    const primaryKpi = params.kpiItems[0];
    const secondaryKpis = primaryKpi ? params.kpiItems.slice(1) : params.kpiItems;

    // KPI 摘要最多 6 项；企微模板卡片要求字段名为 keyname。
    const cardKpis = params.imageUrl ? params.kpiItems : secondaryKpis;
    const horizontalContentList = cardKpis.slice(0, 6).map((item) => ({
      keyname: this.truncateCardText(item.label, 5),
      value: this.truncateCardText(item.value, 26),
    }));

    // jump_list 最多 3 个；长连接不能直接承载 HTML，链接只作为备查入口。
    const jumpList = [
      {
        type: 1,
        title: '打开备查报告',
        url: params.webDashboardUrl,
      },
    ];

    if (params.imageUrl) {
      return {
        card_type: 'news_notice',
        source: {
          desc: this.truncateCardText(params.sourceDesc ?? 'CRM智能助手', 13),
          desc_color: 0,
        },
        main_title: {
          title: this.truncateCardText(params.title, 26),
          desc: this.truncateCardText(params.dataSourceLabel ?? '实时数据', 30),
        },
        card_image: {
          url: params.imageUrl,
          aspect_ratio: this.resolveCardImageAspectRatio(params.imageAspectRatio),
        },
        image_text_area: {
          type: 1,
          url: params.webDashboardUrl,
          title: this.truncateCardText(params.imageTitle ?? '图表看板', 13),
          desc: this.truncateCardText(params.imageDesc ?? params.summary, 30),
          image_url: params.imageUrl,
        },
        quote_area: params.quoteText
          ? {
              type: 0,
              title: this.truncateCardText(params.quoteTitle ?? '关键判断', 13),
              quote_text: this.truncateCardText(params.quoteText, 80),
            }
          : undefined,
        vertical_content_list: [
          {
            title: this.truncateCardText('核心摘要', 26),
            desc: this.truncateCardText(params.summary, 112),
          },
        ],
        horizontal_content_list: horizontalContentList,
        jump_list: jumpList,
        card_action: {
          type: 1,
          url: params.webDashboardUrl,
        },
        feedback: {
          id: params.queryId,
        },
      };
    }

    return {
      card_type: 'text_notice',
      source: {
        desc: this.truncateCardText(params.sourceDesc ?? 'CRM智能助手', 20),
        desc_color: 0,
      },
      main_title: {
        title: this.truncateCardText(params.title, 26),
        desc: this.truncateCardText(params.dataSourceLabel ?? '实时数据', 30),
      },
      emphasis_content: {
        title: this.truncateCardText(primaryKpi?.value ?? '分析完成', 10),
        desc: this.truncateCardText(
          primaryKpi ? `${primaryKpi.label}，当前主判断口径` : '已生成经营看板',
          15,
        ),
      },
      quote_area: params.quoteText
        ? {
            type: 0,
            title: this.truncateCardText(params.quoteTitle ?? '关键对比', 13),
            quote_text: this.truncateCardText(params.quoteText, 80),
          }
        : undefined,
      sub_title_text: this.truncateCardText(params.summary, 112),
      horizontal_content_list: horizontalContentList,
      jump_list: jumpList,
      card_action: {
        type: 1,
        url: params.webDashboardUrl,
      },
      // 设置 feedback，触发企微原生反馈入口
      // 用户点"准确/不准确"后会触发 feedback_event 回调
      feedback: {
        id: params.queryId,
      },
    };
  }

  /**
   * 裁剪企微卡片文案。
   *
   * 参数说明：`value` 为原始文案，`maxLength` 为最大展示字符数。
   * 返回值说明：返回去除换行和多余空白后的短文案，超长时补省略号。
   * 调用注意事项：模板卡片字段过长会被客户端截断，提前裁剪可保持首屏稳定。
   */
  private truncateCardText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/gu, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  /**
   * 规整企微图文卡片图片宽高比。
   *
   * 参数说明：`value` 为图片真实宽高比。
   * 返回值说明：返回企微允许范围内的宽高比。
   */
  private resolveCardImageAspectRatio(value?: number): number {
    if (!value || !Number.isFinite(value)) {
      return 1.78;
    }

    return Number(Math.min(2.24, Math.max(1.31, value)).toFixed(2));
  }

  /**
   * 构建流式进度文案片段
   *
   * 在看板分析过程中，分阶段输出进度文字：
   * - 阶段1：正在查询数据
   * - 阶段2：已获取 N 条数据
   * - 阶段3：正在生成图表
   * - 阶段4（finish）：关键发现 + 引导用户查看卡片
   */
  buildStreamChunks(progress: {
    totalPartners?: number;
    totalAmount?: number;
    keyFindings?: string[];
    dataSource?: string;
  }): DashboardStreamChunk[] {
    const chunks: DashboardStreamChunk[] = [];

    // 阶段1：开始查询
    chunks.push({
      content: '正在查询联软 CRM 统计数据...',
      finish: false,
    });

    // 阶段2：数据获取完成
    if (progress.totalPartners !== undefined) {
      const dataLabel = progress.dataSource === 'OPENAPI_REALTIME' ? '实时' : '同步';
      chunks.push({
        content: `已获取 ${progress.totalPartners} 家渠道的 ${dataLabel}数据`,
        finish: false,
      });
    }

    // 阶段3：生成图表
    chunks.push({
      content: '正在生成看板图表...',
      finish: false,
    });

    // 阶段4：完成，输出关键发现
    const findings = progress.keyFindings ?? [];
    if (findings.length > 0) {
      const findingsText = findings.slice(0, 3).map((f, i) => `${i + 1}. ${f}`).join('\n');
      chunks.push({
        content: `分析完成，关键发现：\n${findingsText}\n\n企微内已返回卡片、正文和图片看板，报告链接仅作为备查。`,
        finish: true,
      });
    } else {
      chunks.push({
        content: '分析完成，企微内已返回卡片、正文和图片看板，报告链接仅作为备查。',
        finish: true,
      });
    }

    return chunks;
  }

  /**
   * 构建超时兜底卡片
   *
   * 当分析任务超过 5 分 30 秒仍未完成时，
   * 用此卡片告知用户任务仍在后台执行。
   */
  buildTimeoutCard(params: {
    queryId: string;
    title: string;
    webDashboardUrl: string;
  }): Record<string, unknown> {
    return {
      card_type: 'text_notice',
      main_title: {
        title: params.title,
        desc: '任务后台执行中',
      },
      emphasis_content: {
        title: '处理中',
        desc: '分析任务仍在后台执行，完成后会主动推送结果',
      },
      horizontal_content_list: [
        { keyname: '状态', value: '后台执行中' },
        { keyname: '预计完成', value: '1-3 分钟内推送' },
      ],
      jump_list: [
        {
          type: 1,
          title: '稍后打开备查报告',
          url: params.webDashboardUrl,
        },
      ],
      card_action: {
        type: 1,
        url: params.webDashboardUrl,
      },
      feedback: {
        id: params.queryId,
      },
    };
  }
}
