import { WecomAnalysisTableImageService } from '../../../src/modules/wecom/wecom-analysis-table-image.service';

describe('WecomAnalysisTableImageService', () => {
  it('应把分析表格行渲染为企微可上传的 PNG 图片', async () => {
    const service = new WecomAnalysisTableImageService();

    const artifact = await service.renderTableImage({
      title: '区域经营贡献报告',
      summary: '最近三个月山东区商机情况已生成。',
      metricCards: [
        {
          name: '累计金额',
          value: '26.5 万元',
        },
        {
          name: '商机数量',
          value: 44,
        },
      ],
      variant: 'ranking',
      rows: [
        {
          region: '山东区',
          amount: 265000,
          count: 44,
        },
      ],
    });

    expect(artifact?.filename).toMatch(/^crm-analysis-table-\d+\.png$/u);
    expect(artifact?.previewText).toContain('分析结果表格图片');
    expect(artifact?.buffer.subarray(0, 8).toString('hex')).toBe(
      '89504e470d0a1a0a',
    );
  });

  it('没有明细行时不应生成图片附件', async () => {
    const service = new WecomAnalysisTableImageService();

    await expect(
      service.renderTableImage({
        rows: [],
      }),
    ).resolves.toBeUndefined();
  });

  it('应生成企微内可查看的省份覆盖热力图 PNG', async () => {
    const service = new WecomAnalysisTableImageService();

    const artifact = await service.renderTableImage({
      title: '技术服务商全国覆盖',
      summary: '按省份展示技术服务商覆盖情况。',
      variant: 'map',
      rows: [
        { 区域: '山东', 数量: 8 },
        { 区域: '北京', 数量: 2 },
      ],
    });

    expect(artifact?.filename).toMatch(/^crm-analysis-table-\d+\.png$/u);
    expect(artifact?.buffer.subarray(0, 8).toString('hex')).toBe(
      '89504e470d0a1a0a',
    );
  });
});
