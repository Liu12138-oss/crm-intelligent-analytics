import { Injectable } from '@nestjs/common';

@Injectable()
export class ClarificationService {
  buildPrompt(missingConditions: string[]): string {
    if (missingConditions.length === 0) {
      return '';
    }

    return `当前问题还缺少${missingConditions.join('、')}，请先补充后我再继续分析。`;
  }

  mergeClarificationQuestion(baseQuestion: string | undefined, answer: string): string {
    return [baseQuestion, `补充说明：${answer}`].filter(Boolean).join('；');
  }

  mergeFollowUpQuestion(baseQuestion: string | undefined, followUp: string): string {
    return [baseQuestion, `继续分析：${followUp}`].filter(Boolean).join('；');
  }
}
