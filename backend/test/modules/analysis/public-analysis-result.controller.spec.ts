import { PublicAnalysisResultController } from '../../../src/modules/analysis/public-analysis-result.controller';

/**
 * 构造公开分析结果控制器测试夹具。
 *
 * 参数说明：无。
 * 返回值说明：返回可直接调用私有渲染方法的控制器实例。
 * 调用注意事项：这里不启动 Nest，只验证 HTML 渲染规则，避免引入公开查询仓储依赖。
 */
function createController(): PublicAnalysisResultController {
  return new PublicAnalysisResultController({} as never, {} as never);
}

/**
 * 调用公开结果 HTML 渲染方法。
 *
 * 参数说明：`controller` 为测试控制器，`payload` 为最小公开结果包。
 * 返回值说明：返回完整 HTML 字符串。
 * 调用注意事项：生产入口仍走控制器公开方法，测试只穿透私有方法校验展示边界。
 */
function renderPublicResultHtml(
  controller: PublicAnalysisResultController,
  payload: Record<string, unknown>,
): string {
  return (
    controller as unknown as {
      renderPublicResultHtml(payload: Record<string, unknown>): string;
    }
  ).renderPublicResultHtml(payload);
}

describe('PublicAnalysisResultController', () => {
  it('明细超过7条时应渲染为卡片内下拉滚动表格', () => {
    const controller = createController();
    const rows = Array.from({ length: 8 }, (_, index) => ({
      opportunity_name: `测试商机${index + 1}`,
      customer_name: `测试客户${index + 1}`,
      stale_days: index + 30,
    }));

    const html = renderPublicResultHtml(controller, {
      title: '超过30天未更新商机明细报告',
      report: {
        reportTitle: '超过30天未更新商机明细报告',
        tableBlocks: [
          {
            title: '超过30天未更新商机明细',
            rows,
          },
        ],
      },
    });

    expect(html).toContain('class="table-wrap table-wrap--dropdown"');
    expect(html).toContain('共 <strong>8</strong> 条明细');
    expect(html).toContain('测试商机1');
    expect(html).toContain('测试商机8');
    expect(html).not.toContain('<details class="detail-toggle">');
  });

  it('明细不超过7条时应保持普通卡片表格', () => {
    const controller = createController();
    const rows = Array.from({ length: 7 }, (_, index) => ({
      opportunity_name: `测试商机${index + 1}`,
      stale_days: index + 30,
    }));

    const html = renderPublicResultHtml(controller, {
      title: '超过30天未更新商机明细报告',
      report: {
        reportTitle: '超过30天未更新商机明细报告',
        tableBlocks: [
          {
            title: '超过30天未更新商机明细',
            rows,
          },
        ],
      },
    });

    expect(html).not.toContain('class="table-wrap table-wrap--dropdown"');
    expect(html).toContain('测试商机7');
  });

  it('报告存在多张明细表时应逐张应用超过7条下拉规则', () => {
    const controller = createController();
    const opportunityRows = Array.from({ length: 8 }, (_, index) => ({
      opportunity_name: `测试商机${index + 1}`,
      stale_days: index + 30,
    }));
    const orderRows = Array.from({ length: 9 }, (_, index) => ({
      order_name: `测试订单${index + 1}`,
      order_amount: 10000 + index,
    }));

    const html = renderPublicResultHtml(controller, {
      title: '组合经营分析报告',
      report: {
        reportTitle: '组合经营分析报告',
        tableBlocks: [
          {
            title: '超过30天未更新商机明细',
            rows: opportunityRows,
          },
          {
            title: '渠道下单明细',
            rows: orderRows,
          },
        ],
      },
    });

    expect((html.match(/class="table-wrap table-wrap--dropdown"/gu) ?? []).length).toBe(2);
    expect(html).toContain('超过30天未更新商机明细');
    expect(html).toContain('渠道下单明细');
    expect(html).toContain('测试商机8');
    expect(html).toContain('测试订单9');
  });

  it('公开 HTML 不应渲染关键发现和统计口径区块', () => {
    const controller = createController();

    const html = renderPublicResultHtml(controller, {
      title: '组合经营分析报告',
      scopeSummary: '全部权限',
      appliedFilters: [{ label: '数据来源', value: '本地 OpenAPI Markdown 快照' }],
      report: {
        reportTitle: '组合经营分析报告',
        keyFindings: [{ title: '头部服务商集中', detail: '服务商 A 贡献较高。' }],
        sourceNotes: [
          {
            key: 'snapshot',
            label: '数据来源',
            description: '本地 OpenAPI Markdown 快照',
          },
        ],
        footnotes: ['OpenAPI 仅用于刷新快照文件。'],
        tableBlocks: [
          {
            title: '商机明细',
            rows: [{ opportunity_name: '测试商机1' }],
          },
        ],
      },
    });

    expect(html).not.toContain('<h2>关键发现</h2>');
    expect(html).not.toContain('头部服务商集中');
    expect(html).not.toContain('<h2>统计口径与数据来源</h2>');
    expect(html).not.toContain('OpenAPI 仅用于刷新快照文件。');
    expect(html).toContain('商机明细');
    expect(html).toContain('测试商机1');
  });

  it('业务链汇总表应使用中文业务列名并隐藏重复负责人列', () => {
    const controller = createController();

    const html = renderPublicResultHtml(controller, {
      title: '渠道商商机与订单分析报告',
      report: {
        reportTitle: '渠道商商机与订单分析报告',
        tableBlocks: [
          {
            title: '渠道商、商机与订单经营分析明细',
            rows: [
              {
                ownerName: '合作伙伴开拓情况',
                businessSection: '合作伙伴开拓情况',
                dataEndpoint: 'READ details/partners.md',
                count: 16,
                amount: 0,
                statisticScope: '本地 OpenAPI Markdown 快照真实明细聚合',
              },
            ],
          },
        ],
      },
    });

    expect(html).toContain('<th>经营区块</th>');
    expect(html).toContain('<th>数据文件</th>');
    expect(html).toContain('<th>统计口径</th>');
    expect(html).not.toContain('<th>字段2</th>');
    expect(html).not.toContain('<th>字段3</th>');
    expect(html).not.toContain('<th>负责人</th>');
  });

  it('商机趋势和阶段聚合表不应把月份或阶段误展示为负责人', () => {
    const controller = createController();

    const html = renderPublicResultHtml(controller, {
      title: '商机数量趋势分析报告',
      report: {
        reportTitle: '商机数量趋势分析报告',
        tableBlocks: [
          {
            title: '商机数量趋势分析明细',
            rows: [
              {
                ownerName: '2026-05',
                amount: 150000,
                count: 34,
                bucket_label: '2026-05',
                month_label: '2026-05',
              },
              {
                ownerName: '2026-06',
                amount: 148800,
                count: 4,
                bucket_label: '2026-06',
                month_label: '2026-06',
              },
            ],
          },
          {
            title: '商机数量阶段分布明细',
            rows: [
              {
                ownerName: '已接触',
                amount: 186500,
                count: 6,
                bucket_label: '已接触',
                stage: '已接触',
              },
              {
                ownerName: '20%已登记/已报备',
                amount: 100000,
                count: 2,
                bucket_label: '20%已登记/已报备',
                stage: '20%已登记/已报备',
              },
            ],
          },
        ],
      },
    });

    expect(html).toContain('<th>月份</th>');
    expect(html).toContain('<th>销售阶段</th>');
    expect(html).toContain('<th>商机数</th>');
    expect(html).toContain('<th>商机金额（万元）</th>');
    expect(html).not.toContain('<th>负责人</th>');
    expect(html).not.toContain('<th>字段5</th>');
    expect(html).not.toContain('<th>分组</th>');
  });

  it('服务商发展运营看板应渲染中国地图覆盖标注和合作等级明细', () => {
    const controller = createController();

    const html = renderPublicResultHtml(controller, {
      title: '服务商发展运营数据看板',
      report: {
        reportTitle: '服务商发展运营数据看板',
        sections: [
          {
            sectionType: 'focus-list',
            title: '省份代理商覆盖情况',
            description: '按当前结果包中已有省份和区域标注服务商覆盖情况。',
            rows: [
              {
                coverageKey: '山东',
                province: '山东',
                region: '山东区',
                partnerCount: 2,
                amount: 30000,
                levelSummary: '一级渠道、二级渠道',
              },
              {
                coverageKey: '华南',
                province: '',
                region: '华南',
                partnerCount: 1,
                amount: 12000,
                levelSummary: '金牌',
              },
            ],
          },
        ],
        tableBlocks: [
          {
            title: '合作等级明细',
            rows: [
              {
                partnerLevel: '一级渠道',
                partnerCount: 12,
                regionCount: 3,
                coveredRegions: '山东区、江苏区、北京区',
                shareText: '60.0%',
              },
              {
                partnerLevel: '二级渠道',
                partnerCount: 8,
                regionCount: 2,
                coveredRegions: '山东区、华南',
                shareText: '40.0%',
              },
            ],
          },
        ],
      },
    });

    expect(html).toContain('class="coverage-map"');
    expect(html).toContain('china.min.js');
    expect(html).toContain('type: \'map\'');
    expect(html).toContain('省份代理商覆盖情况');
    expect(html).toContain('覆盖概览');
    expect(html).toContain('覆盖率');
    expect(html).toContain('未覆盖：');
    expect(html).toContain('双击省份查看代理商详情');
    expect(html).toContain('showCoverageProvinceDetail_');
    expect(html).not.toContain('coverage-list-wrap');
    expect(html).not.toContain('data-coverage-province');
    expect(html).toContain('山东');
    expect(html).toContain('华南');
    expect(html).toContain('<th>合作等级</th>');
    expect(html).toContain('<th>渠道商数</th>');
    expect(html).toContain('<th>渠道商占比</th>');
    expect(html).not.toContain('<th>字段8</th>');
    expect(html).toContain('一级渠道');
    expect(html).not.toContain('技术服务人员 &amp; 证书认证');
  });
});
