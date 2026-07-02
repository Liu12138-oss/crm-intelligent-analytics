import { BadRequestException, Injectable } from '@nestjs/common';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { extractReferencedTables } from './query-template-sql.runtime';

@Injectable()
export class QueryTemplateSqlGuardService {
  private readonly blockedKeywordPattern =
    /\b(insert|update|delete|drop|truncate|alter|create|replace|grant|revoke)\b/iu;

  constructor(
    private readonly accessPolicyRepository: AccessPolicyRepository,
  ) {}

  validateReadonlyTemplateSql(sqlText: string): void {
    const normalizedSql = sqlText.trim();
    if (!normalizedSql) {
      throw new BadRequestException('模板 SQL 不能为空。');
    }

    if (normalizedSql.includes(';')) {
      throw new BadRequestException('模板 SQL 仅允许单条查询语句。');
    }

    const statementSql = this.stripLeadingSqlComments(normalizedSql);
    const lowered = statementSql.toLowerCase();
    if (!lowered.startsWith('select') && !lowered.startsWith('with')) {
      throw new BadRequestException('模板 SQL 只允许查询 SQL。');
    }

    if (this.blockedKeywordPattern.test(normalizedSql)) {
      throw new BadRequestException('模板 SQL 只允许查询 SQL。');
    }

    const policy = this.accessPolicyRepository.getCurrent();
    const referencedTables = extractReferencedTables(normalizedSql);
    for (const tableName of referencedTables) {
      if (!policy.allowedTables.includes(tableName)) {
        throw new BadRequestException(
          '当前模板 SQL 暂时不能直接执行，因为它超出了系统允许的分析范围。请调整模板内容，或联系管理员确认可用的数据范围后再试。',
        );
      }
    }
  }

  /**
   * 自由问数会在可复现 SQL 前追加任务标题注释，保存为模板时只应忽略这类前置说明来判断首个语句类型。
   * 参数：已完成首尾空白归一的模板 SQL。
   * 返回：剥离前置行注释或块注释后的 SQL 主体；后续风险词和白名单校验仍使用原文，避免注释规避审计边界。
   */
  private stripLeadingSqlComments(sqlText: string): string {
    let remainingSql = sqlText.trimStart();

    while (remainingSql.startsWith('--') || remainingSql.startsWith('/*')) {
      if (remainingSql.startsWith('--')) {
        const lineBreakIndex = remainingSql.search(/\r?\n/u);
        if (lineBreakIndex === -1) {
          return '';
        }
        remainingSql = remainingSql.slice(lineBreakIndex).trimStart();
        continue;
      }

      const commentEndIndex = remainingSql.indexOf('*/');
      if (commentEndIndex === -1) {
        return '';
      }
      remainingSql = remainingSql.slice(commentEndIndex + 2).trimStart();
    }

    return remainingSql;
  }
}
