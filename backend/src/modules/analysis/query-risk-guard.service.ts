import { Injectable } from '@nestjs/common';
import { SqlValidationError, UnsupportedQuestionError, WriteIntentBlockedError } from './analysis.errors';
import { resolveCrmAnalysisQuestionTemplateRuleByText } from './crm-analysis-question-template.registry';

@Injectable()
export class QueryRiskGuardService {
  /**
   * 校验自然语言问题是否包含明显越界或写入风险。
   *
   * 参数说明：`questionText` 为用户提交的原始或规范化问题。
   * 返回值说明：安全时无返回；命中风险时抛出对应业务错误。
   * 可能抛出的异常：写入意图、域外问题或后续 SQL 风险错误。
   * 调用注意事项：这是执行前硬护栏，只允许明确只读的客户生命周期问法绕开“创建”字面误伤。
   */
  ensureQuestionSafe(questionText: string): void {
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    const blockedKeywords = ['创建', '删除', '修改', '新增客户', '新增渠道商', '提醒我', '改成已成交', '写入'];
    if (
      blockedKeywords.some((item) => questionText.includes(item)) &&
      !this.isReadOnlyCustomerLifecycleQuestion(questionText) &&
      !this.isReadOnlyNewCustomerRegistrationQuestion(questionText) &&
      !this.isReadOnlyPartnerLifecycleQuestion(questionText) &&
      !catalogRule
    ) {
      throw new WriteIntentBlockedError();
    }

    const outOfScopeKeywords = ['天气', '股票', '基金', '新闻', '电影', '翻译', '代码'];
    if (outOfScopeKeywords.some((item) => questionText.includes(item))) {
      throw new UnsupportedQuestionError();
    }
  }

  /**
   * 判断“创建”是否表达客户创建时长统计，而不是创建客户动作。
   *
   * 参数说明：`questionText` 为用户问题。
   * 返回值说明：命中未报备、未建商机、创建多久等客户生命周期分析时返回 `true`。
   * 调用注意事项：仅用于自然语言风险护栏的误伤豁免，不能用于放行 SQL 或写入流程。
   */
  private isReadOnlyCustomerLifecycleQuestion(questionText: string): boolean {
    return /(客户).*((没有|未|无).{0,8}(报备|商机|报价|下单|订单)|未报备商机|未建商机|无商机|创建.{0,10}(多久|多长时间|时长|天数)|生命周期|沉睡)/u.test(
      questionText,
    );
  }

  /**
   * 判断“新增客户报备”是否表达只读统计，而不是创建客户动作。
   *
   * 参数说明：`questionText` 为用户问题。
   * 返回值说明：命中新增客户报备数量、趋势、转化或对比分析时返回 `true`。
   * 调用注意事项：仅豁免“新增客户报备”这一业务名词，不能放行“新增客户资料”等写入请求。
   */
  private isReadOnlyNewCustomerRegistrationQuestion(questionText: string): boolean {
    return /新增客户报备/u.test(questionText) &&
      /(趋势|数量|总量|金额|转化|转化率|增长|对比|同步|断层|分析|统计|多少|分别)/u.test(questionText);
  }

  /**
   * 判断渠道商创建到首次业务动作是否为只读生命周期统计。
   *
   * 参数说明：`questionText` 为用户问题。
   * 返回值说明：命中新增渠道商首次报备、商机、报价、订单时长统计时返回 `true`。
   * 调用注意事项：只放行“平均多久、需要多久”等统计问法，不放行新建渠道商动作。
   */
  private isReadOnlyPartnerLifecycleQuestion(questionText: string): boolean {
    return /(渠道商|服务商|合作伙伴)/u.test(questionText) &&
      /(创建|新增)/u.test(questionText) &&
      /(首次|第一笔|第一次|平均|多久|多长时间|时长)/u.test(questionText) &&
      /(报备|商机|报价|订单|下单)/u.test(questionText);
  }

  /**
   * 校验生成 SQL 是否只包含允许的只读查询能力。
   *
   * 参数说明：`sql` 为准备执行或展示的 SQL 文本。
   * 返回值说明：安全时无返回；命中风险时抛出 `SqlValidationError`。
   * 可能抛出的异常：写入语句、schema 探测、外部调用等 SQL 风险。
   * 调用注意事项：该校验不理解业务语义，只处理 SQL 层安全边界。
   */
  ensureQuerySafe(sql: string): void {
    const lowered = sql.toLowerCase();
    const blockedKeywords = ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate '];
    if (blockedKeywords.some((item) => lowered.includes(item))) {
      throw new SqlValidationError('当前查询存在高风险写入语句。');
    }

    const schemaProbeKeywords = [
      'information_schema',
      'show tables',
      'show columns',
      'describe ',
      'mysql.',
      'performance_schema',
    ];
    if (schemaProbeKeywords.some((item) => lowered.includes(item))) {
      throw new SqlValidationError('当前查询存在 schema 探测风险，已在执行前阻断。');
    }

    const externalCallKeywords = ['load_file', 'into outfile', 'into dumpfile', 'http://', 'https://'];
    if (externalCallKeywords.some((item) => lowered.includes(item))) {
      throw new SqlValidationError('当前查询存在未声明外部调用风险，已在执行前阻断。');
    }
  }
}
