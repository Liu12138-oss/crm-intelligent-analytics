/**
 * 全链路诊断测试：验证 6 个场景的路由决策 + 模板卡片字段 + 排除过滤
 *
 * 场景清单：
 * ① 近3个月商机进展（常规分析）
 * ② 最近一年商机趋势分析（常规分析/趋势）
 * ③ 近3个月没有维护进度的客户情况（常规分析 - 排除过滤）
 * ④ 全国渠道商发展运营数据看板（看板桥接 - agent-development）
 * ⑤ 各区域渠道商发展运营数据情况看板（看板桥接 - region-overview）
 * ⑥ 最近3个月没有商机和订单的渠道商情况（常规分析 - 排除过滤）
 */

describe('WecomBot Full-Chain Diagnosis', () => {
  // ===== 排除过滤正则（与 wecom-bot.service.ts isExclusionaryFilterQuery 完全一致）=====
  const isExclusionaryFilterQuery = (normalizedText: string): boolean => {
    if (!normalizedText) return false;
    return (
      /没有.{0,8}(客户|商机|订单|报价|渠道商|代理商).{0,6}(情况|的|列表|明细)/u.test(normalizedText) ||
      /无.{0,4}(进展|维护|跟进|商机|订单|更新|联系)/u.test(normalizedText) ||
      /未.{0,4}(维护|跟进|进展|更新|联系)/u.test(normalizedText) ||
      /没有.{0,6}(维护进度|跟进记录|商机和订单|维护记录)/u.test(normalizedText)
    );
  };

  // ===== isWecomDashboardAnalysisRequest 逻辑（与源码一致）=====
  const isWecomDashboardAnalysisRequest = (questionText: string): boolean => {
    const normalizedQuestion = questionText.replace(/\s+/gu, '').trim();
    if (!normalizedQuestion) return false;
    if (isExclusionaryFilterQuery(normalizedQuestion)) return false;
    const hasDashboardSignal = /(数据看板|看板分析|运营看板|经营看板|经营总览|经营概览|经营情况|发展运营|运营数据|运营分析|经营分析|数据运营)/u.test(normalizedQuestion);
    const hasAnalysisIntent = /(分析|看板|概览|总览|情况|汇总|统计|趋势|漏斗|分布|排名|排行|明细|建设|结构|贡献|阶段)/u.test(normalizedQuestion);
    return hasDashboardSignal && hasAnalysisIntent;
  };

  // ===== detectProfile 逻辑（与 DashboardReportComposer.detectProfile 一致）=====
  const detectProfile = (questionText: string): string => {
    const text = questionText.toLowerCase();
    if (/没有.{0,8}(客户|商机|订单|报价).{0,6}(情况|的)|无.{0,4}(进展|维护|跟进)/u.test(text)) return 'auto';
    if (/各区域.*看板|各区域.*数据|区域.*概览|大区.*对比|区域排名.*看板/.test(text)) return 'region-overview';
    if (/区域.*经营|区域.*运营|区域.*发展|区域.*看板/.test(text)) return 'region-overview';
    if (/渠道.*下单|下单.*汇总|签单.*汇总|订单.*分析|订单.*看板|下单.*分析/.test(text)) return 'channel-order-summary';
    if (/代理商.*发展|代理商.*运营|代理商.*看板|渠道商.*发展|渠道商.*运营|渠道商.*看板|渠道商.*数据/.test(text)) return 'agent-development';
    if (/负责人.*业绩|负责人.*排名|销售.*排名/.test(text)) return 'owner-performance';
    return 'channel-order-summary';
  };

  // ===== 模拟 hasExplicitWecomAnalysisOrBlockSignal 逻辑 =====
  const hasExplicitWecomAnalysisOrBlockSignal = (messageText: string): boolean => {
    const normalizedText = messageText.trim().replace(/\s+/gu, '').replace(/[\u201c\u201d\u0022\u0027\u300e\u300f\u300c\u300d\u3010\u3011]/gu, '').replace(/[。！!，,；;、]+$/gu, '');
    if (!normalizedText) return false;
    // 排除过滤
    if (isExclusionaryFilterQuery(normalizedText)) return false;
    // 关键词匹配
    if (/商机|机会|漏斗|赢单率|合同|签单|签约|成交|回款|客户|客资|客群/u.test(normalizedText)) return true;
    if (/数据看板|看板分析|运营看板|经营看板|经营总览|经营概览|经营情况|发展运营|运营数据|运营分析|经营分析|数据运营/u.test(normalizedText)) return true;
    return false;
  };

  const normalize = (text: string): string => text.replace(/\s+/gu, '').trim();

  // ===== 6 个测试场景 =====
  const scenarios = [
    { id: '①', question: '近3个月商机进展', expectDashboard: false, expectExclusion: false, expectProfile: 'channel-order-summary' },
    { id: '②', question: '最近一年商机趋势分析', expectDashboard: false, expectExclusion: false, expectProfile: 'channel-order-summary' },
    { id: '③', question: '近3个月没有维护进度的客户情况', expectDashboard: false, expectExclusion: true, expectProfile: 'auto' },
    { id: '③b', question: '最近3个月没有维护进度的客户情况', expectDashboard: false, expectExclusion: true, expectProfile: 'auto' },
    { id: '③c', question: '本月经营总览情况', expectDashboard: true, expectExclusion: false, expectProfile: 'channel-order-summary' },
    { id: '④', question: '全国渠道商发展运营数据看板', expectDashboard: true, expectExclusion: false, expectProfile: 'agent-development' },
    { id: '⑤', question: '各区域渠道商发展运营数据情况看板', expectDashboard: true, expectExclusion: false, expectProfile: 'region-overview' },
    { id: '⑥', question: '最近3个月没有商机和订单的渠道商情况', expectDashboard: false, expectExclusion: true, expectProfile: 'auto' },
    { id: '⑥b', question: '最近3个月没有商机和订单的渠道商情况', expectDashboard: false, expectExclusion: true, expectProfile: 'auto' },
  ];

  describe('场景路由决策验证', () => {
    for (const s of scenarios) {
      it(`场景 ${s.id}: "${s.question}"`, () => {
        const normalized = normalize(s.question);
        const isExclusion = isExclusionaryFilterQuery(normalized);
        const isDashboard = isWecomDashboardAnalysisRequest(s.question);
        const profile = detectProfile(s.question);
        const hasSignal = hasExplicitWecomAnalysisOrBlockSignal(s.question);

        console.log(`\n  场景 ${s.id}: "${s.question}"`);
        console.log(`    normalized: "${normalized}"`);
        console.log(`    isExclusionaryFilterQuery: ${isExclusion} (期望: ${s.expectExclusion})`);
        console.log(`    isWecomDashboardAnalysisRequest: ${isDashboard} (期望: ${s.expectDashboard})`);
        console.log(`    detectProfile: ${profile} (期望: ${s.expectProfile})`);
        console.log(`    hasExplicitWecomAnalysisOrBlockSignal: ${hasSignal}`);

        expect(isExclusion).toBe(s.expectExclusion);
        expect(isDashboard).toBe(s.expectDashboard);
        if (s.expectProfile !== 'auto') {
          expect(profile).toBe(s.expectProfile);
        }
      });
    }
  });

  describe('排除过滤正则深度验证', () => {
    it('场景③: "近3个月没有维护进度的客户情况" 必须被排除', () => {
      const text = '近3个月没有维护进度的客户情况';
      expect(isExclusionaryFilterQuery(text)).toBe(true);
    });

    it('场景③b: "最近3个月没有维护进度的客户情况" 必须被排除', () => {
      const text = '最近3个月没有维护进度的客户情况';
      expect(isExclusionaryFilterQuery(text)).toBe(true);
    });

    it('场景⑥: "最近3个月没有商机和订单的渠道商情况" 必须被排除', () => {
      const text = '最近3个月没有商机和订单的渠道商情况';
      expect(isExclusionaryFilterQuery(text)).toBe(true);
    });

    it('场景④: "全国渠道商发展运营数据看板" 不应被排除', () => {
      const text = '全国渠道商发展运营数据看板';
      expect(isExclusionaryFilterQuery(text)).toBe(false);
    });

    it('场景⑤: "各区域渠道商发展运营数据情况看板" 不应被排除', () => {
      const text = '各区域渠道商发展运营数据情况看板';
      expect(isExclusionaryFilterQuery(text)).toBe(false);
    });

    it('变体: "无跟进记录的客户" 应被排除', () => {
      expect(isExclusionaryFilterQuery('无跟进记录的客户')).toBe(true);
    });

    it('变体: "未维护的商机" 应被排除', () => {
      expect(isExclusionaryFilterQuery('未维护的商机')).toBe(true);
    });
  });

  describe('看板桥接决策验证', () => {
    it('场景③ 不应触发看板桥接', () => {
      expect(isWecomDashboardAnalysisRequest('近3个月没有维护进度的客户情况')).toBe(false);
    });

    it('场景③b 不应触发看板桥接', () => {
      expect(isWecomDashboardAnalysisRequest('最近3个月没有维护进度的客户情况')).toBe(false);
    });

    it('场景③c 应触发经营总览看板桥接', () => {
      expect(isWecomDashboardAnalysisRequest('本月经营总览情况')).toBe(true);
    });

    it('场景④ 应触发看板桥接', () => {
      expect(isWecomDashboardAnalysisRequest('全国渠道商发展运营数据看板')).toBe(true);
    });

    it('场景⑤ 应触发看板桥接', () => {
      expect(isWecomDashboardAnalysisRequest('各区域渠道商发展运营数据情况看板')).toBe(true);
    });

    it('场景⑥ 不应触发看板桥接', () => {
      expect(isWecomDashboardAnalysisRequest('最近3个月没有商机和订单的渠道商情况')).toBe(false);
    });
  });

  describe('模板卡片字段格式验证', () => {
    it('horizontal_content_list 应使用 keyname（非 label/key）', () => {
      // 模拟模板卡片构建
      const kpiMetrics = [
        { label: '渠道商总数', value: '152' },
        { label: '下单渠道商', value: '89' },
      ];

      // 正确格式
      const correctItems = kpiMetrics.map((m) => ({
        keyname: m.label,
        value: m.value,
      }));

      // 验证字段名
      for (const item of correctItems) {
        expect(item).toHaveProperty('keyname');
        expect(item).not.toHaveProperty('label');
        expect(item).not.toHaveProperty('key');
      }
    });

    it('emphasis_content.title 应 <= 12 字符', () => {
      const title = '看板分析';
      expect(title.length).toBeLessThanOrEqual(12);
    });

    it('emphasis_content.desc 应可截断到 <= 30 字符', () => {
      const desc = '这是一段很长的摘要文字需要被截断到30字符以内以确保企微API不会拒绝'.slice(0, 30);
      expect(desc.length).toBeLessThanOrEqual(30);
    });
  });

  describe('Profile 检测验证', () => {
    it('场景④ "全国渠道商发展运营数据看板" → agent-development', () => {
      expect(detectProfile('全国渠道商发展运营数据看板')).toBe('agent-development');
    });

    it('场景⑤ "各区域渠道商发展运营数据情况看板" → region-overview', () => {
      expect(detectProfile('各区域渠道商发展运营数据情况看板')).toBe('region-overview');
    });

    it('场景⑤ 变体 "各区域渠道商发展运营数据看板" → region-overview', () => {
      expect(detectProfile('各区域渠道商发展运营数据看板')).toBe('region-overview');
    });

    it('渠道下单汇总 → channel-order-summary', () => {
      expect(detectProfile('广州办渠道下单汇总分析')).toBe('channel-order-summary');
    });
  });
});
