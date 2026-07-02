import { ContractReviewFactExtractorService } from '../src/modules/contract-review/contract-review-fact-extractor.service';
import type { ContractReviewDocumentSnapshot } from '../src/modules/contract-review/contract-review.types';

describe('ContractReviewFactExtractorService', () => {
  const service = new ContractReviewFactExtractorService();

  const buildSnapshot = (title: string, lines: string[]): ContractReviewDocumentSnapshot => {
    const fragments = lines.map((text, index) => ({
      index: index + 1,
      text,
      locator: `正文段落${index + 1}`,
      source: 'document' as const,
    }));

    return {
      title,
      summary: '测试快照',
      fullText: lines.join('\n'),
      paragraphs: fragments,
      headings: fragments.filter((fragment) =>
        ['交货', '知识产权和保密', '争议和仲裁'].includes(fragment.text),
      ),
      clauses: fragments.filter((fragment) =>
        /合同总价|付款方式|深圳仲裁委员会仲裁|廉洁诚信合作协议/.test(fragment.text),
      ),
    };
  };

  const findSlot = (
    snapshot: ReturnType<ContractReviewFactExtractorService['extract']>,
    slotCode: string,
  ) => snapshot.templateSlotFacts.find((fact) => fact.slotCode === slotCode);

  it('应识别购销合同标准模板中的占位槽位与未收敛付款分支', () => {
    const snapshot = buildSnapshot('联软科技购销合同', [
      '合同编号：',
      'LS年月日-邮箱地址-区号-合同编号',
      '最终用户：',
      '(法定注册全称）',
      '甲方：',
      '地址：',
      '联系人：',
      '联系电话：',
      '乙方：深圳市联软科技股份有限公司',
      '甲方',
      '单位全称：',
      '纳税人识别号：',
      '开户银行：',
      '银行账号：',
      '法定代表人：',
      '本合同总价为人民币     元整（￥    .00）。',
      '付款方式（二选一）：',
      '自合同签订之日起 7 个工作日之内，甲方向乙方一次性支付100%合同总价，即人民币      元整（￥    .00）。',
      '甲方自合同签订之日起7 个工作日之内，甲方向乙方支付合同总价的 50 %，即人民币      元整（￥    .00）；甲方收到合同货物后在5个工作日内支付乙方合同总价的 50 %作为到货款。',
      '交货',
      '凡因本合同引起的或与本合同有关的任何争议，双方应协商解决，协商不能解决时，均应提交深圳仲裁委员会仲裁。',
      '附件三：廉洁诚信合作协议',
    ]);

    const result = service.extract(snapshot);

    expect(result.templateMatchFacts).toEqual([
      expect.objectContaining({
        templateCode: 'sales-purchase-standard-v2025',
        score: expect.any(Number),
      }),
    ]);
    expect(findSlot(result, 'sales-contract-number')).toEqual(
      expect.objectContaining({
        status: 'PLACEHOLDER',
        value: 'LS年月日-邮箱地址-区号-合同编号',
      }),
    );
    expect(findSlot(result, 'sales-final-customer')).toEqual(
      expect.objectContaining({
        status: 'PLACEHOLDER',
        value: '(法定注册全称）',
      }),
    );
    expect(findSlot(result, 'sales-total-amount')).toEqual(
      expect.objectContaining({
        status: 'PLACEHOLDER',
      }),
    );
    expect(findSlot(result, 'sales-payment-option')).toEqual(
      expect.objectContaining({
        status: 'AMBIGUOUS',
        value: '一次性付款 / 两段付款',
      }),
    );
    expect(findSlot(result, 'sales-arbitration-clause')).toEqual(
      expect.objectContaining({
        status: 'PRESENT',
      }),
    );
    expect(findSlot(result, 'sales-integrity-attachment')).toEqual(
      expect.objectContaining({
        status: 'PRESENT',
      }),
    );
    expect(result.summary).toContain('模板命中 1 个');
    expect(result.summary).toContain('待收敛 1 项');
  });

  it('应稳定提取已填写的关键模板槽位', () => {
    const snapshot = buildSnapshot('联软科技购销合同', [
      '合同编号：LS20260410-sales-0755-001',
      '最终用户：深圳市示例科技有限公司',
      '甲方：深圳市示例代理有限公司',
      '地址：深圳市南山区科技南十二路 1 号',
      '联系人：张三',
      '联系电话：13800000000',
      '乙方：深圳市联软科技股份有限公司',
      '甲方',
      '单位全称：',
      '深圳市示例代理有限公司',
      '纳税人识别号：',
      '91440300TEST12345',
      '开户银行：',
      '招商银行深圳科技园支行',
      '银行账号：',
      '7555123412341234',
      '法定代表人：',
      '李四',
      '本合同总价为人民币 100000 元整（￥100000.00）。',
      '付款方式（二选一）：',
      '自合同签订之日起 7 个工作日之内，甲方向乙方一次性支付100%合同总价，即人民币 100000 元整（￥100000.00）。',
      '交货',
      '凡因本合同引起的或与本合同有关的任何争议，双方应协商解决，协商不能解决时，均应提交深圳仲裁委员会仲裁。',
      '附件三：廉洁诚信合作协议',
    ]);

    const result = service.extract(snapshot);

    expect(findSlot(result, 'sales-contract-number')).toEqual(
      expect.objectContaining({
        status: 'FILLED',
        value: 'LS20260410-sales-0755-001',
      }),
    );
    expect(findSlot(result, 'sales-final-customer')).toEqual(
      expect.objectContaining({
        status: 'FILLED',
        value: '深圳市示例科技有限公司',
      }),
    );
    expect(findSlot(result, 'sales-party-a-contact')).toEqual(
      expect.objectContaining({
        status: 'FILLED',
        value: '张三',
      }),
    );
    expect(findSlot(result, 'sales-party-a-tax-id')).toEqual(
      expect.objectContaining({
        status: 'FILLED',
        value: '91440300TEST12345',
      }),
    );
    expect(findSlot(result, 'sales-payment-option')).toEqual(
      expect.objectContaining({
        status: 'FILLED',
        value: '一次性付款',
      }),
    );
    expect(result.summary).toContain('已填');
  });
});
