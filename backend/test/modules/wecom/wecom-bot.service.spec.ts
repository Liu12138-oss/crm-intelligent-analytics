import { WecomBotService } from '../../../src/modules/wecom/wecom-bot.service';
import { PublicAnalysisResultController } from '../../../src/modules/analysis/public-analysis-result.controller';
import { WecomDashboardCardBuilder } from '../../../src/modules/wecom/wecom-dashboard-card-builder.service';
import { WecomDashboardKpiSelectorService } from '../../../src/modules/wecom/wecom-dashboard-kpi-selector.service';
import { WecomDashboardMarkdownRendererService } from '../../../src/modules/wecom/wecom-dashboard-markdown-renderer.service';
import { WecomDashboardTemplateResolverService } from '../../../src/modules/wecom/wecom-dashboard-template-resolver.service';

describe('WecomBotService', () => {
  function createService() {
    return new WecomBotService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getWecomRuntimeConfig: jest.fn(() => ({
          webBaseUrl: 'http://127.0.0.1:5173',
          deliveryMaxRetries: 0,
          deliveryRetryDelayMs: 0,
        })),
      } as never,
      {} as never,
      {} as never,
      { logWarn: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { renderTableImage: jest.fn() } as never,
      {} as never,
      {
        startInboundListener: jest.fn(),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new WecomDashboardCardBuilder() as never,
      new WecomDashboardTemplateResolverService() as never,
      new WecomDashboardKpiSelectorService() as never,
      new WecomDashboardMarkdownRendererService() as never,
    );
  }

  it('企业微信入站监听初始化失败时应仅告警降级，不打崩模块启动', async () => {
    const startInboundListener = jest
      .fn()
      .mockRejectedValue(new Error('企业微信机器人 SDK 连接超时。'));
    const analysisLoggerService = {
      logWarn: jest.fn(),
    };

    const service = new WecomBotService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      analysisLoggerService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { renderTableImage: jest.fn() } as never,
      {} as never,
      {
        startInboundListener,
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never, // dashboardReportComposer
      {} as never, // analysisRequestRepository
      new WecomDashboardCardBuilder() as never,
      new WecomDashboardTemplateResolverService() as never,
      new WecomDashboardKpiSelectorService() as never,
      new WecomDashboardMarkdownRendererService() as never,
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(startInboundListener).toHaveBeenCalledTimes(1);
    expect(analysisLoggerService.logWarn).toHaveBeenCalledWith(
      '企业微信机器人入站监听启动失败，已降级跳过本次监听初始化。',
      expect.objectContaining({
        reason: '企业微信机器人 SDK 连接超时。',
      }),
    );
  });

  it('看板模板卡片传入图片 URL 时应使用图文展示卡片并内嵌图表', () => {
    const builder = new WecomDashboardCardBuilder();

    const card = builder.buildDashboardCard({
      queryId: 'query_dashboard_card_image',
      title: '经营总览看板',
      kpiItems: [
        { label: '渠道商总数', value: '173家' },
        { label: '报备数', value: '150个' },
      ],
      summary: '渠道经营情况已生成趋势图和关键指标。',
      webDashboardUrl: 'http://127.0.0.1:3001/api/v1/public/analysis-results/query_dashboard_card_image/file',
      dataSourceLabel: '当前用户权限范围 / CRM OpenAPI 实时数据',
      imageUrl: 'http://127.0.0.1:3001/api/v1/public/wecom-dashboard-images/card.png',
      imageAspectRatio: 1.78,
      imageTitle: '图表看板',
      imageDesc: '趋势图已内嵌展示',
    });

    expect(card).toEqual(
      expect.objectContaining({
        card_type: 'news_notice',
        card_image: expect.objectContaining({
          url: 'http://127.0.0.1:3001/api/v1/public/wecom-dashboard-images/card.png',
          aspect_ratio: 1.78,
        }),
        image_text_area: expect.objectContaining({
          image_url: 'http://127.0.0.1:3001/api/v1/public/wecom-dashboard-images/card.png',
        }),
        vertical_content_list: expect.arrayContaining([
          expect.objectContaining({
            title: '核心摘要',
          }),
        ]),
      }),
    );
  });

  it('返回问数结果时应优先发送企业微信 Markdown 摘要', () => {
    const service = createService() as any;

    const blocks = service.resolveDispatchBlocks(
      {
        status: 'RETURNED',
      },
      {
        groundedMarkdown: '## 摘要\n- 这里是企微裁剪 Markdown。',
        streamBlocks: [
          {
            sequence: 0,
            blockType: 'SUMMARY',
            content: '旧的结构化块',
          },
        ],
      },
      undefined,
    );

    expect(blocks).toEqual([
      {
        sequence: 0,
        blockType: 'REPORT',
        content: '## 摘要\n- 这里是企微裁剪 Markdown。',
      },
    ]);
  });

  it('详情缺少顶层 Markdown 时应重建企微表格版结果', () => {
    const service = createService() as any;

    const blocks = service.resolveDispatchBlocks(
      {
        status: 'RETURNED',
      },
      {
        report: {
          reportTitle: '区域经营贡献报告',
          executiveSummary: '最近三个月山东区商机情况已生成。',
          metricCards: [{ name: '累计商机金额', value: '26.5 万元' }],
          keyFindings: [],
          nextBestQuestions: [],
          scopeSummary: '测试范围',
          variant: 'ranking',
        },
        tableRows: [
          {
            region: '山东区',
            amount: 265000,
            count: 44,
          },
        ],
        streamBlocks: [
          {
            sequence: 0,
            blockType: 'SUMMARY',
            content: '旧的结构化块',
          },
        ],
      },
      undefined,
    );

    expect(blocks[0]).toEqual(
      expect.objectContaining({
        blockType: 'REPORT',
      }),
    );
    expect(blocks[0].content).toContain('山东区');
    expect(blocks[0].content).toContain('26.5 万元');
    expect(blocks[0].content).toContain('数量：44');
    expect(blocks[0].content).not.toContain('1. 山东区：26.5 万元');
  });

  it('客户未报备商机和创建时长问句应被识别为企微经营分析信号', () => {
    const service = createService() as any;

    expect(
      service.hasAnalysisReportSignal(
        '有多少客户是没有报备商机的，分别创建了多长时间',
      ),
    ).toBe(true);
  });

  it('300 问目录命中问题不应被空闲帮助菜单兜底吞掉', () => {
    const service = createService() as any;
    const idleContext = {
      workMemory: {},
    };

    expect(service.hasCrmAnalysisQuestionCatalogSignal('本月经营总览情况')).toBe(true);
    expect(service.hasCrmAnalysisQuestionCatalogSignal('哪些报价最可能本周转订单')).toBe(true);
    expect(
      service.shouldReturnIdleUnrecognizedHelp(
        idleContext,
        '本月经营总览情况',
        { fallbackReason: 'PACK_NONE' },
      ),
    ).toBe(false);
    expect(
      service.shouldReturnIdleUnrecognizedHelp(
        idleContext,
        '哪些报价最可能本周转订单',
        { fallbackReason: 'PROVIDER_TIMEOUT' },
      ),
    ).toBe(false);
  });

  it('重发上一轮图表结果时应发送模板卡片和图片附件', async () => {
    const service = createService() as any;
    const dispatch = jest.fn(async () => ({
      status: 'SENT',
      deliveredCount: 2,
      failedCount: 0,
    }));
    const appendAssistantTurn = jest.fn();

    service.analysisService = {
      getQueryDetail: jest.fn(() => ({
        groundedMarkdown: '## 上一轮结果\n- 山东区服务商商机金额排名。',
        report: {
          reportTitle: '山东区服务商商机分布',
          executiveSummary: '山东区共有 5 家服务商存在商机。',
          metricCards: [{ name: '累计商机金额', value: '15 万元' }],
          variant: 'distribution',
        },
        tableRows: [
          {
            partnerName: '山东华安赛服智能科技有限公司',
            amount: 100000,
            count: 8,
          },
        ],
        streamBlocks: [],
      })),
    };
    service.wecomAnalysisTableImageService = {
      renderTableImage: jest.fn(async () => ({
        filename: 'analysis.png',
        buffer: Buffer.from('image'),
        previewText: '山东区服务商商机分布图',
      })),
    };
    service.localRuntimeConfigService = {
      getWecomRuntimeConfig: jest.fn(() => ({
        webBaseUrl: 'http://127.0.0.1:5173',
      })),
    };
    service.wecomStreamDispatcherService = {
      dispatch,
      buildExplanationBlocks: jest.fn((content: string) => [
        { sequence: 0, blockType: 'REPORT', content },
      ]),
      buildBlockedBlocks: jest.fn((content: string) => [
        { sequence: 0, blockType: 'REPORT', content },
      ]),
    };
    service.wecomAiConversationOrchestrationService = {
      appendAssistantTurn,
    };
    service.querySessionRepository = {
      save: jest.fn((value) => value),
    };
    service.auditEventRepository = {
      create: jest.fn(),
    };
    service.auditEventBuilderService = {
      crmUserActor: jest.fn(() => ({
        actorId: 'crm_user_1',
        actorRoleIds: ['role_sales'],
        actorType: 'crm-user',
        actorBindingStatus: 'BOUND_CRM',
      })),
      channelAgent: jest.fn(() => ({
        channel: 'wecom-bot',
        channelAgentType: 'wecom-bot',
      })),
    };
    service.userScopeService = {
      resolveScope: jest.fn(() => ({
        organizationIds: [],
        departmentIds: [],
        ownerIds: ['crm_user_1'],
        scopeSummary: '测试权限范围',
      })),
    };

    const result = await service.handleAnalysisResultRedisplay({
      user: {
        id: 'crm_user_1',
        name: '测试用户',
        roleIds: ['role_sales'],
      },
      session: {
        id: 'session_1',
        requesterId: 'crm_user_1',
        requesterRoleIds: ['role_sales'],
        externalConversationId: 'chat_1',
        contextStatus: 'EXECUTING',
      },
      receipt: {
        id: 'receipt_1',
        channelMessageId: 'msg_1',
        externalConversationId: 'chat_1',
        senderId: 'wx_user_1',
        chatType: 'single',
        messageType: 'text',
        status: 'ACCEPTED',
        createdAt: '2026-06-08T00:00:00.000Z',
        updatedAt: '2026-06-08T00:00:00.000Z',
      },
      inboundMessage: {
        chatType: 'single',
        deliveryTargetId: 'wx_user_1',
        senderId: 'wx_user_1',
        externalConversationId: 'chat_1',
        messageText: '看分布图',
        rawPayload: {},
        receivedAt: '2026-06-08T00:00:00.000Z',
      },
      conversationContext: {
        id: 'ctx_1',
      },
      conversationDecision: {
        action: 'REDISPLAY_RESULT',
        redisplayMode: 'IMAGE',
        redisplayQueryId: 'analysis_query_latest',
        context: {} as never,
      },
    });

    expect(result.status).toBe('REDISPLAYED');
    expect(service.analysisService.getQueryDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'crm_user_1' }),
      'analysis_query_latest',
      'wecom-bot',
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        queryId: 'analysis_query_latest',
        blocks: [
          expect.objectContaining({
            blockType: 'REPORT',
            content: expect.stringContaining('山东华安赛服智能科技有限公司'),
          }),
        ],
        templateCards: [
          expect.objectContaining({
            contentPreview: expect.stringContaining('模板卡片摘要'),
            templateCard: expect.objectContaining({
              quote_area: expect.objectContaining({
                quote_text: expect.stringContaining('山东华安赛服智能科技有限公司'),
              }),
            }),
          }),
        ],
        imageAttachments: [
          expect.objectContaining({
            sequence: 9200,
            filename: 'analysis.png',
          }),
        ],
      }),
    );
    expect(service.wecomAnalysisTableImageService.renderTableImage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '山东区服务商商机分布',
        variant: 'distribution',
        layout: 'card',
        rows: [
          {
            partnerName: '山东华安赛服智能科技有限公司',
            amount: 100000,
            count: 8,
          },
        ],
      }),
    );
    expect(appendAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ctx_1' }),
      expect.stringContaining('山东华安赛服智能科技有限公司'),
      'analysis_query_latest',
    );
  });

  it('多区块分析结果应生成企微图片附件', async () => {
    const service = createService() as any;
    const renderTableImage = jest.fn().mockResolvedValueOnce({
      filename: 'opportunities.png',
      buffer: Buffer.from('opportunities-image'),
      previewText: '商机增长情况图片',
    });
    service.wecomAnalysisTableImageService = {
      renderTableImage,
    };

    const attachments = await service.buildAnalysisImageAttachments({
      report: {
        reportTitle: '最近三个月渠道经营变化',
        executiveSummary: '已按渠道商新增和商机增长拆分展示。',
        metricCards: [{ name: '新增渠道商', value: 3 }],
        variant: 'trend',
      },
      secondaryViews: [
        {
          viewType: 'DETAIL_TABLE',
          title: '渠道商新增情况',
          rows: [{ month_label: '2026-04', new_partner_count: 1 }],
        },
        {
          viewType: 'LINE_CHART',
          title: '商机增长情况',
          rows: [{ month_label: '2026-04', new_opportunity_count: 5, opportunity_amount: 120000 }],
        },
      ],
      tableRows: [{ section_name: '汇总', row_count: 2 }],
    });

    expect(renderTableImage).toHaveBeenCalledTimes(1);
    expect(renderTableImage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '商机增长情况',
        variant: 'trend',
        layout: 'card',
        rows: [{ month_label: '2026-04', new_opportunity_count: 5, opportunity_amount: 120000 }],
      }),
    );
    expect(attachments).toEqual([
      expect.objectContaining({
        sequence: 9200,
        filename: 'opportunities.png',
      }),
    ]);
  });

  it('分析结果应生成企微模板卡片摘要', () => {
    const service = createService() as any;
    service.localRuntimeConfigService = {
      getWecomRuntimeConfig: jest.fn(() => ({
        webBaseUrl: 'http://127.0.0.1:5173',
      })),
    };

    const cards = service.buildAnalysisTemplateCards(
      {
        report: {
          reportTitle: '最近一年全国订单与商机分块分析',
          executiveSummary: '已按订单情况和商机情况拆分展示。',
          metricCards: [
            { name: '有效订单数量', value: 5 },
            { name: '有效订单金额', value: '78 万元' },
            { name: '商机数量', value: 20 },
            { name: '商机金额', value: '20 万元' },
          ],
        },
      },
      {
        hasImageAttachments: false,
        queryId: 'analysis_query_1',
      },
    );

    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual(
      expect.objectContaining({
        sequence: 8000,
        contentPreview: expect.stringContaining('模板卡片摘要'),
      }),
    );
    expect(cards[0].templateCard).toEqual(
      expect.objectContaining({
        card_type: 'text_notice',
        source: expect.objectContaining({
          desc: 'CRM智能分析',
        }),
        main_title: expect.objectContaining({
          title: expect.stringContaining('最近一年全国订单'),
        }),
        emphasis_content: {
          title: '5',
          desc: '有效订单数量',
        },
        card_action: {
          type: 1,
          url: 'http://127.0.0.1:3001/api/v1/public/analysis-results/analysis_query_1/file',
        },
      }),
    );
  });

  it('组合经营模板卡片应优先展示四段经营指标而不是单独突出订单金额', () => {
    const service = createService() as any;
    service.localRuntimeConfigService = {
      getWecomRuntimeConfig: jest.fn(() => ({
        webBaseUrl: 'http://127.0.0.1:5173',
      })),
    };

    const cards = service.buildAnalysisTemplateCards(
      {
        report: {
          reportTitle: '合作伙伴开拓、客户报备与订单经营分析报告',
          executiveSummary: '已按合作伙伴开拓、客户报备、商机和订单拆分展示。',
          metricCards: [
            { name: '服务商数量', value: 173 },
            { name: '合作等级数', value: 4 },
            { name: '累计订单金额', value: '98 万元' },
            { name: '命中订单数', value: 3 },
            { name: '累计商机金额', value: '420 万元' },
            { name: '命中商机数', value: 44 },
            { name: '命中报备数', value: 152 },
          ],
        },
      },
      {
        hasImageAttachments: false,
        queryId: 'analysis_query_composite',
      },
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].templateCard).toEqual(
      expect.objectContaining({
        emphasis_content: {
          title: '173',
          desc: '服务商数量',
        },
        sub_title_text: expect.stringContaining('合作伙伴开拓'),
        horizontal_content_list: expect.arrayContaining([
          { keyname: '命中报备数', value: '152' },
          { keyname: '命中商机数', value: '44' },
          { keyname: '累计商机…', value: '420 万元' },
        ]),
      }),
    );
  });

  it('模板卡片应优先体现用户本轮要求的业务区块', () => {
    const service = createService() as any;
    service.localRuntimeConfigService = {
      getWecomRuntimeConfig: jest.fn(() => ({
        webBaseUrl: 'http://127.0.0.1:5173',
      })),
    };

    const cards = service.buildAnalysisTemplateCards(
      {
        questionText: '山东区域有多少个渠道商，分别是什么类型的单独列一下',
        report: {
          reportTitle: '渠道商类型明细报告',
          executiveSummary: '山东区域渠道商类型明细已生成。',
          metricCards: [
            { name: '渠道商数量', value: 2 },
            { name: '技术服务商', value: 1 },
          ],
          tableBlocks: [
            {
              title: '渠道商类型明细',
              rows: [
                { partnerName: '山东诚卓信息技术有限公司', partnerType: '渠道商' },
                { partnerName: '山东旭正信息科技有限公司', partnerType: '技术服务商' },
              ],
            },
          ],
        },
      },
      {
        hasImageAttachments: false,
        queryId: 'analysis_query_partner_type',
      },
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].templateCard).toEqual(
      expect.objectContaining({
        main_title: expect.objectContaining({
          desc: expect.stringContaining('山东区域渠道商类型'),
        }),
        sub_title_text: expect.stringContaining('渠道商类型'),
        horizontal_content_list: expect.arrayContaining([
          { keyname: '渠道商类型', value: '已生成 2 条' },
        ]),
      }),
    );
  });

  it('看板桥接回复应按经营模板补齐核心维度和替代口径提示', () => {
    const service = createService() as any;
    service.analysisLoggerService = {
      logInfo: jest.fn(),
    };

    const result = service.convertDashboardResultToWecomFormat(
      {
        reportTitle: '联软 CRM 数据运营分析看板',
        executiveSummary: '渠道档案完整，商机和报价已沉淀，订单暂未沉淀。',
        dataSource: 'OPENAPI_REALTIME',
        fetchedAt: '2026-06-30T00:00:00.000Z',
        scopeSummary: '当前用户权限范围',
        errors: [],
        blocks: [
          {
            blockId: 'dashboard-kpi',
            blockType: 'kpi-matrix',
            title: '核心指标',
            metrics: [
              { label: '渠道商总数', value: '173', unit: '家' },
              { label: '报备数', value: '120', unit: '个' },
              { label: '商机金额', value: '350.00', unit: '万' },
            ],
          },
          {
            blockId: 'dashboard-funnel',
            blockType: 'funnel',
            title: '业务转化漏斗',
            stages: [
              { name: '客户报备', value: 120 },
              { name: '商机', value: 85, amount: 3500000, rate: 0.708 },
              { name: '报价', value: 42, amount: 2000000, rate: 0.494 },
              { name: '订单', value: 0, amount: 0, rate: 0 },
            ],
            insights: ['报价转订单率 0.0%'],
          },
          {
            blockId: 'dashboard-concentration',
            blockType: 'concentration',
            title: '渠道集中度分析（按报价金额）',
            totalValue: 560000,
            totalUnits: 3,
            tiers: [{ label: 'TOP3', value: 560000, count: 3, percentage: 100 }],
            insights: ['TOP3 渠道贡献了 100.0% 的报价金额'],
          },
          {
            blockId: 'dashboard-province-map',
            blockType: 'geo-map',
            title: '省份覆盖',
            mapName: 'china',
            regions: [
              {
                name: '山东',
                value: 8,
                coveredCityCount: 1,
                totalCityCount: 16,
                cityGroups: [
                  {
                    cityName: '济南',
                    partnerCount: 8,
                    partners: ['济南核心渠道商'],
                  },
                ],
              },
              { name: '北京', value: 2 },
            ],
            coveredRegionCount: 2,
            totalRegionCount: 31,
            coveredCityCount: 2,
            totalCityCount: 321,
          },
          {
            blockId: 'dashboard-region-comparison',
            blockType: 'grouped-bar',
            title: '区域报价金额对比',
            categories: ['山东区', '北京区'],
            series: [{ name: '报价金额', values: [56, 20] }],
            unitLabel: '万',
            description: '同类对比：每根柱子均为区域维度下的报价金额。',
          },
          {
            blockId: 'dashboard-cooperation',
            blockType: 'pie-distribution',
            title: '合作级别分布',
            segments: [
              { name: '金牌', value: 21 },
              { name: '未设置', value: 12 },
            ],
            unitLabel: '家',
          },
          {
            blockId: 'dashboard-partner-ranking',
            blockType: 'sortable-table',
            title: '渠道贡献排行（按报价金额）',
            columns: [],
            rows: [
              {
                rank: 1,
                name: '山东示例渠道',
                region: '山东',
                registrationCount: 15,
                opportunityCount: 12,
                opportunityAmount: 800000,
                quoteCount: 8,
                quoteAmount: 500000,
                orderCount: 0,
                orderAmount: 0,
              },
              {
                rank: 2,
                name: '北京示例渠道',
                region: '北京',
                registrationCount: 10,
                opportunityCount: 8,
                opportunityAmount: 600000,
                quoteCount: 5,
                quoteAmount: 300000,
                orderCount: 0,
                orderAmount: 0,
              },
            ],
          },
        ],
      },
      '全国渠道商发展运营数据看板',
      'dashboard_query_test',
    );

    const content = result.dispatchBlocks[0].content;
    expect(result.templateCards[0].templateCard).toEqual(
      expect.objectContaining({
        card_type: 'text_notice',
        source: expect.objectContaining({
          desc: 'CRM智能助手',
        }),
        main_title: expect.objectContaining({
          title: '经营总览看板',
          desc: expect.stringContaining('CRM OpenAPI'),
        }),
        emphasis_content: expect.objectContaining({
          title: '173家',
          desc: expect.stringContaining('渠道商'),
        }),
        sub_title_text: expect.stringContaining('渠道档案完整'),
        quote_area: expect.objectContaining({
          title: '关键发现',
          quote_text: expect.stringContaining('最大断点'),
        }),
        horizontal_content_list: expect.arrayContaining([
          { keyname: '报备数', value: '120个' },
          { keyname: '商机金额', value: '350.00万' },
        ]),
        jump_list: expect.arrayContaining([
          expect.objectContaining({
            title: '打开备查报告',
            url: expect.any(String),
          }),
        ]),
        card_action: expect.objectContaining({
          type: 1,
          url: expect.any(String),
        }),
        feedback: {
          id: 'dashboard_query_test',
        },
      }),
    );
    expect(result.dashboardTemplate).toEqual({
      code: 'BUSINESS_OVERVIEW',
      displayName: '经营总览看板卡',
      cardTitle: '经营总览看板',
    });
    expect(result.publicSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sectionType: 'DASHBOARD_TEMPLATE',
        title: '经营总览看板展示分区',
        rows: expect.arrayContaining([
          expect.objectContaining({
            blockType: 'kpi-matrix',
            title: '核心指标',
          }),
        ]),
      }),
      expect.objectContaining({
        sectionType: 'DASHBOARD_CHART',
        chartType: 'funnel',
        chartData: expect.objectContaining({
          stages: expect.arrayContaining([
            expect.objectContaining({ name: '客户报备', value: 120 }),
          ]),
        }),
      }),
      expect.objectContaining({
            sectionType: 'DASHBOARD_GEO_MAP',
            chartType: 'geo-map',
            rows: expect.arrayContaining([
              expect.objectContaining({
                province: '山东',
                partnerCount: 8,
                coveredCityCount: 1,
                cityGroups: expect.arrayContaining([
                  expect.objectContaining({
                    cityName: '济南',
                    partners: ['济南核心渠道商'],
                  }),
                ]),
              }),
            ]),
            chartData: expect.objectContaining({
              coveredCityCount: 2,
              regions: expect.arrayContaining([
                expect.objectContaining({
                  name: '山东',
                  value: 8,
                  coveredCityCount: 1,
                }),
              ]),
            }),
          }),
      expect.objectContaining({
        sectionType: 'DASHBOARD_CHART',
        chartType: 'pie-distribution',
        chartData: expect.objectContaining({
          segments: expect.arrayContaining([
            expect.objectContaining({ name: '金牌', value: 21 }),
          ]),
        }),
      }),
    ]));
    expect(content).toContain('【展示模板】经营总览看板卡');
    expect(content).toContain('【权限口径】');
    expect(content).toContain('【核心经营判断】');
    expect(content).toContain('【核心指标】');
    expect(content).toContain('【业务漏斗与趋势】');
    expect(content).toContain('【渠道集中度】');
    expect(content).toContain('【区域覆盖与业务分布】');
    expect(content).toContain('【渠道贡献排行】');
    expect(content).toContain('【渠道结构与状态分布】');
    expect(content).toContain('【风险建议】');
    expect(content).toContain('不能等同真实成交');
    expect(content).toContain('报价金额前3');
    expect(content).toContain('订单金额前3：暂无真实订单金额沉淀');
    expect(content).toContain('问题：订单数据不足');
    expect(content).toContain('合作级别分布存在未设置');
  });

  it.each([
    ['BUSINESS_OVERVIEW', 'map'],
    ['FUNNEL_DIAGNOSIS', 'trend'],
    ['CHANNEL_RANKING', 'ranking'],
    ['REGION_COMPARISON', 'map'],
    ['CHANNEL_PROFILE', 'distribution'],
    ['REGISTRATION_PROTECTION', 'ranking'],
    ['OPPORTUNITY_RISK', 'distribution'],
    ['QUOTE_TO_ORDER', 'ranking'],
    ['RENEWAL_SUCCESS', 'trend'],
    ['PRODUCT_SOLUTION', 'distribution'],
    ['SERVICE_ECOSYSTEM', 'distribution'],
    ['DISTRIBUTION_HEALTH', 'distribution'],
    ['CADENCE_REPORT', 'trend'],
    ['DATA_SCOPE_QUALITY', 'summary'],
  ])('14 类模板 %s 应生成图片看板附件', async (templateCode, expectedVariant) => {
    const service = createService() as any;
    const renderTableImage = jest.fn(async () => ({
      filename: 'dashboard.png',
      buffer: Buffer.from('dashboard-image'),
      previewText: '动态看板图片',
    }));
    service.wecomAnalysisTableImageService = {
      renderTableImage,
    };

    const attachments = await service.buildDashboardImageAttachments(
      {
        reportTitle: '联软 CRM 数据运营分析看板',
        executiveSummary: '动态看板已生成。',
        dataSource: 'OPENAPI_REALTIME',
        fetchedAt: '2026-07-01T00:00:00.000Z',
        scopeSummary: '当前用户权限范围',
        errors: [],
        blocks: [],
      },
      {
        dashboardTemplate: {
          code: templateCode,
          cardTitle: '动态看板',
        },
        metricCardsForDetail: [
          { name: '渠道商总数', value: '173家' },
          { name: '商机金额', value: '175万' },
        ],
        tableBlocksForDetail: [
          {
            title: '明细',
            rows: [{ name: '山东示例渠道', amount: 1750000 }],
          },
        ],
      },
    );

    expect(renderTableImage).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '动态看板图片看板',
        variant: expectedVariant,
        rows: [{ name: '山东示例渠道', amount: 1750000 }],
      }),
    );
    expect(attachments).toEqual([
      expect.objectContaining({
        sequence: 9000,
        filename: 'dashboard.png',
        contentPreview: expect.stringContaining('动态看板图片看板'),
      }),
    ]);
  });

  it('P2 图片看板生成失败时应降级为空附件且不影响正文卡片', async () => {
    const service = createService() as any;
    const logWarn = jest.fn();
    service.analysisLoggerService = {
      logWarn,
    };
    service.wecomAnalysisTableImageService = {
      renderTableImage: jest.fn(async () => {
        throw new Error('图片服务不可用');
      }),
    };

    const attachments = await service.buildDashboardImageAttachments(
      {
        reportTitle: '联软 CRM 数据运营分析看板',
        executiveSummary: '动态看板已生成。',
        dataSource: 'OPENAPI_REALTIME',
        fetchedAt: '2026-07-01T00:00:00.000Z',
        scopeSummary: '当前用户权限范围',
        errors: [],
        blocks: [],
      },
      {
        dashboardTemplate: {
          code: 'BUSINESS_OVERVIEW',
          cardTitle: '经营总览看板',
        },
        metricCardsForDetail: [{ name: '渠道商总数', value: '173家' }],
        tableBlocksForDetail: [],
      },
    );

    expect(attachments).toEqual([]);
    expect(logWarn).toHaveBeenCalledWith(
      '企微动态看板图片生成失败，已降级为卡片和正文。',
      expect.objectContaining({
        templateCode: 'BUSINESS_OVERVIEW',
        reason: '图片服务不可用',
      }),
    );
  });

  it('公开 HTML 完整报告应渲染动态看板折线图、占比图和全国地图', () => {
    const controller = new PublicAnalysisResultController({} as never, {} as never) as any;

    const html = controller.renderPublicResultHtml({
      title: '技术服务商生态分析',
      summary: '已生成技术服务商全国开拓情况。',
      completedAt: '2026-07-01T00:00:00.000Z',
      report: {
        reportTitle: '技术服务商生态分析',
        executiveSummary: '已生成技术服务商全国开拓情况。',
        metricCards: [{ name: '签约技术服务商', value: '26家' }],
        dashboardTemplate: {
          code: 'SERVICE_ECOSYSTEM',
          displayName: '技术服务商生态卡',
          cardTitle: '技术服务商生态',
        },
        sections: [
          {
            sectionType: 'DASHBOARD_CHART',
            title: '技术服务商新增趋势',
            chartType: 'composite-trend',
            chartData: {
              categories: ['2026-04', '2026-05'],
              barSeries: [{ name: '新增技术服务商', values: [3, 8] }],
              lineSeries: [{ name: '累计签约', values: [18, 26] }],
            },
          },
          {
            sectionType: 'DASHBOARD_CHART',
            title: '技术服务商类型占比',
            chartType: 'pie-distribution',
            chartData: {
              segments: [
                { name: '签约技术服务商', value: 26 },
                { name: '提名技术服务商', value: 121 },
              ],
            },
          },
          {
            sectionType: 'DASHBOARD_GEO_MAP',
            title: '技术服务商全国覆盖地图',
            chartType: 'geo-map',
            rows: [{ province: '山东', partnerCount: 8 }],
            chartData: {
              regions: [{ name: '山东', value: 8 }],
              coveredRegionCount: 1,
              totalRegionCount: 31,
              unitLabel: '家',
            },
          },
        ],
      },
    });

    expect(html).toContain('echarts.min.js');
    expect(html).toContain('../../analysis-assets/echarts.min.js');
    expect(html).not.toContain('china.min.js');
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).toContain('__CRM_LOCAL_CHINA_GEO_JSON__');
    expect(html).toContain("registerMap('china'");
    expect(html).toContain("type: 'line'");
    expect(html).toContain("type: 'pie'");
    expect(html).toContain("type: 'map'");
    expect(html).toContain("chart.on('dblclick'");
    expect(html).toContain('技术服务商全国覆盖地图');
    expect(html).toContain('dashboard-chart--map');
  });

  it.each([
    ['全国渠道商发展运营情况', '经营总览看板'],
    ['报备到订单转化漏斗断点在哪里', '业务漏斗诊断'],
    ['哪些渠道贡献最大，前十渠道是谁', '渠道贡献排行'],
    ['山东区渠道经营表现如何', '区域经营对比'],
    ['哪些渠道活跃，哪些渠道需要激活', '渠道画像诊断'],
    ['哪些客户报备快到期，有没有重复报备', '报备保护与渠道冲突'],
    ['预计签约但还没有报价的商机有哪些', '商机风险清单'],
    ['本周哪些报价最可能转订单', '报价转订单预测'],
    ['哪些客户 30 天内需要续费', '续费与客户成功'],
    ['终端安全相关商机和报价情况怎么样', '产品与解决方案结构'],
    ['技术服务商发展情况怎么样', '技术服务商生态'],
    ['一级二级渠道协同是否正常', '分销层级健康'],
    ['生成本周经营复盘', '经营节奏报告'],
    ['当前数据口径是否受我的权限影响', '数据质量与权限口径'],
  ])('看板桥接应将问题“%s”转换为动态卡片“%s”', (questionText, expectedCardTitle) => {
    const service = createService() as any;
    service.analysisLoggerService = {
      logInfo: jest.fn(),
    };

    const result = service.convertDashboardResultToWecomFormat(
      {
        reportTitle: '联软 CRM 数据运营分析看板',
        executiveSummary: '已生成动态模板卡片。',
        dataSource: 'OPENAPI_REALTIME',
        fetchedAt: '2026-07-01T00:00:00.000Z',
        scopeSummary: '当前用户权限范围',
        errors: [],
        blocks: [
          {
            blockId: 'dashboard-kpi',
            blockType: 'kpi-matrix',
            title: '核心指标',
            metrics: [
              { label: '渠道商总数', value: '173', unit: '家' },
              { label: '报备数', value: '150', unit: '个' },
              { label: '商机金额', value: '175.00', unit: '万' },
              { label: '报价金额', value: '48.41', unit: '万' },
            ],
          },
          {
            blockId: 'dashboard-funnel',
            blockType: 'funnel',
            title: '业务转化漏斗',
            stages: [
              { name: '客户报备', value: 150 },
              { name: '商机', value: 42, rate: 0.28 },
              { name: '报价', value: 3, rate: 0.071 },
              { name: '订单', value: 1, rate: 0.333 },
            ],
          },
          {
            blockId: 'dashboard-concentration',
            blockType: 'concentration',
            title: '渠道集中度分析',
            totalValue: 484100,
            totalUnits: 3,
            tiers: [{ label: 'TOP3', value: 484100, count: 3, percentage: 88.8 }],
            oneTimeCount: 20,
            insights: [],
          },
          {
            blockId: 'dashboard-province-map',
            blockType: 'geo-map',
            title: '省份覆盖',
            mapName: 'china',
            regions: [{ name: '山东', value: 8 }],
            coveredRegionCount: 1,
            totalRegionCount: 31,
          },
        ],
      },
      questionText,
      `dashboard_query_${expectedCardTitle}`,
    );

    expect(result.templateCards[0].templateCard).toEqual(
      expect.objectContaining({
        main_title: expect.objectContaining({
          title: expectedCardTitle,
        }),
        horizontal_content_list: expect.any(Array),
        feedback: {
          id: `dashboard_query_${expectedCardTitle}`,
        },
      }),
    );
  });

  it('readonly CRM lookup must not fallback to writeback builtin account', async () => {
    const service = createService() as any;
    const builtinTokenService = {
      getBuiltinWriteAccessToken: jest.fn(),
      clearBuiltinAccessTokenCache: jest.fn(),
    };
    service.authSessionRepository = {
      findActiveByRequesterId: jest.fn(() => [
        {
          crmAccessToken: 'expired-user-token',
        },
      ]),
    };
    service.localRuntimeConfigService = {
      getCrmAuthConfig: jest.fn(() => ({
        mockEnabled: false,
      })),
    };
    service.analysisLoggerService = {
      logWarn: jest.fn(),
    };
    service.crmBuiltinAccountTokenService = builtinTokenService;

    await expect(
      service.executeWecomCrmReadWithTokenRetry({
        user: {
          id: 'crm_user_1',
          name: '测试用户',
        },
        operationLabel: '商机查询',
        operationKey: 'opportunity-detail',
        executor: jest.fn(async () => {
          const { UnauthorizedException } = await import('@nestjs/common');
          throw new UnauthorizedException('expired');
        }),
      }),
    ).rejects.toThrow('只读查询不会使用企业微信写回内置账号');

    expect(builtinTokenService.getBuiltinWriteAccessToken).not.toHaveBeenCalled();
    expect(service.analysisLoggerService.logWarn).toHaveBeenCalledWith(
      expect.stringContaining('只读查询检测到当前 CRM 登录态不可用'),
      expect.objectContaining({
        operationKey: 'opportunity-detail',
      }),
    );
  });

  it('writeback pre-refresh may explicitly use builtin writeback fallback', async () => {
    const service = createService() as any;
    const builtinTokenService = {
      getBuiltinWriteAccessToken: jest.fn(async () => 'builtin-write-token'),
      clearBuiltinAccessTokenCache: jest.fn(),
    };
    service.authSessionRepository = {
      findActiveByRequesterId: jest.fn(() => [
        {
          crmAccessToken: 'expired-user-token',
        },
      ]),
    };
    service.crmFollowUpWritebackService = {
      resolveWecomBotAccessToken: jest.fn(async (token?: string) =>
        token ?? 'stale-builtin-token',
      ),
    };
    service.crmBuiltinAccountTokenService = builtinTokenService;
    service.analysisLoggerService = {
      logWarn: jest.fn(),
    };

    const executor = jest
      .fn()
      .mockImplementationOnce(async () => {
        const { UnauthorizedException } = await import('@nestjs/common');
        throw new UnauthorizedException('expired');
      })
      .mockImplementationOnce(async () => {
        const { UnauthorizedException } = await import('@nestjs/common');
        throw new UnauthorizedException('stale builtin');
      })
      .mockImplementationOnce(async (accessToken?: string) => ({
        accessToken,
      }));

    await expect(
      service.executeWecomCrmReadWithTokenRetry({
        user: {
          id: 'crm_user_1',
          name: '测试用户',
        },
        operationLabel: '商机写回前对象刷新',
        operationKey: 'opp_1',
        allowBuiltinWritebackFallback: true,
        executor,
      }),
    ).resolves.toEqual({
      accessToken: 'builtin-write-token',
    });

    expect(builtinTokenService.getBuiltinWriteAccessToken).toHaveBeenCalledWith(true);
  });
});
