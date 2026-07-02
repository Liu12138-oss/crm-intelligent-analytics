import { Injectable } from '@nestjs/common';
import type { AnalysisResultRecord, StreamBlock } from '../../shared/types/domain';

@Injectable()
export class ResultStreamerService {
  buildBlocks(
    result: AnalysisResultRecord,
    context?: {
      normalizedQuestion?: string;
      validationSummary?: string[];
      scopeSummary?: string;
      taskTitles?: string[];
      datasetCount?: number;
    },
  ): StreamBlock[] {
    const blocks: StreamBlock[] = [
      {
        sequence: 0,
        blockType: 'PROCESSING_NOTICE',
        content: `已识别问题：${context?.normalizedQuestion ?? result.title}`,
      },
    ];

    if (context?.scopeSummary) {
      blocks.push({
        sequence: blocks.length,
        blockType: 'EXPLANATION',
        content: `已注入权限范围：${context.scopeSummary}`,
      });
    }

    if (context?.taskTitles?.length) {
      blocks.push({
        sequence: blocks.length,
        blockType: 'PLANNING',
        content: `已规划 ${context.taskTitles.length} 个查询任务：${context.taskTitles.join('、')}`,
      });
    }

    if (context?.datasetCount) {
      blocks.push({
        sequence: blocks.length,
        blockType: 'EXECUTION',
        content: `已完成 ${context.datasetCount} 组受控数据集整理，准备生成分析报告。`,
      });
    }

    for (const validationMessage of context?.validationSummary ?? []) {
      blocks.push({
        sequence: blocks.length,
        blockType: 'VALIDATION',
        content: validationMessage,
      });
    }

    blocks.push({
      sequence: blocks.length,
      blockType: 'SUMMARY',
      content: result.summary ?? result.title,
    });

    if (result.metricCards.length > 0) {
      const metricContent = result.metricCards
        .slice(0, 4)
        .map((item) => `${item.name}：${item.value}`)
        .join('；');

      blocks.push({
        sequence: blocks.length,
        blockType: 'REPORT',
        content: `关键指标：${metricContent}`,
      });
    }

    if (result.groundedExplanation) {
      blocks.push({
        sequence: blocks.length,
        blockType: 'EXPLANATION',
        content: result.groundedExplanation,
      });
    } else if (result.explanation) {
      blocks.push({
        sequence: blocks.length,
        blockType: 'EXPLANATION',
        content: result.explanation,
      });
    }

    if (result.tableRows.length > 0) {
      const previewRows = result.tableRows.slice(0, 3);
      const previewText = previewRows
        .map((item) => {
          const label = String(item.ownerName ?? item.bucket_label ?? item.category ?? '未命名分组');
          const value = item.amount ?? item.count ?? '--';
          return `${label}：${value}`;
        })
        .join('；');

      blocks.push({
        sequence: blocks.length,
        blockType: 'TABLE_SEGMENT',
        content: `结果预览：${previewText}`,
      });
    }

    blocks.push({
      sequence: blocks.length,
      blockType: 'COMPLETE',
      content: '结果已完成整理，并通过任务级只读、权限和一致性校验。',
    });

    return blocks;
  }
}
