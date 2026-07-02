import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ContractReviewDocumentFragment,
  ContractReviewDocumentSnapshot,
} from './contract-review.types';
import type {
  ContractReviewAmountFact,
  ContractReviewDiscountFact,
  ContractReviewFactExtractionResult,
  ContractReviewIntellectualPropertyFact,
  ContractReviewInvoiceFact,
  ContractReviewLicenseDeliveryFact,
  ContractReviewPaymentFact,
  ContractReviewPenaltyFact,
  ContractReviewTaxRateFact,
  ContractReviewTemplateMatchFact,
  ContractReviewTemplateSlotFact,
  ContractReviewTemplateSlotStatus,
} from './contract-review.runtime.types';

const SALES_TEMPLATE_CODE = 'sales-purchase-standard-v2025';
const SALES_TEMPLATE_LABEL = '联软购销合同标准模板（含廉洁协议）';

@Injectable()
export class ContractReviewFactExtractorService {
  extract(documentSnapshot: ContractReviewDocumentSnapshot): ContractReviewFactExtractionResult {
    const contractTypes = this.detectContractTypes(documentSnapshot);
    const templateMatchFacts = this.extractTemplateMatchFacts(documentSnapshot);
    const templateSlotFacts = this.extractTemplateSlotFacts(
      documentSnapshot,
      templateMatchFacts,
    );
    const amountFacts = this.extractAmountFacts(documentSnapshot);
    const taxRateFacts = this.extractTaxRateFacts(documentSnapshot);
    const paymentFacts = this.extractPaymentFacts(documentSnapshot);
    const discountFacts = this.extractDiscountFacts(documentSnapshot);
    const penaltyFacts = this.extractPenaltyFacts(documentSnapshot);
    const invoiceFacts = this.extractInvoiceFacts(documentSnapshot);
    const intellectualPropertyFacts = this.extractIntellectualPropertyFacts(documentSnapshot);
    const licenseDeliveryFacts = this.extractLicenseDeliveryFacts(documentSnapshot);

    const totalFactCount =
      templateMatchFacts.length +
      templateSlotFacts.length +
      amountFacts.length +
      taxRateFacts.length +
      paymentFacts.length +
      discountFacts.length +
      penaltyFacts.length +
      invoiceFacts.length +
      intellectualPropertyFacts.length +
      licenseDeliveryFacts.length;

    if (totalFactCount === 0) {
      throw new BadRequestException('未识别到合同关键事实，暂无法进入正式审核。');
    }

    return {
      extractedAt: new Date().toISOString(),
      contractTypes,
      amountFacts,
      taxRateFacts,
      paymentFacts,
      discountFacts,
      penaltyFacts,
      invoiceFacts,
      intellectualPropertyFacts,
      licenseDeliveryFacts,
      templateMatchFacts,
      templateSlotFacts,
      summary: this.buildSummary({
        contractTypes,
        amountFacts,
        taxRateFacts,
        paymentFacts,
        discountFacts,
        penaltyFacts,
        invoiceFacts,
        intellectualPropertyFacts,
        licenseDeliveryFacts,
        templateMatchFacts,
        templateSlotFacts,
      }),
    };
  }

  private detectContractTypes(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): string[] {
    const title = `${documentSnapshot.title}\n${documentSnapshot.fullText.slice(0, 1000)}`;
    const detected: string[] = [];

    if (/扩容/.test(title)) {
      detected.push('扩容合同');
    }

    if (/维保|运维|技术服务|服务合同|售后服务/.test(title)) {
      detected.push('服务合同');
    }

    if (/购销|采购|销售|产品合同/.test(title)) {
      detected.push('购销合同');
    }

    return detected.length > 0
      ? [...new Set(detected)]
      : ['购销合同', '服务合同', '扩容合同'];
  }

  private extractTemplateMatchFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewTemplateMatchFact[] {
    const normalizedFullText = this.normalizeTemplateValue(
      `${documentSnapshot.title}\n${documentSnapshot.fullText}`,
    );
    const signals: string[] = [];

    if (normalizedFullText.includes('联软科技购销合同')) {
      signals.push('标题命中“联软科技购销合同”');
    }

    if (normalizedFullText.includes('乙方：深圳市联软科技股份有限公司')) {
      signals.push('乙方固定主体信息命中');
    }

    if (normalizedFullText.includes('付款方式（二选一）')) {
      signals.push('付款方式分支结构命中');
    }

    if (normalizedFullText.includes('深圳仲裁委员会仲裁')) {
      signals.push('争议仲裁条款命中');
    }

    if (
      normalizedFullText.includes('附件三：廉洁诚信合作协议') ||
      normalizedFullText.includes('廉洁诚信合作协议')
    ) {
      signals.push('廉洁协议附件命中');
    }

    if (signals.length < 3) {
      return [];
    }

    return [
      {
        templateCode: SALES_TEMPLATE_CODE,
        templateLabel: SALES_TEMPLATE_LABEL,
        matched: true,
        score: signals.length,
        signals,
      },
    ];
  }

  private extractTemplateSlotFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
    templateMatchFacts: ContractReviewTemplateMatchFact[],
  ): ContractReviewTemplateSlotFact[] {
    if (!templateMatchFacts.some((fact) => fact.templateCode === SALES_TEMPLATE_CODE)) {
      return [];
    }

    const paragraphs = this.deduplicateFacts(
      documentSnapshot.paragraphs,
      (fragment) => `${fragment.locator}:${fragment.text}`,
    );
    const headerScope = paragraphs.slice(0, Math.min(paragraphs.length, 14));
    const partyCoverScope = this.sliceFragmentsBetween(
      paragraphs,
      (fragment) => fragment.text.startsWith('甲方：'),
      (fragment) => fragment.text.startsWith('乙方：'),
    );
    const partyTableScope = this.sliceFragmentsBetween(
      paragraphs,
      (fragment) => this.normalizeTemplateValue(fragment.text) === '甲方',
      (fragment) => this.normalizeTemplateValue(fragment.text) === '乙方',
    );
    const paymentScope = this.sliceFragmentsBetween(
      paragraphs,
      (fragment) => fragment.text.includes('付款方式（二选一）'),
      (fragment) => fragment.text.includes('交货'),
    );

    const facts: ContractReviewTemplateSlotFact[] = [
      this.pickPreferredTemplateSlotFact([
        this.extractLabeledTemplateSlot(
          headerScope,
          SALES_TEMPLATE_CODE,
          'sales-contract-number',
          '合同编号',
          [/^合同编号[：:]/],
          [/^最终用户[：:]/, /^代理商名称[：:]/],
        ),
      ]),
      this.pickPreferredTemplateSlotFact([
        this.extractLabeledTemplateSlot(
          headerScope,
          SALES_TEMPLATE_CODE,
          'sales-final-customer',
          '最终用户',
          [/^最终用户[：:]/],
          [/^代理商名称[：:]/, /^合同产品名称[：:]/],
        ),
      ]),
      this.pickPreferredTemplateSlotFact([
        this.extractLabeledTemplateSlot(
          partyCoverScope,
          SALES_TEMPLATE_CODE,
          'sales-party-a-name',
          '甲方名称',
          [/^甲方[：:]/],
          [/^地址[：:]/, /^联系人[：:]/],
        ),
        this.extractLabeledTemplateSlot(
          partyTableScope,
          SALES_TEMPLATE_CODE,
          'sales-party-a-name',
          '甲方名称',
          [/^单位全称[：:]/],
          [/^电话[：:]/, /^传真[：:]/],
        ),
      ]),
      this.extractLabeledTemplateSlot(
        partyCoverScope,
        SALES_TEMPLATE_CODE,
        'sales-party-a-address',
        '甲方地址',
        [/^地址[：:]/],
        [/^联系人[：:]/, /^联系电话[：:]/],
      ),
      this.extractLabeledTemplateSlot(
        partyCoverScope,
        SALES_TEMPLATE_CODE,
        'sales-party-a-contact',
        '甲方联系人',
        [/^联系人[：:]/],
        [/^联系电话[：:]/],
      ),
      this.extractLabeledTemplateSlot(
        partyCoverScope,
        SALES_TEMPLATE_CODE,
        'sales-party-a-phone',
        '甲方联系电话',
        [/^联系电话[：:]/],
        [/^乙方[：:]/],
      ),
      this.extractLabeledTemplateSlot(
        partyTableScope,
        SALES_TEMPLATE_CODE,
        'sales-party-a-tax-id',
        '甲方纳税人识别号',
        [/^纳税人识别号[：:]/],
        [/^开户银行[：:]/, /^银行账号[：:]/],
      ),
      this.extractLabeledTemplateSlot(
        partyTableScope,
        SALES_TEMPLATE_CODE,
        'sales-party-a-bank',
        '甲方开户银行',
        [/^开户银行[：:]/],
        [/^银行账号[：:]/, /^法定代表人[：:]/],
      ),
      this.extractLabeledTemplateSlot(
        partyTableScope,
        SALES_TEMPLATE_CODE,
        'sales-party-a-bank-account',
        '甲方银行账号',
        [/^银行账号[：:]/],
        [/^法定代表人[：:]/],
      ),
      this.extractLabeledTemplateSlot(
        paragraphs,
        SALES_TEMPLATE_CODE,
        'sales-total-amount',
        '合同总价',
        [/^本合同总价为人民币/],
        [/^开具电子发票类型[：:]/, /^付款方式/],
      ),
      this.extractPaymentOptionTemplateSlot(paymentScope),
      this.extractPresenceTemplateSlot(
        paragraphs,
        SALES_TEMPLATE_CODE,
        'sales-arbitration-clause',
        '深圳仲裁委员会仲裁',
        (fragment) => fragment.text.includes('深圳仲裁委员会仲裁'),
        '标准模板争议解决条款已保留。',
      ),
      this.extractPresenceTemplateSlot(
        paragraphs,
        SALES_TEMPLATE_CODE,
        'sales-integrity-attachment',
        '附件三：廉洁诚信合作协议',
        (fragment) =>
          fragment.text.includes('附件三：廉洁诚信合作协议') ||
          this.normalizeTemplateValue(fragment.text) === '廉洁诚信合作协议',
        '标准模板廉洁协议附件已保留。',
      ),
    ];

    return this.deduplicateFacts(
      facts,
      (fact) => `${fact.slotCode}:${fact.status}:${fact.locator}:${fact.value ?? ''}`,
    );
  }

  private extractAmountFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewAmountFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '金额',
      '总价',
      '服务费',
      '实施费',
      '合同价',
      '人民币',
      '元',
    ]);
    const facts: ContractReviewAmountFact[] = [];

    for (const fragment of fragments) {
      const matches = fragment.text.matchAll(
        /(?:人民币)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d+)?|[0-9]+(?:\.\d+)?)\s*元/g,
      );

      for (const match of matches) {
        const amount = this.parseAmount(match[1]);
        if (amount === null) {
          continue;
        }

        facts.push({
          locator: fragment.locator,
          text: fragment.text,
          label: this.resolveAmountLabel(fragment.text),
          amount,
          currency: 'CNY',
        });
      }
    }

    return this.deduplicateFacts(
      facts,
      (fact) => `${fact.locator}:${fact.label}:${fact.amount}`,
    );
  }

  private extractTaxRateFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewTaxRateFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '税率',
      '增值税',
      '专用发票',
      '普通发票',
    ]);
    const facts: ContractReviewTaxRateFact[] = [];

    for (const fragment of fragments) {
      const matches = fragment.text.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
      for (const match of matches) {
        const taxRate = Number(match[1]);
        if (!Number.isFinite(taxRate) || taxRate <= 0 || taxRate > 100) {
          continue;
        }

        facts.push({
          locator: fragment.locator,
          text: fragment.text,
          taxRate,
          kind: this.resolveTaxKind(fragment.text),
        });
      }
    }

    return this.deduplicateFacts(
      facts,
      (fact) => `${fact.locator}:${fact.kind}:${fact.taxRate}`,
    );
  }

  private extractPaymentFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewPaymentFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '付款',
      '支付',
      '首付款',
      '到货款',
      '验收款',
      '尾款',
      '账期',
    ]);
    const facts: ContractReviewPaymentFact[] = [];

    for (const fragment of fragments) {
      const dayMatch = fragment.text.match(/(\d+)\s*(?:个)?(?:工作)?日/);
      const percentMatch = fragment.text.match(/(\d+(?:\.\d+)?)\s*%/);

      facts.push({
        locator: fragment.locator,
        text: fragment.text,
        stage: this.resolvePaymentStage(fragment.text),
        days: dayMatch ? Number(dayMatch[1]) : undefined,
        percentage: percentMatch ? Number(percentMatch[1]) : undefined,
      });
    }

    return this.deduplicateFacts(
      facts,
      (fact) => `${fact.locator}:${fact.stage}:${fact.days ?? ''}:${fact.percentage ?? ''}`,
    );
  }

  private extractDiscountFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewDiscountFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, ['折扣', '折']);
    const facts: ContractReviewDiscountFact[] = [];

    for (const fragment of fragments) {
      const foldMatches = fragment.text.matchAll(/(\d+(?:\.\d+)?)\s*折/g);
      for (const match of foldMatches) {
        const fold = Number(match[1]);
        if (!Number.isFinite(fold) || fold <= 0 || fold > 10) {
          continue;
        }

        facts.push({
          locator: fragment.locator,
          text: fragment.text,
          discountRatePercent: Number((fold * 10).toFixed(2)),
          expression: `${match[1]}折`,
        });
      }

      const percentMatches = fragment.text.matchAll(
        /折扣(?:率)?(?:为|:|：)?\s*(\d+(?:\.\d+)?)\s*%/g,
      );
      for (const match of percentMatches) {
        const discountRatePercent = Number(match[1]);
        if (!Number.isFinite(discountRatePercent) || discountRatePercent <= 0) {
          continue;
        }

        facts.push({
          locator: fragment.locator,
          text: fragment.text,
          discountRatePercent,
          expression: `${match[1]}%`,
        });
      }
    }

    return this.deduplicateFacts(
      facts,
      (fact) => `${fact.locator}:${fact.expression}:${fact.discountRatePercent}`,
    );
  }

  private extractPenaltyFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewPenaltyFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '违约',
      '违约金',
      '赔偿',
      '责任上限',
      '最高不超过',
      '千分之',
    ]);
    const facts: ContractReviewPenaltyFact[] = [];

    for (const fragment of fragments) {
      const dailyRatePermilleMatch = fragment.text.match(/千分之\s*([0-9]+(?:\.[0-9]+)?)/);
      const capPercentMatch = fragment.text.match(
        /(最高不超过|上限为|不超过)[^。；，]*?(\d+(?:\.\d+)?)\s*%/,
      );

      facts.push({
        locator: fragment.locator,
        text: fragment.text,
        dailyRatePermille: dailyRatePermilleMatch
          ? Number(dailyRatePermilleMatch[1])
          : undefined,
        capPercent: capPercentMatch ? Number(capPercentMatch[2]) : undefined,
        unlimitedLiability: /全部赔偿责任|承担全部赔偿|无限责任|不限于/.test(
          fragment.text,
        ),
      });
    }

    return this.deduplicateFacts(
      facts,
      (fact) =>
        `${fact.locator}:${fact.dailyRatePermille ?? ''}:${fact.capPercent ?? ''}:${fact.unlimitedLiability}`,
    );
  }

  private extractInvoiceFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewInvoiceFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '开票',
      '发票',
      '*软件*',
      '增值税',
    ]);
    const facts: ContractReviewInvoiceFact[] = [];

    for (const fragment of fragments) {
      const invoiceNameMatch = fragment.text.match(/(\*软件\*[^\s，。；]*)/);

      facts.push({
        locator: fragment.locator,
        text: fragment.text,
        invoiceType: this.resolveInvoiceType(fragment.text),
        invoiceName: invoiceNameMatch?.[1],
        hasSoftwarePrefix: fragment.text.includes('*软件*'),
      });
    }

    return this.deduplicateFacts(
      facts,
      (fact) =>
        `${fact.locator}:${fact.invoiceType}:${fact.invoiceName ?? ''}:${fact.hasSoftwarePrefix}`,
    );
  }

  private extractIntellectualPropertyFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewIntellectualPropertyFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '知识产权',
      '源代码',
      '著作权',
      '逆向工程',
      '反编译',
      '反汇编',
    ]);
    const facts: ContractReviewIntellectualPropertyFact[] = [];

    for (const fragment of fragments) {
      facts.push({
        locator: fragment.locator,
        text: fragment.text,
        ownership: this.resolveIpOwnership(fragment.text),
        hasExclusiveLanguage: /独占|排他|独家|客户独有/.test(fragment.text),
        allowsReverseEngineering:
          /(允许|可以|有权|得以).{0,12}(逆向工程|反编译|反汇编)/.test(fragment.text),
      });
    }

    return this.deduplicateFacts(
      facts,
      (fact) =>
        `${fact.locator}:${fact.ownership}:${fact.hasExclusiveLanguage}:${fact.allowsReverseEngineering}`,
    );
  }

  private extractLicenseDeliveryFacts(
    documentSnapshot: ContractReviewDocumentSnapshot,
  ): ContractReviewLicenseDeliveryFact[] {
    const fragments = this.pickRelevantFragments(documentSnapshot, [
      '永久许可',
      '临时许可',
      '全款',
      '首付款',
      '交付',
      '许可',
    ]);
    const facts: ContractReviewLicenseDeliveryFact[] = [];

    for (const fragment of fragments) {
      const mentionsPermanentLicense = fragment.text.includes('永久许可');
      const mentionsTemporaryLicense = fragment.text.includes('临时许可');

      if (!mentionsPermanentLicense && !mentionsTemporaryLicense) {
        continue;
      }

      facts.push({
        locator: fragment.locator,
        text: fragment.text,
        mentionsTemporaryLicense,
        mentionsPermanentLicense,
        mentionsFullPaymentRequired:
          /(收到全款|全款后|全款到账后|支付全款后|收齐全款后)/.test(fragment.text),
        mentionsAdvanceDelivery:
          /(首付款后|收到首付款后|未收到全款|提前交付|先行交付|付款后即可交付)/.test(
            fragment.text,
          ),
      });
    }

    return this.deduplicateFacts(
      facts,
      (fact) =>
        `${fact.locator}:${fact.mentionsTemporaryLicense}:${fact.mentionsPermanentLicense}:${fact.mentionsFullPaymentRequired}:${fact.mentionsAdvanceDelivery}`,
    );
  }

  private extractLabeledTemplateSlot(
    fragments: ContractReviewDocumentFragment[],
    templateCode: string,
    slotCode: string,
    slotLabel: string,
    labelPatterns: RegExp[],
    stopPatterns: RegExp[] = [],
  ): ContractReviewTemplateSlotFact {
    const labelIndex = fragments.findIndex((fragment) =>
      labelPatterns.some((pattern) => pattern.test(this.normalizeTemplateValue(fragment.text))),
    );

    if (labelIndex < 0) {
      return this.buildTemplateSlotFact(
        templateCode,
        slotCode,
        slotLabel,
        'MISSING',
        '全文',
        '',
        undefined,
      );
    }

    const labelFragment = fragments[labelIndex];
    const inlineValue = this.extractInlineLabelValue(labelFragment.text, labelPatterns);
    if (this.hasMeaningfulTemplateValue(inlineValue)) {
      return this.buildTemplateSlotFact(
        templateCode,
        slotCode,
        slotLabel,
        'FILLED',
        labelFragment.locator,
        labelFragment.text,
        inlineValue,
      );
    }

    const nextValueFragment = this.findNextTemplateValueFragment(
      fragments,
      labelIndex + 1,
      stopPatterns,
    );
    if (nextValueFragment) {
      const normalizedNextValue = this.normalizeTemplateValue(nextValueFragment.text);
      if (this.hasMeaningfulTemplateValue(normalizedNextValue)) {
        return this.buildTemplateSlotFact(
          templateCode,
          slotCode,
          slotLabel,
          'FILLED',
          nextValueFragment.locator,
          nextValueFragment.text,
          normalizedNextValue,
        );
      }

      return this.buildTemplateSlotFact(
        templateCode,
        slotCode,
        slotLabel,
        'PLACEHOLDER',
        nextValueFragment.locator,
        nextValueFragment.text,
        normalizedNextValue || inlineValue,
      );
    }

    if (inlineValue) {
      return this.buildTemplateSlotFact(
        templateCode,
        slotCode,
        slotLabel,
        'PLACEHOLDER',
        labelFragment.locator,
        labelFragment.text,
        inlineValue,
      );
    }

    return this.buildTemplateSlotFact(
      templateCode,
      slotCode,
      slotLabel,
      'MISSING',
      labelFragment.locator,
      labelFragment.text,
      undefined,
    );
  }

  private extractPaymentOptionTemplateSlot(
    paymentScope: ContractReviewDocumentFragment[],
  ): ContractReviewTemplateSlotFact {
    const anchor = paymentScope.find((fragment) =>
      fragment.text.includes('付款方式（二选一）'),
    );
    if (!anchor) {
      return this.buildTemplateSlotFact(
        SALES_TEMPLATE_CODE,
        'sales-payment-option',
        '付款方式收敛',
        'MISSING',
        '全文',
        '',
        undefined,
      );
    }

    const hasOneTimeOption = paymentScope.some((fragment) =>
      /一次性支付100%\s*合同总价|一次性付款方式/.test(
        this.normalizeTemplateValue(fragment.text),
      ),
    );
    const hasTwoStageOption = paymentScope.some((fragment) =>
      /支付合同总价的\s*50\s*%|到货款/.test(this.normalizeTemplateValue(fragment.text)),
    );

    if (hasOneTimeOption && hasTwoStageOption) {
      return this.buildTemplateSlotFact(
        SALES_TEMPLATE_CODE,
        'sales-payment-option',
        '付款方式收敛',
        'AMBIGUOUS',
        anchor.locator,
        anchor.text,
        '一次性付款 / 两段付款',
      );
    }

    if (hasOneTimeOption) {
      return this.buildTemplateSlotFact(
        SALES_TEMPLATE_CODE,
        'sales-payment-option',
        '付款方式收敛',
        'FILLED',
        anchor.locator,
        anchor.text,
        '一次性付款',
      );
    }

    if (hasTwoStageOption) {
      return this.buildTemplateSlotFact(
        SALES_TEMPLATE_CODE,
        'sales-payment-option',
        '付款方式收敛',
        'FILLED',
        anchor.locator,
        anchor.text,
        '两段付款',
      );
    }

    return this.buildTemplateSlotFact(
      SALES_TEMPLATE_CODE,
      'sales-payment-option',
      '付款方式收敛',
      'MISSING',
      anchor.locator,
      anchor.text,
      undefined,
    );
  }

  private extractPresenceTemplateSlot(
    fragments: ContractReviewDocumentFragment[],
    templateCode: string,
    slotCode: string,
    slotLabel: string,
    matcher: (fragment: ContractReviewDocumentFragment) => boolean,
    presentNote: string,
  ): ContractReviewTemplateSlotFact {
    const matchedFragment = fragments.find(matcher);
    if (!matchedFragment) {
      return this.buildTemplateSlotFact(
        templateCode,
        slotCode,
        slotLabel,
        'MISSING',
        '全文',
        '',
        undefined,
      );
    }

    return this.buildTemplateSlotFact(
      templateCode,
      slotCode,
      slotLabel,
      'PRESENT',
      matchedFragment.locator,
      matchedFragment.text,
      matchedFragment.text,
      presentNote,
    );
  }

  private pickPreferredTemplateSlotFact(
    facts: ContractReviewTemplateSlotFact[],
  ): ContractReviewTemplateSlotFact {
    const priority: Record<ContractReviewTemplateSlotStatus, number> = {
      FILLED: 5,
      PRESENT: 4,
      AMBIGUOUS: 3,
      PLACEHOLDER: 2,
      MISSING: 1,
    };

    return [...facts].sort((left, right) => {
      const statusDiff = priority[right.status] - priority[left.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return (right.value?.length ?? 0) - (left.value?.length ?? 0);
    })[0];
  }

  private buildTemplateSlotFact(
    templateCode: string,
    slotCode: string,
    slotLabel: string,
    status: ContractReviewTemplateSlotStatus,
    locator: string,
    text: string,
    value?: string,
    note?: string,
  ): ContractReviewTemplateSlotFact {
    return {
      templateCode,
      slotCode,
      slotLabel,
      status,
      locator,
      text,
      ...(value ? { value } : {}),
      ...(note
        ? { note }
        : {
            note: this.resolveTemplateSlotNote(status),
          }),
    };
  }

  private resolveTemplateSlotNote(
    status: ContractReviewTemplateSlotStatus,
  ): string | undefined {
    switch (status) {
      case 'PLACEHOLDER':
        return '仍为模板占位或未填写内容。';
      case 'MISSING':
        return '未在模板预期位置识别到对应内容。';
      case 'AMBIGUOUS':
        return '模板中的互斥分支同时存在，尚未收敛到单一有效版本。';
      case 'PRESENT':
        return '标准模板固定内容已保留。';
      default:
        return undefined;
    }
  }

  private extractInlineLabelValue(text: string, labelPatterns: RegExp[]): string {
    const normalizedText = this.normalizeTemplateValue(text);
    for (const pattern of labelPatterns) {
      if (pattern.test(normalizedText)) {
        return this.normalizeTemplateValue(normalizedText.replace(pattern, ''));
      }
    }

    return '';
  }

  private findNextTemplateValueFragment(
    fragments: ContractReviewDocumentFragment[],
    startIndex: number,
    stopPatterns: RegExp[],
  ): ContractReviewDocumentFragment | null {
    for (
      let index = startIndex;
      index < Math.min(fragments.length, startIndex + 3);
      index += 1
    ) {
      const fragment = fragments[index];
      const normalizedText = this.normalizeTemplateValue(fragment.text);
      if (!normalizedText) {
        continue;
      }

      if (
        stopPatterns.some((pattern) => pattern.test(normalizedText)) ||
        this.looksLikeTemplateLabel(normalizedText)
      ) {
        return null;
      }

      return fragment;
    }

    return null;
  }

  private looksLikeTemplateLabel(text: string): boolean {
    if (!text) {
      return false;
    }

    if (
      /^(甲方|乙方|单位全称|地址|联系人|联系电话|电话|传真|工商注册地|纳税人识别号|开户银行|银行账号|法定代表人|最终用户|代理商名称|合同产品名称|交货日期|交货方式|收货地址|收货联系人|合同邮寄接收地址|合同邮寄联系人|电子发票接收邮箱|电子发票联系人|备注)[：:]?$/.test(
        text,
      )
    ) {
      return true;
    }

    return /[：:]$/.test(text) && text.length <= 30;
  }

  private hasMeaningfulTemplateValue(value: string): boolean {
    return Boolean(value) && !this.isPlaceholderTemplateValue(value);
  }

  private isPlaceholderTemplateValue(value: string): boolean {
    const normalizedValue = this.normalizeTemplateValue(value);
    if (!normalizedValue) {
      return true;
    }

    if (/^[()（）_\-—.·%￥,:：/\\\s]+$/.test(normalizedValue)) {
      return true;
    }

    if (
      /(法定注册全称|合同购买产品名称|LS年月日-邮箱地址-区号-合同编号|用户法定注册全称|项目名称、项目编号)/.test(
        normalizedValue,
      )
    ) {
      return true;
    }

    if (/^XX/.test(normalizedValue)) {
      return true;
    }

    if (/^元整（￥\s*\.?0*）。?$/.test(normalizedValue)) {
      return true;
    }

    if (/^人民币\s*元整（￥\s*\.?0*）。?$/.test(normalizedValue)) {
      return true;
    }

    return false;
  }

  private normalizeTemplateValue(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private sliceFragmentsBetween(
    fragments: ContractReviewDocumentFragment[],
    startMatcher: (fragment: ContractReviewDocumentFragment) => boolean,
    endMatcher: (fragment: ContractReviewDocumentFragment) => boolean,
  ): ContractReviewDocumentFragment[] {
    const startIndex = fragments.findIndex(startMatcher);
    if (startIndex < 0) {
      return [];
    }

    const relativeEndIndex = fragments
      .slice(startIndex + 1)
      .findIndex((fragment) => endMatcher(fragment));
    const endIndex =
      relativeEndIndex >= 0 ? startIndex + 1 + relativeEndIndex : fragments.length;

    return fragments.slice(startIndex, endIndex);
  }

  private pickRelevantFragments(
    documentSnapshot: ContractReviewDocumentSnapshot,
    keywords: string[],
  ): ContractReviewDocumentFragment[] {
    const fragments = [
      ...documentSnapshot.clauses,
      ...documentSnapshot.headings,
      ...documentSnapshot.paragraphs,
    ].filter((fragment) => keywords.some((keyword) => fragment.text.includes(keyword)));

    return this.deduplicateFacts(
      fragments,
      (fragment) => `${fragment.locator}:${fragment.text}`,
    ).slice(0, 24);
  }

  private parseAmount(rawValue: string): number | null {
    const normalized = rawValue.replace(/,/g, '');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  }

  private resolveAmountLabel(text: string): string {
    if (text.includes('服务费')) {
      return '服务费';
    }
    if (text.includes('实施费')) {
      return '实施费';
    }
    if (text.includes('首付款')) {
      return '首付款';
    }
    if (text.includes('验收款')) {
      return '验收款';
    }
    if (text.includes('合同金额') || text.includes('合同总价') || text.includes('总价')) {
      return '合同金额';
    }

    return '金额';
  }

  private resolveTaxKind(text: string): ContractReviewTaxRateFact['kind'] {
    if (/服务|维保|定制开发|技术服务|租赁/.test(text)) {
      return 'SERVICE';
    }
    if (/产品|软件|硬件|许可/.test(text)) {
      return 'PRODUCT';
    }

    return 'UNKNOWN';
  }

  private resolvePaymentStage(text: string): string {
    if (text.includes('首付款')) {
      return '首付款';
    }
    if (text.includes('到货款')) {
      return '到货款';
    }
    if (text.includes('验收款')) {
      return '验收款';
    }
    if (text.includes('尾款')) {
      return '尾款';
    }
    if (text.includes('一次性付款') || text.includes('一次性支付')) {
      return '一次性付款';
    }

    return '付款节点';
  }

  private resolveInvoiceType(text: string): ContractReviewInvoiceFact['invoiceType'] {
    if (text.includes('增值税专用发票') || text.includes('专票')) {
      return 'VAT_SPECIAL';
    }
    if (
      text.includes('增值税普通发票') ||
      text.includes('普票') ||
      text.includes('普通发票')
    ) {
      return 'VAT_NORMAL';
    }

    return 'UNKNOWN';
  }

  private resolveIpOwnership(
    text: string,
  ): ContractReviewIntellectualPropertyFact['ownership'] {
    if (/归甲方所有|归客户所有|客户独有|甲方享有[^。；，]{0,20}所有权/.test(text)) {
      return 'PARTY_A';
    }
    if (/归乙方所有|乙方所有|归联软所有|联软科技[^。；，]{0,20}所有/.test(text)) {
      return 'PARTY_B';
    }
    if (/双方共有|共同所有|共享/.test(text)) {
      return 'SHARED';
    }

    return 'UNKNOWN';
  }

  private buildSummary(input: {
    contractTypes: string[];
    amountFacts: ContractReviewAmountFact[];
    taxRateFacts: ContractReviewTaxRateFact[];
    paymentFacts: ContractReviewPaymentFact[];
    discountFacts: ContractReviewDiscountFact[];
    penaltyFacts: ContractReviewPenaltyFact[];
    invoiceFacts: ContractReviewInvoiceFact[];
    intellectualPropertyFacts: ContractReviewIntellectualPropertyFact[];
    licenseDeliveryFacts: ContractReviewLicenseDeliveryFact[];
    templateMatchFacts: ContractReviewTemplateMatchFact[];
    templateSlotFacts: ContractReviewTemplateSlotFact[];
  }): string {
    const summaryParts = [
      `识别合同类型：${input.contractTypes.join('、')}`,
      `金额 ${input.amountFacts.length} 项`,
      `税率 ${input.taxRateFacts.length} 项`,
      `付款 ${input.paymentFacts.length} 项`,
      `折扣 ${input.discountFacts.length} 项`,
      `违约 ${input.penaltyFacts.length} 项`,
      `开票 ${input.invoiceFacts.length} 项`,
      `知识产权 ${input.intellectualPropertyFacts.length} 项`,
      `许可交付 ${input.licenseDeliveryFacts.length} 项`,
    ];

    if (input.templateMatchFacts.length > 0 || input.templateSlotFacts.length > 0) {
      const statusCounters = input.templateSlotFacts.reduce(
        (accumulator, fact) => {
          accumulator[fact.status] += 1;
          return accumulator;
        },
        {
          FILLED: 0,
          PLACEHOLDER: 0,
          MISSING: 0,
          PRESENT: 0,
          AMBIGUOUS: 0,
        } as Record<ContractReviewTemplateSlotStatus, number>,
      );

      summaryParts.push(`模板命中 ${input.templateMatchFacts.length} 个`);
      summaryParts.push(`模板槽位 ${input.templateSlotFacts.length} 项`);
      if (statusCounters.FILLED > 0) {
        summaryParts.push(`已填 ${statusCounters.FILLED} 项`);
      }
      if (statusCounters.PRESENT > 0) {
        summaryParts.push(`固定项 ${statusCounters.PRESENT} 项`);
      }
      if (statusCounters.PLACEHOLDER > 0) {
        summaryParts.push(`占位 ${statusCounters.PLACEHOLDER} 项`);
      }
      if (statusCounters.AMBIGUOUS > 0) {
        summaryParts.push(`待收敛 ${statusCounters.AMBIGUOUS} 项`);
      }
      if (statusCounters.MISSING > 0) {
        summaryParts.push(`缺失 ${statusCounters.MISSING} 项`);
      }
    }

    return summaryParts.join('；');
  }

  private deduplicateFacts<T>(items: T[], getKey: (item: T) => string): T[] {
    const uniqueMap = new Map<string, T>();
    for (const item of items) {
      const key = getKey(item);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }

    return [...uniqueMap.values()];
  }
}
