/**
 * 看板结果组装器
 *
 * 设计目标：
 * - 接收 DashboardAnalyticsService 的实时统计数据
 * - 组装为看板 block 结构（KPI 矩阵 + 集中度 + 趋势 + 排行 + 地图 + 明细表）
 * - 输出符合前端 ManagementReportBlock 格式的 block 数组
 * - 自动生成集中度计算和洞察文案
 *
 * 与现有链路的关系：
 * - 不替代 AnalysisReportComposerService（它仍负责常规问答的报告组装）
 * - 在看板型意图被识别后，由编排层调用本服务
 * - 输出的 block 结构复用前端 ManagementSectionCanvas 渲染
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  LianruanCrmOpenApiFunnelAnalytics,
  LianruanCrmOpenApiOwnerContributionRecord,
  LianruanCrmOpenApiPartnerContributionRecord,
  LianruanCrmOpenApiRegionContributionRecord,
  LianruanCrmOpenApiResourceSummary,
} from './lianruan-crm-openapi.types';
import type { DashboardAnalyticsBundle, DashboardAnalyticsQuery } from './dashboard-analytics.service';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { formatOpportunityStageLabel } from '../analysis/opportunity-stage-label.util';
import {
  resolveChinaCityByText,
  resolveChinaProvinceByText,
} from '../../shared/china-administrative-division.util';

/**
 * 看板类型枚举
 * 根据用户问题识别看板类型，决定组装哪些 block
 */
export type DashboardProfile =
  | 'channel-order-summary' // 渠道下单汇总看板
  | 'agent-development' // 代理商发展运营看板
  | 'region-overview' // 区域经营概览看板
  | 'owner-performance' // 负责人业绩看板
  | 'auto'; // 自动识别

/**
 * 看板组装结果
 * 包含 block 数组和元信息，供编排层注入 AnalysisResultRecord
 */
export interface DashboardComposeResult {
  blocks: DashboardBlock[];
  reportTitle: string;
  executiveSummary: string;
  dataSource: DashboardAnalyticsBundle['dataSource'];
  fetchedAt: string;
  scopeSummary: string;
  errors: string[];
}

/**
 * 看板 block 类型
 * 与前端 management-report.ts 的 blockType 对齐
 */
export type DashboardBlock =
  | { blockId: string; blockType: 'kpi-matrix'; title: string; metrics: DashboardKpiMetric[]; columns?: number }
  | { blockId: string; blockType: 'concentration'; title: string; totalValue: number; totalUnits: number; tiers: DashboardConcentrationTier[]; oneTimeCount?: number; oneTimePercentage?: number; insights: string[]; unitLabel?: string }
  | { blockId: string; blockType: 'sortable-table'; title: string; columns: DashboardTableColumn[]; rows: Array<Record<string, string | number>>; searchable?: boolean; searchPlaceholder?: string; pageSize?: number; showSummary?: boolean; summaryRow?: Record<string, string | number> }
  | { blockId: string; blockType: 'grouped-bar'; title: string; categories: string[]; series: Array<{ name: string; values: number[] }>; unitLabel?: string; description?: string }
  | { blockId: string; blockType: 'geo-map'; title: string; mapName: string; regions: DashboardGeoRegion[]; totalRegionCount?: number; coveredRegionCount?: number; totalCityCount?: number; coveredCityCount?: number; unitLabel?: string; cityUnitLabel?: string }
  | { blockId: string; blockType: 'composite-trend'; title: string; categories: string[]; barSeries: Array<{ name: string; values: number[] }>; lineSeries?: Array<{ name: string; values: number[] }>; barUnitLabel?: string; lineUnitLabel?: string }
  | { blockId: string; blockType: 'pie-distribution'; title: string; segments: Array<{ name: string; value: number; color?: string }>; totalValue?: number; unitLabel?: string; insights?: string[] }
  | { blockId: string; blockType: 'funnel'; title: string; stages: Array<{ name: string; value: number; amount?: number; rate?: number }>; insights?: string[] };

export interface DashboardKpiMetric {
  label: string;
  value: string;
  unit?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  sublabel?: string;
}

export interface DashboardConcentrationTier {
  label: string;
  value: number;
  count: number;
  percentage: number;
}

interface DashboardGeoCityGroup {
  cityName: string;
  partnerCount: number;
  partners: string[];
}

interface DashboardGeoRegion {
  name: string;
  value: number;
  extra?: string;
  coveredCityCount?: number;
  totalCityCount?: number;
  cityGroups?: DashboardGeoCityGroup[];
}

export interface DashboardTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  isRank?: boolean;
  isAmount?: boolean;
}

type ContributionAmountField = 'orderAmount' | 'quoteAmount' | 'opportunityAmount';
type ContributionCountField = 'orderCount' | 'quoteCount' | 'opportunityCount';
type ContributionComparableField = ContributionAmountField | ContributionCountField | 'registrationCount';

interface ContributionMeasure {
  amountField: ContributionAmountField;
  countField: ContributionCountField;
  amountLabel: string;
  countLabel: string;
}

interface ContributionComparisonMetric {
  field: ContributionComparableField;
  label: string;
  unitLabel: string;
}

interface ProvinceResolution {
  province: string;
  source: string;
  cityName?: string;
}

const CHINA_PROVINCE_KEYWORDS: Array<{ province: string; keywords: string[] }> = [
  { province: '北京', keywords: ['北京'] },
  { province: '天津', keywords: ['天津'] },
  { province: '上海', keywords: ['上海'] },
  { province: '重庆', keywords: ['重庆'] },
  { province: '河北', keywords: ['河北', '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'] },
  { province: '山西', keywords: ['山西', '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'] },
  { province: '内蒙古', keywords: ['内蒙古', '呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布'] },
  { province: '辽宁', keywords: ['辽宁', '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'] },
  { province: '吉林', keywords: ['吉林', '长春', '四平', '辽源', '通化', '白山', '松原', '白城', '延边'] },
  { province: '黑龙江', keywords: ['黑龙江', '哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '鸡西', '双鸭山', '伊春', '七台河', '鹤岗', '黑河', '绥化'] },
  { province: '江苏', keywords: ['江苏', '南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'] },
  { province: '浙江', keywords: ['浙江', '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'] },
  { province: '安徽', keywords: ['安徽', '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'] },
  { province: '福建', keywords: ['福建', '福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'] },
  { province: '江西', keywords: ['江西', '南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'] },
  { province: '山东', keywords: ['山东', '济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'] },
  { province: '河南', keywords: ['河南', '郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店', '济源'] },
  { province: '湖北', keywords: ['湖北', '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施'] },
  { province: '湖南', keywords: ['湖南', '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西'] },
  { province: '广东', keywords: ['广东', '广州', '深圳', '珠海', '汕头', '佛山', '韶关', '湛江', '肇庆', '江门', '茂名', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'] },
  { province: '广西', keywords: ['广西', '南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'] },
  { province: '海南', keywords: ['海南', '海口', '三亚', '三沙', '儋州'] },
  { province: '四川', keywords: ['四川', '成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝', '甘孜', '凉山'] },
  { province: '贵州', keywords: ['贵州', '贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南', '黔东南', '黔南'] },
  { province: '云南', keywords: ['云南', '昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄', '红河', '文山', '西双版纳', '大理', '德宏', '怒江', '迪庆'] },
  { province: '西藏', keywords: ['西藏', '拉萨', '日喀则', '昌都', '林芝', '山南', '那曲', '阿里'] },
  { province: '陕西', keywords: ['陕西', '西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'] },
  { province: '甘肃', keywords: ['甘肃', '兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏', '甘南'] },
  { province: '青海', keywords: ['青海', '西宁', '海东', '海北', '黄南', '海南藏族自治州', '果洛', '玉树', '海西'] },
  { province: '宁夏', keywords: ['宁夏', '银川', '石嘴山', '吴忠', '固原', '中卫'] },
  { province: '新疆', keywords: ['新疆', '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密', '昌吉', '博尔塔拉', '巴音郭楞', '阿克苏', '克孜勒苏', '喀什', '和田', '伊犁', '塔城', '阿勒泰'] },
];

const MUNICIPALITY_NAMES = new Set(['北京', '天津', '上海', '重庆']);
const UNKNOWN_CITY_LABEL = '未识别地市';
const CHINA_PROVINCE_CITY_NAMES: Record<string, string[]> = Object.fromEntries(
  CHINA_PROVINCE_KEYWORDS.map((item) => [
    item.province,
    MUNICIPALITY_NAMES.has(item.province)
      ? [item.province]
      : item.keywords.filter((keyword) => keyword !== item.province),
  ]),
);
const CHINA_PREFECTURE_CITY_TOTAL = Object.values(CHINA_PROVINCE_CITY_NAMES)
  .reduce((sum, cityNames) => sum + cityNames.length, 0);

const CRM_REGION_PROVINCE_FALLBACK: Record<string, string> = {
  北京区: '北京',
  北区: '北京',
  '北区（政府企业）': '北京',
  '北区（政企企业）': '北京',
  上海区: '上海',
  '上海区（非金）': '上海',
  天津区: '天津',
  重庆区: '重庆',
  山东区: '山东',
  江苏区: '江苏',
  安徽区: '安徽',
  湖北区: '湖北',
  河南区: '河南',
  广东区: '广东',
  四川区: '四川',
  福建区: '福建',
  湖南区: '湖南',
};

const COMMON_STATUS_LABELS: Record<string, string> = {
  approved: '已通过',
  rejected: '已驳回',
  submitted: '已提交',
  pending: '待处理',
  processing: '处理中',
  active: '启用',
  inactive: '停用',
  disabled: '禁用',
  enabled: '启用',
  completed: '已完成',
  closed: '已关闭',
  cancelled: '已取消',
  canceled: '已取消',
  draft: '草稿',
  open: '进行中',
  new: '新建',
  won: '已成交',
  lost: '已失单',
  none: '未设置',
  unknown: '未设置',
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  ...COMMON_STATUS_LABELS,
  converted: '已转订单',
  confirmed: '已确认',
  expired: '已过期',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  ...COMMON_STATUS_LABELS,
  paid: '已回款',
  unpaid: '未回款',
  shipped: '已发货',
  signed: '已签约',
};

@Injectable()
export class DashboardReportComposer {
  private readonly logger = new Logger('DashboardReportComposer');

  constructor(
    private readonly dashboardAnalyticsService: DashboardAnalyticsService,
  ) {}

  /**
   * 组装看板结果
   *
   * @param profile 看板类型（或 auto 自动识别）
   * @param query 筛选参数
   * @param questionText 原始问题文本（用于自动识别和摘要）
   * @returns 看板组装结果
   */
  async compose(
    profile: DashboardProfile,
    query: DashboardAnalyticsQuery = {},
    questionText?: string,
  ): Promise<DashboardComposeResult> {
    // 获取实时统计数据
    const bundle = await this.dashboardAnalyticsService.fetchDashboardAnalytics(query);

    // 诊断日志：记录 bundle 各数据源状态
    this.logger.log(
      `compose() bundle 状态: ` +
        `partnerSummary=${bundle.partnerSummary ? 'OK' : 'NULL'}(` +
        `byCooperationLevel=${bundle.partnerSummary?.byCooperationLevel?.length ?? 0},` +
        `byTechServiceType=${bundle.partnerSummary?.byTechServiceType?.length ?? 0},` +
        `timeSeries=${bundle.partnerSummary?.timeSeries?.length ?? 0}), ` +
        `opportunitySummary=${bundle.opportunitySummary ? 'OK' : 'NULL'}(` +
        `byStatus=${bundle.opportunitySummary?.byStatus?.length ?? 0}), ` +
        `quoteSummary=${bundle.quoteSummary ? 'OK' : 'NULL'}(` +
        `byStatus=${bundle.quoteSummary?.byStatus?.length ?? 0}), ` +
        `orderSummary=${bundle.orderSummary ? 'OK' : 'NULL'}(` +
        `byStatus=${bundle.orderSummary?.byStatus?.length ?? 0}), ` +
        `registrationSummary=${bundle.registrationSummary ? 'OK' : 'NULL'}, ` +
        `funnel=${bundle.funnel ? 'OK' : 'NULL'}, ` +
        `partnerContributions=${bundle.partnerContributions.length}, ` +
        `regionContributions=${bundle.regionContributions.length}, ` +
        `ownerContributions=${bundle.ownerContributions.length}, ` +
        `errors=${bundle.errors.length}, ` +
        `dataSource=${bundle.dataSource}`,
    );
    if (bundle.errors.length > 0) {
      this.logger.warn(`compose() OpenAPI 错误详情: ${bundle.errors.join(' | ')}`);
    }

    // 自动识别看板类型
    const effectiveProfile = profile === 'auto'
      ? this.detectProfile(questionText ?? '')
      : profile;

    // 按看板类型组装 block
    const blocks = this.buildBlocks(effectiveProfile, bundle, questionText ?? '');
    const reportTitle = this.buildReportTitle(effectiveProfile, query);
    const executiveSummary = this.buildExecutiveSummary(effectiveProfile, bundle);
    const scopeSummary = this.buildScopeSummary(query, bundle);

    // 诊断日志：记录生成的 block 清单
    this.logger.log(
      `compose() 生成 ${blocks.length} 个 block: ` +
        blocks.map((b) => `${b.blockType}(${b.title})`).join(', '),
    );

    return {
      blocks,
      reportTitle,
      executiveSummary,
      dataSource: bundle.dataSource,
      fetchedAt: bundle.fetchedAt,
      scopeSummary,
      errors: bundle.errors,
    };
  }

  // ===== 看板类型识别 =====

  private detectProfile(questionText: string): DashboardProfile {
    const text = questionText.toLowerCase();

    // 排除性：筛选/明细类提问不应匹配看板模板
    if (/没有.{0,8}(客户|商机|订单|报价).{0,6}(情况|的)|无.{0,4}(进展|维护|跟进)/u.test(text)) {
      return 'auto'; // 不匹配任何看板模板，由调用方决定降级
    }

    // 区域/大区对比 → region-overview（优先于 agent-development，因为"各区域渠道商..."同时包含两者）
    // 覆盖"各区域渠道商发展运营数据情况看板""区域经营""大区对比"等变体
    if (/各区域.*看板|各区域.*数据|区域.*概览|大区.*对比|区域排名.*看板/.test(text)) {
      return 'region-overview';
    }
    // 更宽泛的区域类（不含"各区域"前缀）
    if (/区域.*经营|区域.*运营|区域.*发展|区域.*看板/.test(text)) {
      return 'region-overview';
    }

    // 渠道下单/签单汇总 → channel-order-summary
    if (/渠道.*下单|下单.*汇总|签单.*汇总|订单.*分析|订单.*看板|下单.*分析/.test(text)) {
      return 'channel-order-summary';
    }
    // 代理商/渠道商发展运营 → agent-development
    // 覆盖"渠道商发展运营数据看板""代理商发展运营数据看板""全国渠道商发展运营"等变体
    // 注意：不包含"各区域"的渠道商问题走这里
    if (/代理商.*发展|代理商.*运营|代理商.*看板|渠道商.*发展|渠道商.*运营|渠道商.*看板|渠道商.*数据/.test(text)) {
      return 'agent-development';
    }
    // 负责人/销售业绩 → owner-performance
    if (/负责人.*业绩|负责人.*排名|销售.*排名/.test(text)) {
      return 'owner-performance';
    }
    return 'channel-order-summary'; // 默认
  }

  // ===== Block 组装 =====

  private buildBlocks(
    profile: DashboardProfile,
    bundle: DashboardAnalyticsBundle,
    questionText: string,
  ): DashboardBlock[] {
    switch (profile) {
      case 'channel-order-summary':
        return this.buildChannelOrderSummaryBlocks(bundle);
      case 'agent-development':
        return this.buildAgentDevelopmentBlocks(bundle);
      case 'region-overview':
        return this.buildRegionOverviewBlocks(bundle);
      case 'owner-performance':
        return this.buildOwnerPerformanceBlocks(bundle);
      default:
        return this.buildChannelOrderSummaryBlocks(bundle);
    }
  }

  /**
   * 渠道下单汇总看板
   * 对标案例一：KPI 矩阵 + 集中度 + 渠道排名表
   */
  private buildChannelOrderSummaryBlocks(bundle: DashboardAnalyticsBundle): DashboardBlock[] {
    const blocks: DashboardBlock[] = [];

    // 1. KPI 矩阵
    const kpiMetrics = this.buildChannelOrderKpi(bundle);
    if (kpiMetrics.length > 0) {
      blocks.push({
        blockId: 'dashboard-kpi',
        blockType: 'kpi-matrix',
        title: '核心指标',
        metrics: kpiMetrics,
        columns: 3,
      });
    }

    // 2. 集中度分析（CR-n 集中度，对标参考HTML的集中度卡片）
    const concentration = this.buildConcentration(bundle.partnerContributions);
    if (concentration) {
      blocks.push(concentration);
    }

    // 3. 合作级别分布饼图（兜底从 partnerContributions 聚合）
    let cooperationDist = this.buildCooperationLevelDistribution(bundle);
    if (!cooperationDist && bundle.partnerContributions.length > 0) {
      cooperationDist = this.buildCooperationLevelDistributionFromContributions(bundle.partnerContributions);
      if (cooperationDist) {
        this.logger.log('订单看板-合作级别分布：summary 端点无数据，已从 partnerContributions 兜底聚合。');
      }
    }
    if (cooperationDist) {
      blocks.push(cooperationDist);
    }

    // 4. 技术服务商分布饼图（兜底从 partnerContributions 聚合）
    let techDist = this.buildTechServiceTypeDistribution(bundle);
    if (!techDist && bundle.partnerContributions.length > 0) {
      techDist = this.buildTechServiceTypeDistributionFromContributions(bundle.partnerContributions);
      if (techDist) {
        this.logger.log('订单看板-技术服务商分布：summary 端点无数据，已从 partnerContributions 兜底聚合。');
      }
    }
    if (techDist) {
      blocks.push(techDist);
    }

    // 5. 订单状态分布饼图
    const orderStatusDist = this.buildStatusDistribution(bundle.orderSummary, '订单状态分布');
    if (orderStatusDist) {
      blocks.push(orderStatusDist);
    }

    // 6. 月度趋势（基于 orderSummary.timeSeries，兜底从 partnerSummary.timeSeries）
    let trendBlock = this.buildTrendFromSummary(bundle.orderSummary, '订单月度趋势');
    if (!trendBlock) {
      trendBlock = this.buildTrendFromSummary(bundle.partnerSummary, '渠道商新增趋势');
    }
    if (trendBlock) {
      blocks.push(trendBlock);
    }

    // 7. 业务转化漏斗（报备→商机→报价→订单，兜底从 partnerContributions 聚合）
    let funnelBlock = this.buildFunnelBlockFromSummariesOrContributions(bundle);
    if (funnelBlock) {
      blocks.push(funnelBlock);
    }

    // 8. 渠道排名表（补合作级别和技术服务商列）
    const rankingTable = this.buildPartnerRankingTable(bundle.partnerContributions);
    if (rankingTable) {
      blocks.push(rankingTable);
    }

    // 9. 区域贡献明细表
    const regionTable = this.buildRegionRankingTable(bundle.regionContributions);
    if (regionTable) {
      blocks.push(regionTable);
    }

    return blocks;
  }

  /**
   * 代理商发展运营看板
   * 对标 AI 直连数据库看板：KPI 矩阵 + 合作级别分布 + 技术服务商分布
   * + 大区对比 + 省份覆盖地图 + 商机阶段分布 + 报价/订单状态 + 月度趋势
   * + 业务漏斗 + 区域贡献明细表 + 代理商运营明细表
   */
  private buildAgentDevelopmentBlocks(bundle: DashboardAnalyticsBundle): DashboardBlock[] {
    const blocks: DashboardBlock[] = [];

    // 1. KPI 矩阵（补齐合作级别和技术服务商维度）
    const kpiMetrics = this.buildAgentDevelopmentKpi(bundle);
    if (kpiMetrics.length > 0) {
      blocks.push({
        blockId: 'dashboard-kpi',
        blockType: 'kpi-matrix',
        title: '核心指标',
        metrics: kpiMetrics,
        columns: 3,
      });
    }

    // 2. 合作级别分布饼图（LEP/金牌/银牌/钻石/未设置）—— 大区渠道商结构
    // 优先用 partnerSummary.byCooperationLevel，兜底从 partnerContributions 聚合
    let cooperationDist = this.buildCooperationLevelDistribution(bundle);
    if (!cooperationDist && bundle.partnerContributions.length > 0) {
      cooperationDist = this.buildCooperationLevelDistributionFromContributions(bundle.partnerContributions);
      if (cooperationDist) {
        this.logger.log('合作级别分布：summary 端点无数据，已从 partnerContributions 兜底聚合。');
      }
    }
    if (cooperationDist) {
      blocks.push(cooperationDist);
    }

    // 3. 技术服务商分布饼图（签约/提名/未参与）—— 技术服务商建设
    // 优先用 partnerSummary.byTechServiceType，兜底从 partnerContributions 聚合
    let techDist = this.buildTechServiceTypeDistribution(bundle);
    if (!techDist && bundle.partnerContributions.length > 0) {
      techDist = this.buildTechServiceTypeDistributionFromContributions(bundle.partnerContributions);
      if (techDist) {
        this.logger.log('技术服务商分布：summary 端点无数据，已从 partnerContributions 兜底聚合。');
      }
    }
    if (techDist) {
      blocks.push(techDist);
    }

    // 4. 大区对比分组柱状图
    const regionComparison = this.buildRegionComparisonBar(bundle.regionContributions);
    if (regionComparison) {
      blocks.push(regionComparison);
    }

    // 5. 省份覆盖地图
    const provinceMap = this.buildProvinceMap(bundle.partnerContributions);
    if (provinceMap) {
      blocks.push(provinceMap);
    }

    // 6. 商机阶段分布饼图 —— 商机阶段分布
    const oppStatusDist = this.buildStatusDistribution(bundle.opportunitySummary, '商机阶段分布');
    if (oppStatusDist) {
      blocks.push(oppStatusDist);
    }

    // 7. 报价状态分布 + 订单状态分布 —— 报价与订单状态
    const quoteStatusDist = this.buildStatusDistribution(bundle.quoteSummary, '报价状态分布');
    if (quoteStatusDist) {
      blocks.push(quoteStatusDist);
    }
    const orderStatusDist = this.buildStatusDistribution(bundle.orderSummary, '订单状态分布');
    if (orderStatusDist) {
      blocks.push(orderStatusDist);
    }

    // 8. 月度新增趋势（基于 partnerSummary.timeSeries 或 byMonth）
    const trendBlock = this.buildTrendFromSummary(bundle.partnerSummary, '渠道商新增趋势');
    if (trendBlock) {
      blocks.push(trendBlock);
    }

    // 9. 业务转化漏斗
    // 优先用 bundle.funnel，兜底从 partnerContributions 或 summary 端点聚合
    let funnelBlock = this.buildFunnelBlock(bundle);
    if (!funnelBlock) {
      funnelBlock = this.buildFunnelBlockFromSummariesOrContributions(bundle);
      if (funnelBlock) {
        this.logger.log('业务转化漏斗：funnel 端点无数据，已从 summary/contributions 兜底聚合。');
      }
    }
    if (funnelBlock) {
      blocks.push(funnelBlock);
    }

    // 10. 区域贡献明细表 —— 区域贡献明细
    const regionTable = this.buildRegionRankingTable(bundle.regionContributions);
    if (regionTable) {
      blocks.push(regionTable);
    }

    // 11. 代理商/渠道商运营明细表 —— 代理商运营明细
    const partnerTable = this.buildPartnerRankingTable(bundle.partnerContributions);
    if (partnerTable) {
      blocks.push(partnerTable);
    }

    // 12. 团队明细表（补合作级别和技术服务商列）
    const teamTable = this.buildOwnerDetailTable(bundle.ownerContributions);
    if (teamTable) {
      blocks.push(teamTable);
    }

    return blocks;
  }

  /**
   * 区域经营概览看板
   */
  private buildRegionOverviewBlocks(bundle: DashboardAnalyticsBundle): DashboardBlock[] {
    const blocks: DashboardBlock[] = [];

    // 1. KPI 矩阵
    const kpiMetrics = this.buildRegionOverviewKpi(bundle);
    if (kpiMetrics.length > 0) {
      blocks.push({
        blockId: 'dashboard-kpi',
        blockType: 'kpi-matrix',
        title: '核心指标',
        metrics: kpiMetrics,
        columns: 4,
      });
    }

    // 2. 大区对比分组柱状图
    const regionComparison = this.buildRegionComparisonBar(bundle.regionContributions);
    if (regionComparison) {
      blocks.push(regionComparison);
    }

    // 3. 合作级别分布饼图（兜底从 partnerContributions 聚合）
    let cooperationDist = this.buildCooperationLevelDistribution(bundle);
    if (!cooperationDist && bundle.partnerContributions.length > 0) {
      cooperationDist = this.buildCooperationLevelDistributionFromContributions(bundle.partnerContributions);
    }
    if (cooperationDist) {
      blocks.push(cooperationDist);
    }

    // 4. 技术服务商分布饼图（兜底从 partnerContributions 聚合）
    let techDist = this.buildTechServiceTypeDistribution(bundle);
    if (!techDist && bundle.partnerContributions.length > 0) {
      techDist = this.buildTechServiceTypeDistributionFromContributions(bundle.partnerContributions);
    }
    if (techDist) {
      blocks.push(techDist);
    }

    // 5. 省份覆盖地图
    const provinceMap = this.buildProvinceMap(bundle.partnerContributions);
    if (provinceMap) {
      blocks.push(provinceMap);
    }

    // 6. 业务转化漏斗（兜底聚合）
    const funnelBlock = this.buildFunnelBlockFromSummariesOrContributions(bundle);
    if (funnelBlock) {
      blocks.push(funnelBlock);
    }

    // 7. 区域排名明细表
    const regionTable = this.buildRegionRankingTable(bundle.regionContributions);
    if (regionTable) {
      blocks.push(regionTable);
    }

    // 8. 渠道排名明细表
    const partnerTable = this.buildPartnerRankingTable(bundle.partnerContributions);
    if (partnerTable) {
      blocks.push(partnerTable);
    }

    return blocks;
  }

  /**
   * 负责人业绩看板
   */
  private buildOwnerPerformanceBlocks(bundle: DashboardAnalyticsBundle): DashboardBlock[] {
    const blocks: DashboardBlock[] = [];

    const kpiMetrics = this.buildOwnerPerformanceKpi(bundle);
    if (kpiMetrics.length > 0) {
      blocks.push({
        blockId: 'dashboard-kpi',
        blockType: 'kpi-matrix',
        title: '核心指标',
        metrics: kpiMetrics,
        columns: 4,
      });
    }

    const ownerTable = this.buildOwnerRankingTable(bundle.ownerContributions);
    if (ownerTable) {
      blocks.push(ownerTable);
    }

    return blocks;
  }

  // ===== KPI 矩阵构建 =====

  private buildChannelOrderKpi(bundle: DashboardAnalyticsBundle): DashboardKpiMetric[] {
    const metrics: DashboardKpiMetric[] = [];
    const partners = bundle.partnerContributions;

    // 合作渠道数：优先用 partnerSummary.totalCount
    const partnerCount = bundle.partnerSummary?.totalCount ?? partners.length;
    if (partnerCount > 0) {
      metrics.push({ label: '合作渠道数', value: String(partnerCount), unit: '家', tone: 'primary' });
    }

    // 报备数（来源 registrationSummary.totalCount 或 funnel，兜底 partnerContributions 求和）
    const regCount = bundle.registrationSummary?.totalCount
      ?? bundle.funnel?.registrationCount
      ?? partners.reduce((sum, p) => sum + (p.registrationCount ?? 0), 0);
    if (regCount !== undefined && regCount > 0) {
      metrics.push({ label: '报备数', value: String(regCount), unit: '个', tone: 'info' as any });
    }

    // 商机数（来源 opportunitySummary.totalCount 或 funnel，兜底 partnerContributions 求和）
    const oppCount = bundle.opportunitySummary?.totalCount
      ?? bundle.funnel?.opportunityCount
      ?? partners.reduce((sum, p) => sum + (p.opportunityCount ?? 0), 0);
    if (oppCount !== undefined && oppCount > 0) {
      metrics.push({ label: '商机数', value: String(oppCount), unit: '个', tone: 'warning' });
    }

    // 报价数（来源 quoteSummary.totalCount 或 funnel，兜底 partnerContributions 求和）
    const quoteCount = bundle.quoteSummary?.totalCount
      ?? bundle.funnel?.quoteCount
      ?? partners.reduce((sum, p) => sum + (p.quoteCount ?? 0), 0);
    if (quoteCount !== undefined && quoteCount > 0) {
      metrics.push({ label: '报价数', value: String(quoteCount), unit: '个', tone: 'info' as any });
    }

    // 订单数（来源 orderSummary.totalCount 或 funnel，兜底 partnerContributions 求和）
    const orderCount = bundle.orderSummary?.totalCount
      ?? bundle.funnel?.orderCount
      ?? partners.reduce((sum, p) => sum + (p.orderCount ?? 0), 0);
    if (orderCount !== undefined && orderCount > 0) {
      metrics.push({ label: '订单数', value: String(orderCount), unit: '单', tone: 'success' });
    }

    // 下单总额：优先 orderSummary.totalAmount，兜底 partnerContributions 求和
    const totalAmount = bundle.orderSummary?.totalAmount
      ? bundle.orderSummary.totalAmount / 10000
      : partners.reduce((sum, p) => sum + (p.orderAmount ?? 0), 0);
    if (totalAmount > 0) {
      metrics.push({ label: '下单总额', value: totalAmount.toFixed(2), unit: '万', tone: 'primary' });
    }

    return metrics;
  }

  private buildAgentDevelopmentKpi(bundle: DashboardAnalyticsBundle): DashboardKpiMetric[] {
    const metrics: DashboardKpiMetric[] = [];

    // 渠道商总数：优先用 partnerSummary.totalCount，兜底用 partnerProfile.totalCount
    const partnerTotal = bundle.partnerSummary?.totalCount
      ?? bundle.partnerProfile?.totalCount
      ?? bundle.partnerContributions.length;
    if (partnerTotal > 0) {
      metrics.push({ label: '渠道商总数', value: String(partnerTotal), unit: '家', tone: 'primary' });
    }

    // 合作级别分布：LEP / 金牌（来源 partnerSummary.byCooperationLevel，兜底 partnerContributions）
    let coopoBuckets = bundle.partnerSummary?.byCooperationLevel
      ?? bundle.partnerSummary?.dimensions?.byCooperationLevel;
    if ((!coopoBuckets || coopoBuckets.length === 0) && bundle.partnerContributions.length > 0) {
      // 兜底：从 partnerContributions 聚合
      const levelCounts = new Map<string, number>();
      for (const p of bundle.partnerContributions) {
        const level = p.cooperationLevel ?? 'unknown';
        levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
      }
      coopoBuckets = Array.from(levelCounts.entries()).map(([key, count]) => ({ key, count }));
    }
    if (coopoBuckets && coopoBuckets.length > 0) {
      const lepCount = coopoBuckets.find((b) => b.key === 'lep')?.count ?? 0;
      const goldCount = coopoBuckets.find((b) => b.key === 'gold')?.count ?? 0;
      if (lepCount > 0) {
        metrics.push({ label: 'LEP', value: String(lepCount), unit: '家', tone: 'info' as any });
      }
      if (goldCount > 0) {
        metrics.push({ label: '金牌', value: String(goldCount), unit: '家', tone: 'warning' });
      }
    }

    // 技术服务商分布：签约 / 提名（来源 partnerSummary.byTechServiceType，兜底 partnerContributions）
    let techBuckets = bundle.partnerSummary?.byTechServiceType
      ?? bundle.partnerSummary?.dimensions?.byTechServiceType;
    if ((!techBuckets || techBuckets.length === 0) && bundle.partnerContributions.length > 0) {
      // 兜底：从 partnerContributions 聚合
      const techCounts = new Map<string, number>();
      for (const p of bundle.partnerContributions) {
        const type = p.techServiceType ?? (p.isTechnicalServiceProvider ? 'full' : 'none');
        techCounts.set(type, (techCounts.get(type) ?? 0) + 1);
      }
      techBuckets = Array.from(techCounts.entries()).map(([key, count]) => ({ key, count }));
    }
    if (techBuckets && techBuckets.length > 0) {
      const fullCount = techBuckets.find((b) => b.key === 'full')?.count ?? 0;
      const developingCount = techBuckets.find((b) => b.key === 'developing')?.count
        ?? techBuckets.find((b) => b.key === 'nominated')?.count ?? 0;
      if (fullCount > 0) {
        metrics.push({ label: '签约技术', value: String(fullCount), unit: '家', tone: 'success' });
      }
      if (developingCount > 0) {
        metrics.push({ label: '提名', value: String(developingCount), unit: '家', tone: 'neutral' });
      }
    }

    // 覆盖率优先按可识别地市计算；省份覆盖保留为辅助口径。
    const coveredCityCount = this.countCoveredCities(bundle.partnerContributions);
    if (coveredCityCount > 0) {
      metrics.push({
        label: '覆盖地市',
        value: `${coveredCityCount}/${CHINA_PREFECTURE_CITY_TOTAL}`,
        unit: '',
        tone: 'success',
        sublabel: `覆盖率 ${((coveredCityCount / CHINA_PREFECTURE_CITY_TOTAL) * 100).toFixed(1)}%`,
      });
    }

    // 省份覆盖必须用真实省份名称，不能把 CRM 销售区域直接当作地图省份。
    const coveredProvinceCount = this.countCoveredProvinces(bundle.partnerContributions);
    if (coveredProvinceCount > 0) {
      metrics.push({
        label: '覆盖省份',
        value: `${coveredProvinceCount}/31`,
        unit: '',
        tone: 'success',
        sublabel: `覆盖率 ${((coveredProvinceCount / 31) * 100).toFixed(1)}%`,
      });
    }

    // 报备数和商机数（来源 funnel 或 summary，兜底 partnerContributions 聚合）
    const regCount = bundle.funnel?.registrationCount
      ?? bundle.registrationSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.registrationCount ?? 0), 0);
    if (regCount !== undefined && regCount > 0) {
      metrics.push({ label: '报备数', value: String(regCount), unit: '个', tone: 'info' as any });
    }
    const oppCount = bundle.funnel?.opportunityCount
      ?? bundle.opportunitySummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.opportunityCount ?? 0), 0);
    if (oppCount !== undefined && oppCount > 0) {
      metrics.push({ label: '商机数', value: String(oppCount), unit: '个', tone: 'warning' });
    }

    // 商机金额（来源 opportunitySummary.totalAmount 或 funnel.opportunityAmount，兜底 partnerContributions）
    const oppAmount = bundle.opportunitySummary?.totalAmount
      ?? bundle.funnel?.opportunityAmount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.opportunityAmount ?? 0), 0);
    if (oppAmount !== undefined && oppAmount > 0) {
      const amountWan = oppAmount / 10000;
      metrics.push({ label: '商机金额', value: amountWan.toFixed(2), unit: '万', tone: 'primary' });
    }

    return metrics;
  }

  private buildRegionOverviewKpi(bundle: DashboardAnalyticsBundle): DashboardKpiMetric[] {
    const metrics: DashboardKpiMetric[] = [];
    const regions = bundle.regionContributions;

    const totalOrders = regions.reduce((s, r) => s + (r.orderCount ?? 0), 0);
    const totalAmount = regions.reduce((s, r) => s + (r.orderAmount ?? 0), 0);
    const totalOpps = regions.reduce((s, r) => s + (r.opportunityCount ?? 0), 0);
    const totalRegs = regions.reduce((s, r) => s + (r.registrationCount ?? 0), 0);

    metrics.push({ label: '区域数', value: String(regions.length), unit: '个', tone: 'neutral' });
    if (totalRegs > 0) metrics.push({ label: '报备数', value: String(totalRegs), unit: '个', tone: 'info' as any });
    if (totalOpps > 0) metrics.push({ label: '商机数', value: String(totalOpps), unit: '个', tone: 'warning' });
    if (totalOrders > 0) metrics.push({ label: '下单数', value: String(totalOrders), unit: '单', tone: 'success' });
    if (totalAmount > 0) metrics.push({ label: '下单总额', value: totalAmount.toFixed(2), unit: '万', tone: 'primary' });

    return metrics;
  }

  private buildOwnerPerformanceKpi(bundle: DashboardAnalyticsBundle): DashboardKpiMetric[] {
    const metrics: DashboardKpiMetric[] = [];
    const owners = bundle.ownerContributions;

    const totalOrders = owners.reduce((s, o) => s + (o.orderCount ?? 0), 0);
    const totalAmount = owners.reduce((s, o) => s + (o.orderAmount ?? 0), 0);
    const totalOpps = owners.reduce((s, o) => s + (o.opportunityCount ?? 0), 0);

    metrics.push({ label: '负责人数', value: String(owners.length), unit: '人', tone: 'neutral' });
    if (totalOrders > 0) metrics.push({ label: '下单总量', value: String(totalOrders), unit: '单', tone: 'success' });
    if (totalAmount > 0) metrics.push({ label: '下单总额', value: totalAmount.toFixed(2), unit: '万', tone: 'primary' });
    if (totalOpps > 0) metrics.push({ label: '商机数', value: String(totalOpps), unit: '个', tone: 'warning' });

    return metrics;
  }

  private resolvePartnerContributionMeasure(
    partners: LianruanCrmOpenApiPartnerContributionRecord[],
  ): ContributionMeasure {
    const totalOrderAmount = partners.reduce((sum, p) => sum + (p.orderAmount ?? 0), 0);
    if (totalOrderAmount > 0) {
      return {
        amountField: 'orderAmount',
        countField: 'orderCount',
        amountLabel: '订单金额',
        countLabel: '订单数',
      };
    }

    const totalQuoteAmount = partners.reduce((sum, p) => sum + (p.quoteAmount ?? 0), 0);
    if (totalQuoteAmount > 0) {
      return {
        amountField: 'quoteAmount',
        countField: 'quoteCount',
        amountLabel: '报价金额',
        countLabel: '报价数',
      };
    }

    return {
      amountField: 'opportunityAmount',
      countField: 'opportunityCount',
      amountLabel: '商机金额',
      countLabel: '商机数',
    };
  }

  /**
   * 解析同类对比指标。
   *
   * 参数说明：`records` 为同一维度下的贡献记录，如区域、渠道商或负责人。
   * 返回值说明：返回当前最适合做横向对比的单一指标；无可比数据时返回 null。
   * 调用注意事项：只选一个指标做“对比/排行”口径，避免把商机、报价、订单混成一个综合领先结论。
   */
  private resolveContributionComparisonMetric(
    records: Array<Partial<Record<ContributionComparableField, number>>>,
  ): ContributionComparisonMetric | null {
    const metricPriority: ContributionComparisonMetric[] = [
      { field: 'orderAmount', label: '订单金额', unitLabel: '万' },
      { field: 'quoteAmount', label: '报价金额', unitLabel: '万' },
      { field: 'opportunityAmount', label: '商机金额', unitLabel: '万' },
      { field: 'orderCount', label: '订单数', unitLabel: '单' },
      { field: 'quoteCount', label: '报价数', unitLabel: '个' },
      { field: 'opportunityCount', label: '商机数', unitLabel: '个' },
      { field: 'registrationCount', label: '报备数', unitLabel: '个' },
    ];

    return metricPriority.find((metric) =>
      records.reduce((sum, record) => sum + (record[metric.field] ?? 0), 0) > 0,
    ) ?? null;
  }

  // ===== 集中度分析构建 =====

  private buildConcentration(
    partners: LianruanCrmOpenApiPartnerContributionRecord[],
  ): DashboardBlock | null {
    if (partners.length === 0) {
      return null;
    }

    const measure = this.resolvePartnerContributionMeasure(partners);
    const sorted = [...partners].sort((a, b) => (b[measure.amountField] ?? 0) - (a[measure.amountField] ?? 0));
    const totalValue = sorted.reduce((s, p) => s + (p[measure.amountField] ?? 0), 0);
    const totalUnits = sorted.length;

    if (totalValue === 0) {
      return null;
    }

    // 计算 TOP5/10/20 占比
    const tiers: DashboardConcentrationTier[] = [];
    const tierConfigs = [
      { label: 'TOP5', count: 5 },
      { label: 'TOP10', count: 10 },
      { label: 'TOP20', count: 20 },
    ];

    for (const config of tierConfigs) {
      if (sorted.length >= config.count) {
        const tierValue = sorted.slice(0, config.count).reduce((s, p) => s + (p[measure.amountField] ?? 0), 0);
        tiers.push({
          label: config.label,
          value: Number(tierValue.toFixed(2)),
          count: config.count,
          percentage: Number(((tierValue / totalValue) * 100).toFixed(1)),
        });
      }
    }

    // 低频业务渠道统计，按当前集中度口径对应的数量字段判断。
    const oneTimePartners = sorted.filter((p) => (p[measure.countField] ?? 0) <= 1);
    const oneTimeCount = oneTimePartners.length;
    const oneTimePercentage = totalUnits > 0 ? Number(((oneTimeCount / totalUnits) * 100).toFixed(1)) : 0;

    // 自动洞察文案
    const insights: string[] = [];
    if (tiers.length > 0) {
      insights.push(`${tiers[0].label} 渠道贡献了 ${tiers[0].percentage}% 的${measure.amountLabel}`);
    }
    if (tiers.length > 1) {
      insights.push(`${tiers[1].label} 渠道贡献了 ${tiers[1].percentage}% 的${measure.amountLabel}`);
    }
    if (oneTimePercentage > 0) {
      insights.push(`${measure.countLabel}不超过 1 次的渠道 ${oneTimeCount} 家，占比 ${oneTimePercentage}%`);
    }
    if (tiers.length > 0 && tiers[0].percentage > 30) {
      insights.push('集中度较高，建议重点维护头部渠道');
    }

    return {
      blockId: 'dashboard-concentration',
      blockType: 'concentration',
      title: `渠道集中度分析（按${measure.amountLabel}）`,
      totalValue: Number(totalValue.toFixed(2)),
      totalUnits,
      tiers,
      oneTimeCount,
      oneTimePercentage,
      insights,
      unitLabel: '万',
    };
  }

  // ===== 排名表构建 =====

  private buildPartnerRankingTable(
    partners: LianruanCrmOpenApiPartnerContributionRecord[],
  ): DashboardBlock | null {
    if (partners.length === 0) {
      return null;
    }

    const measure = this.resolvePartnerContributionMeasure(partners);
    const sorted = [...partners].sort((a, b) => (b[measure.amountField] ?? 0) - (a[measure.amountField] ?? 0));
    const totalAmount = sorted.reduce((s, p) => s + (p[measure.amountField] ?? 0), 0);

    const rows = sorted.map((p, idx) => ({
      rank: idx + 1,
      name: p.partnerName ?? '--',
      region: p.region ?? '--',
      bigRegion: p.bigRegion ?? '--',
      cooperationLevel: p.cooperationLevelName ?? this.resolveCooperationLevelLabel(p.cooperationLevel),
      techServiceType: p.techServiceTypeName ?? this.resolveTechServiceLabel(p.techServiceType),
      registrationCount: p.registrationCount ?? 0,
      opportunityCount: p.opportunityCount ?? 0,
      opportunityAmount: Number((p.opportunityAmount ?? 0).toFixed(2)),
      quoteCount: p.quoteCount ?? 0,
      quoteAmount: Number((p.quoteAmount ?? 0).toFixed(2)),
      orderCount: p.orderCount ?? 0,
      orderAmount: Number((p.orderAmount ?? 0).toFixed(2)),
      count: p[measure.countField] ?? 0,
      amount: Number((p[measure.amountField] ?? 0).toFixed(2)),
      percentage: totalAmount > 0 ? `${(((p[measure.amountField] ?? 0) / totalAmount) * 100).toFixed(1)}%` : '0%',
    }));

    return {
      blockId: 'dashboard-partner-ranking',
      blockType: 'sortable-table',
      title: `渠道贡献排行（按${measure.amountLabel}）`,
      searchable: true,
      searchPlaceholder: '搜索渠道名称...',
      pageSize: 10,
      showSummary: true,
      summaryRow: {
        rank: '合计',
        name: `${sorted.length} 家渠道`,
        registrationCount: sorted.reduce((s, p) => s + (p.registrationCount ?? 0), 0),
        opportunityCount: sorted.reduce((s, p) => s + (p.opportunityCount ?? 0), 0),
        opportunityAmount: Number(sorted.reduce((s, p) => s + (p.opportunityAmount ?? 0), 0).toFixed(2)),
        quoteCount: sorted.reduce((s, p) => s + (p.quoteCount ?? 0), 0),
        quoteAmount: Number(sorted.reduce((s, p) => s + (p.quoteAmount ?? 0), 0).toFixed(2)),
        orderCount: sorted.reduce((s, p) => s + (p.orderCount ?? 0), 0),
        orderAmount: Number(sorted.reduce((s, p) => s + (p.orderAmount ?? 0), 0).toFixed(2)),
        count: sorted.reduce((s, p) => s + (p[measure.countField] ?? 0), 0),
        amount: Number(totalAmount.toFixed(2)),
        percentage: '100%',
      },
      columns: [
        { key: 'rank', label: '排名', sortable: true, isRank: true, width: '70px', align: 'center' },
        { key: 'name', label: '渠道名称', sortable: true, filterable: true },
        { key: 'region', label: '区域', sortable: true, filterable: true, width: '90px' },
        { key: 'bigRegion', label: '大区', sortable: true, filterable: true, width: '80px' },
        { key: 'cooperationLevel', label: '合作级别', sortable: true, filterable: true, width: '90px' },
        { key: 'techServiceType', label: '技术服务', sortable: true, filterable: true, width: '90px' },
        { key: 'registrationCount', label: '报备数', sortable: true, width: '80px', align: 'right' },
        { key: 'opportunityCount', label: '商机数', sortable: true, width: '80px', align: 'right' },
        { key: 'opportunityAmount', label: '商机金额（万）', sortable: true, isAmount: true, width: '120px', align: 'right' },
        { key: 'quoteCount', label: '报价数', sortable: true, width: '80px', align: 'right' },
        { key: 'quoteAmount', label: '报价金额（万）', sortable: true, isAmount: true, width: '120px', align: 'right' },
        { key: 'orderCount', label: '订单数', sortable: true, width: '80px', align: 'right' },
        { key: 'orderAmount', label: '订单金额（万）', sortable: true, isAmount: true, width: '120px', align: 'right' },
        { key: 'count', label: measure.countLabel, sortable: true, width: '90px', align: 'right' },
        { key: 'amount', label: `${measure.amountLabel}（万）`, sortable: true, isAmount: true, width: '130px', align: 'right' },
        { key: 'percentage', label: '占比', sortable: true, width: '80px', align: 'right' },
      ],
      rows,
    };
  }

  private buildOwnerRankingTable(
    owners: LianruanCrmOpenApiOwnerContributionRecord[],
  ): DashboardBlock | null {
    if (owners.length === 0) {
      return null;
    }

    const metric = this.resolveContributionComparisonMetric(owners);
    if (!metric) {
      return null;
    }

    const sorted = [...owners].sort((a, b) => (b[metric.field] ?? 0) - (a[metric.field] ?? 0));
    const rows = sorted.map((o, idx) => ({
      rank: idx + 1,
      name: o.ownerName ?? o.assignedStaffName ?? '--',
      count: o.orderCount ?? 0,
      amount: Number((o.orderAmount ?? 0).toFixed(2)),
      oppCount: o.opportunityCount ?? 0,
      oppAmount: Number((o.opportunityAmount ?? 0).toFixed(2)),
    }));

    return {
      blockId: 'dashboard-owner-ranking',
      blockType: 'sortable-table',
      title: `负责人${metric.label}排行明细`,
      searchable: true,
      searchPlaceholder: '搜索负责人...',
      pageSize: 10,
      columns: [
        { key: 'rank', label: '排名', sortable: true, isRank: true, width: '80px', align: 'center' },
        { key: 'name', label: '负责人', sortable: true, filterable: true },
        { key: 'count', label: '下单数', sortable: true, width: '100px', align: 'right' },
        { key: 'amount', label: '金额（万）', sortable: true, isAmount: true, width: '160px', align: 'right' },
        { key: 'oppCount', label: '商机数', sortable: true, width: '100px', align: 'right' },
        { key: 'oppAmount', label: '商机金额（万）', sortable: true, isAmount: true, width: '160px', align: 'right' },
      ],
      rows,
    };
  }

  private buildRegionRankingTable(
    regions: LianruanCrmOpenApiRegionContributionRecord[],
  ): DashboardBlock | null {
    if (regions.length === 0) {
      return null;
    }

    const metric = this.resolveContributionComparisonMetric(regions);
    if (!metric) {
      return null;
    }

    const sorted = [...regions].sort((a, b) => (b[metric.field] ?? 0) - (a[metric.field] ?? 0));
    const rows = sorted.map((r, idx) => ({
      rank: idx + 1,
      region: r.region ?? r.bigRegion ?? '--',
      registrationCount: r.registrationCount ?? 0,
      orderCount: r.orderCount ?? 0,
      orderAmount: Number((r.orderAmount ?? 0).toFixed(2)),
      oppCount: r.opportunityCount ?? 0,
      oppAmount: Number((r.opportunityAmount ?? 0).toFixed(2)),
      quoteCount: r.quoteCount ?? 0,
      quoteAmount: Number((r.quoteAmount ?? 0).toFixed(2)),
    }));

    return {
      blockId: 'dashboard-region-ranking',
      blockType: 'sortable-table',
      title: `区域${metric.label}排行明细`,
      pageSize: 10,
      columns: [
        { key: 'rank', label: '排名', sortable: true, isRank: true, width: '80px', align: 'center' },
        { key: 'region', label: '区域', sortable: true, filterable: true },
        { key: 'registrationCount', label: '报备数', sortable: true, width: '100px', align: 'right' },
        { key: 'orderCount', label: '下单数', sortable: true, width: '120px', align: 'right' },
        { key: 'orderAmount', label: '金额（万）', sortable: true, isAmount: true, width: '160px', align: 'right' },
        { key: 'oppCount', label: '商机数', sortable: true, width: '120px', align: 'right' },
        { key: 'oppAmount', label: '商机金额（万）', sortable: true, isAmount: true, width: '160px', align: 'right' },
        { key: 'quoteCount', label: '报价数', sortable: true, width: '120px', align: 'right' },
        { key: 'quoteAmount', label: '报价金额（万）', sortable: true, isAmount: true, width: '160px', align: 'right' },
      ],
      rows,
    };
  }

  private buildOwnerDetailTable(
    owners: LianruanCrmOpenApiOwnerContributionRecord[],
  ): DashboardBlock | null {
    // 复用 owner ranking table，标题改为"团队明细"
    const table = this.buildOwnerRankingTable(owners);
    if (table) {
      return { ...table, blockId: 'dashboard-team-detail', title: table.title.replace('负责人', '团队') };
    }
    return null;
  }

  // ===== 分组柱状图构建 =====

  private buildRegionComparisonBar(
    regions: LianruanCrmOpenApiRegionContributionRecord[],
  ): DashboardBlock | null {
    if (regions.length === 0) {
      return null;
    }

    const metric = this.resolveContributionComparisonMetric(regions);
    if (!metric) {
      return null;
    }

    const sorted = [...regions].sort((a, b) => (b[metric.field] ?? 0) - (a[metric.field] ?? 0));
    const categories = sorted.map((r) => r.region ?? r.bigRegion ?? '--');
    const values = sorted.map((r) => Number((r[metric.field] ?? 0).toFixed(2)));

    return {
      blockId: 'dashboard-region-comparison',
      blockType: 'grouped-bar',
      title: `区域${metric.label}对比`,
      categories,
      series: [{ name: metric.label, values }],
      unitLabel: metric.unitLabel,
      description: `同类对比：每根柱子均为区域维度下的${metric.label}，不把商机、报价、订单等不同业务对象互相比较。`,
    };
  }

  // ===== 地图构建 =====

  private buildProvinceMap(
    partners: LianruanCrmOpenApiPartnerContributionRecord[],
  ): DashboardBlock | null {
    if (partners.length === 0) {
      return null;
    }

    // 按真实省份聚合渠道数；无法识别省份的渠道不进入中国地图，避免销售区域污染地图。
    const provinceMap = new Map<string, {
      count: number;
      crmRegions: Map<string, number>;
      cities: Map<string, { count: number; partners: Set<string> }>;
    }>();
    for (const p of partners) {
      const resolvedProvince = this.resolvePartnerProvince(p);
      if (resolvedProvince) {
        const aggregate = provinceMap.get(resolvedProvince.province) ?? {
          count: 0,
          crmRegions: new Map<string, number>(),
          cities: new Map<string, { count: number; partners: Set<string> }>(),
        };
        aggregate.count += 1;
        const crmRegion = p.region || '未设置区域';
        aggregate.crmRegions.set(crmRegion, (aggregate.crmRegions.get(crmRegion) ?? 0) + 1);
        const cityName = resolvedProvince.cityName ?? UNKNOWN_CITY_LABEL;
        const cityAggregate = aggregate.cities.get(cityName) ?? {
          count: 0,
          partners: new Set<string>(),
        };
        cityAggregate.count += 1;
        cityAggregate.partners.add(this.readDisplayText(p.partnerName) || '未命名渠道商');
        aggregate.cities.set(cityName, cityAggregate);
        provinceMap.set(resolvedProvince.province, aggregate);
      }
    }

    if (provinceMap.size === 0) {
      return null;
    }

    const regions = Array.from(provinceMap.entries())
      .map(([name, aggregate]) => {
        const topCrmRegions = Array.from(aggregate.crmRegions.entries())
          .sort((left, right) => right[1] - left[1])
          .slice(0, 3)
          .map(([regionName, count]) => `${regionName}${count}家`);
        const provinceCityNames = CHINA_PROVINCE_CITY_NAMES[name] ?? [];
        const cityGroups = Array.from(aggregate.cities.entries())
          .map(([cityName, cityAggregate]) => ({
            cityName,
            partnerCount: cityAggregate.count,
            partners: Array.from(cityAggregate.partners).sort((left, right) => left.localeCompare(right, 'zh-CN')),
          }))
          .sort((left, right) => {
            if (left.cityName === UNKNOWN_CITY_LABEL) return 1;
            if (right.cityName === UNKNOWN_CITY_LABEL) return -1;
            return right.partnerCount - left.partnerCount || left.cityName.localeCompare(right.cityName, 'zh-CN');
          });
        const coveredCityCount = cityGroups
          .filter((group) => group.cityName !== UNKNOWN_CITY_LABEL && provinceCityNames.includes(group.cityName))
          .length;
        const totalCityCount = provinceCityNames.length;
        const cityCoverageText = totalCityCount > 0
          ? `覆盖地市：${coveredCityCount}/${totalCityCount}`
          : undefined;
        const regionText = topCrmRegions.length > 0 ? `CRM区域：${topCrmRegions.join('、')}` : undefined;
        return {
          name,
          value: aggregate.count,
          extra: [cityCoverageText, regionText].filter(Boolean).join('；') || undefined,
          coveredCityCount,
          totalCityCount,
          cityGroups,
        };
      })
      .sort((left, right) => right.value - left.value);
    const coveredCount = provinceMap.size;
    const coveredCityCount = this.countCoveredCities(partners);

    return {
      blockId: 'dashboard-province-map',
      blockType: 'geo-map',
      title: '省份与地市覆盖',
      mapName: 'china',
      totalRegionCount: 31,
      coveredRegionCount: coveredCount,
      totalCityCount: CHINA_PREFECTURE_CITY_TOTAL,
      coveredCityCount,
      regions,
      unitLabel: '家',
      cityUnitLabel: '个地市',
    };
  }

  /**
   * 统计真实省份覆盖数。
   *
   * 参数说明：`partners` 为渠道贡献明细。
   * 返回值说明：返回可识别到标准中国省级名称的去重数量。
   * 调用注意事项：该数量与地图同源，避免摘要、KPI 和地图口径不一致。
   */
  private countCoveredProvinces(partners: LianruanCrmOpenApiPartnerContributionRecord[]): number {
    const provinces = new Set<string>();
    for (const partner of partners) {
      const resolvedProvince = this.resolvePartnerProvince(partner);
      if (resolvedProvince) {
        provinces.add(resolvedProvince.province);
      }
    }
    return provinces.size;
  }

  /**
   * 统计真实地市覆盖数。
   *
   * 参数说明：`partners` 为渠道贡献明细。
   * 返回值说明：返回可识别到标准地市名称的去重数量。
   * 调用注意事项：无法识别地市的渠道仍会出现在省份弹窗，但不进入地市覆盖率分子。
   */
  private countCoveredCities(partners: LianruanCrmOpenApiPartnerContributionRecord[]): number {
    const cities = new Set<string>();
    for (const partner of partners) {
      const resolvedProvince = this.resolvePartnerProvince(partner);
      if (resolvedProvince?.cityName) {
        cities.add(`${resolvedProvince.province}::${resolvedProvince.cityName}`);
      }
    }
    return cities.size;
  }

  /**
   * 解析渠道所在省份。
   *
   * 参数说明：`partner` 为 CRM 统计端点返回的渠道贡献记录。
   * 返回值说明：能识别时返回标准省级名称、地市名称和识别来源；不能识别时返回 null。
   * 调用注意事项：优先读取渠道商“所在城市”标准字段，只有单省明确的 CRM 区域才作为省份兜底。
   */
  private resolvePartnerProvince(partner: LianruanCrmOpenApiPartnerContributionRecord): ProvinceResolution | null {
    const explicitSources = [
      partner['city'],
      partner['所在城市'],
      partner['城市'],
      partner['地市'],
      partner['cityName'],
      partner['city_name'],
      partner['provinceName'],
      partner['province'],
      partner['province_name'],
      partner['所在省份'],
      partner['所在省'],
      partner['省份'],
      partner.partnerName,
      partner['partnerProvinceName'],
      partner['partnerProvince'],
      partner['partner_province_name'],
      partner['partner_province'],
      partner['partnerCityName'],
      partner['partnerCity'],
      partner['partner_city_name'],
      partner['partner_city'],
      partner['prefectureCityName'],
      partner['prefectureCity'],
      partner['prefecture_city_name'],
      partner['prefecture_city'],
      partner['address'],
      partner['registeredAddress'],
      partner['registered_address'],
      partner['officeAddress'],
      partner['office_address'],
    ].map((source) => this.readDisplayText(source));
    const regionText = this.readDisplayText(partner.region);
    const bigRegionText = this.readDisplayText(partner.bigRegion);
    const locationSources = [
      ...explicitSources,
      regionText,
      bigRegionText,
      this.readDisplayText(partner['regionName']),
      this.readDisplayText(partner['region_name']),
      this.readDisplayText(partner['regionInfo']),
      this.readDisplayText(partner['region_info']),
      this.readDisplayText(partner['area']),
      this.readDisplayText(partner['departmentName']),
      this.readDisplayText(partner['department_name']),
      this.readDisplayText(partner['team']),
      this.readDisplayText(partner['teamName']),
      this.readDisplayText(partner['team_name']),
    ];

    for (const sourceText of explicitSources) {
      const province = this.matchProvinceFromText(sourceText);
      if (province) {
        return {
          province,
          cityName: this.resolvePartnerCityName(locationSources, province) ?? undefined,
          source: sourceText,
        };
      }
    }

    const provinceFromRegion = this.matchProvinceFromText(regionText) ?? this.resolveProvinceFromCrmRegion(regionText);
    if (provinceFromRegion) {
      return {
        province: provinceFromRegion,
        cityName: this.resolvePartnerCityName(locationSources, provinceFromRegion) ?? undefined,
        source: regionText,
      };
    }

    const provinceFromBigRegion = this.resolveProvinceFromCrmRegion(bigRegionText);
    if (provinceFromBigRegion) {
      return {
        province: provinceFromBigRegion,
        cityName: this.resolvePartnerCityName(locationSources, provinceFromBigRegion) ?? undefined,
        source: bigRegionText,
      };
    }

    return null;
  }

  /**
   * 从文本中匹配标准省级名称。
   *
   * 参数说明：`text` 为渠道名称、省市字段或区域字段。
   * 返回值说明：命中省份或常见城市时返回标准省名，否则返回 null。
   * 调用注意事项：不使用“浙”“冀”等单字简称，避免把复合销售区域误判为单一省份。
   */
  private matchProvinceFromText(text: string): string | null {
    if (!text) {
      return null;
    }

    const sharedProvince = resolveChinaProvinceByText(text);
    if (sharedProvince) {
      return sharedProvince;
    }

    for (const item of CHINA_PROVINCE_KEYWORDS) {
      if (item.keywords.some((keyword) => text.includes(keyword))) {
        return item.province;
      }
    }
    return null;
  }

  /**
   * 解析渠道所在地市。
   *
   * 参数说明：`sources` 为渠道名称、省市字段、区域字段等候选文本，`province` 为已确认省份。
   * 返回值说明：命中标准地市时返回地市名称，否则返回 null。
   */
  private resolvePartnerCityName(sources: string[], province: string): string | null {
    for (const sourceText of sources) {
      const cityName = this.matchCityFromText(sourceText, province);
      if (cityName) {
        return cityName;
      }
    }
    return null;
  }

  /**
   * 从文本中匹配标准地市名称。
   *
   * 参数说明：`text` 为渠道名称或地址字段，`province` 为限定省份。
   * 返回值说明：命中当前省份的地市时返回地市名称，否则返回 null。
   */
  private matchCityFromText(text: string, province: string): string | null {
    if (!text) {
      return null;
    }

    return resolveChinaCityByText(text, province);
  }

  /**
   * 从 CRM 销售区域中兜底解析省份。
   *
   * 参数说明：`region` 为 CRM 区域或大区字段。
   * 返回值说明：仅在区域明确对应单一省份时返回省名，否则返回 null。
   * 调用注意事项：晋冀、东北、浙赣这类复合区域必须依赖渠道名称或省市字段识别，不能硬拆。
   */
  private resolveProvinceFromCrmRegion(region: string): string | null {
    if (!region) {
      return null;
    }

    return CRM_REGION_PROVINCE_FALLBACK[region] ?? null;
  }

  /**
   * 读取展示文本。
   *
   * 参数说明：`value` 为接口返回的任意字段值。
   * 返回值说明：返回去空格后的字符串；空值返回空字符串。
   */
  private readDisplayText(value: unknown): string {
    return String(value ?? '').trim();
  }

  // ===== 新增 Block 构建器：分布饼图 / 漏斗 / 趋势 =====

  /**
   * 合作级别分布饼图（LEP/金牌/银牌/钻石/未设置）
   * 数据来源：partnerSummary.byCooperationLevel
   */
  private buildCooperationLevelDistribution(
    bundle: DashboardAnalyticsBundle,
  ): DashboardBlock | null {
    const buckets = bundle.partnerSummary?.byCooperationLevel
      ?? bundle.partnerSummary?.dimensions?.byCooperationLevel;
    if (!buckets || buckets.length === 0) {
      return null;
    }

    const labelMap: Record<string, string> = {
      lep: 'LEP',
      gold: '金牌',
      silver: '银牌',
      diamond: '钻石',
    };

    const segments = buckets.map((b) => ({
      name: labelMap[b.key] ?? b.key,
      value: b.count,
    }));

    // 补充"未设置"（partnerSummary.totalCount - sum(buckets)）
    const totalCount = bundle.partnerSummary?.totalCount ?? 0;
    const labeledCount = segments.reduce((s, seg) => s + seg.value, 0);
    const unsetCount = totalCount - labeledCount;
    if (unsetCount > 0) {
      segments.push({ name: '未设置', value: unsetCount });
    }

    const insights: string[] = [];
    if (segments.length > 0) {
      const top = [...segments].sort((a, b) => b.value - a.value)[0];
      insights.push(`占比最高的是${top.name}（${top.value}家）`);
    }

    return {
      blockId: 'dashboard-cooperation-dist',
      blockType: 'pie-distribution',
      title: '合作级别分布',
      segments,
      totalValue: totalCount,
      unitLabel: '家',
      insights,
    };
  }

  /**
   * 技术服务商类型分布饼图（签约/提名/未参与）
   * 数据来源：partnerSummary.byTechServiceType
   */
  private buildTechServiceTypeDistribution(
    bundle: DashboardAnalyticsBundle,
  ): DashboardBlock | null {
    const buckets = bundle.partnerSummary?.byTechServiceType
      ?? bundle.partnerSummary?.dimensions?.byTechServiceType;
    if (!buckets || buckets.length === 0) {
      return null;
    }

    const labelMap: Record<string, string> = {
      full: '签约技术服务商',
      developing: '提名技术服务商',
      nominated: '提名技术服务商',
      none: '未参与',
    };

    const segments = buckets.map((b) => ({
      name: labelMap[b.key] ?? b.key,
      value: b.count,
    }));

    const insights: string[] = [];
    const fullCount = buckets.find((b) => b.key === 'full')?.count ?? 0;
    const developingCount = (buckets.find((b) => b.key === 'developing')?.count ?? 0)
      + (buckets.find((b) => b.key === 'nominated')?.count ?? 0);
    if (fullCount > 0) {
      insights.push(`签约技术服务商 ${fullCount} 家`);
    }
    if (developingCount > 0) {
      insights.push(`提名技术服务商 ${developingCount} 家，持续培育中`);
    }

    return {
      blockId: 'dashboard-tech-dist',
      blockType: 'pie-distribution',
      title: '技术服务商分布',
      segments,
      unitLabel: '家',
      insights,
    };
  }

  /**
   * 状态/阶段分布饼图
   * 数据来源：resourceSummary.byStatus 或 statusDistribution
   */
  private buildStatusDistribution(
    summary: LianruanCrmOpenApiResourceSummary | null,
    title: string,
  ): DashboardBlock | null {
    if (!summary) {
      return null;
    }
    const buckets = summary.byStatus ?? summary.statusDistribution
      ?? summary.dimensions?.byStatus
      ?? summary.dimensions?.statusDistribution;
    if (!buckets || buckets.length === 0) {
      return null;
    }

    const segments = buckets.map((b) => ({
      name: this.resolveDashboardBucketLabel(b.key, title, summary.resource),
      value: b.count,
    }));

    return {
      blockId: `dashboard-status-dist-${summary.resource}`,
      blockType: 'pie-distribution',
      title,
      segments,
      totalValue: summary.totalCount,
      unitLabel: '个',
    };
  }

  /**
   * 月度趋势复合图（柱状+折线）
   * 数据来源：resourceSummary.timeSeries 或 byMonth
   */
  private buildTrendFromSummary(
    summary: LianruanCrmOpenApiResourceSummary | null,
    title: string,
  ): DashboardBlock | null {
    if (!summary) {
      return null;
    }

    // 优先 timeSeries，兜底 byMonth
    const periods = summary.timeSeries;
    const monthlyBuckets = summary.byMonth ?? summary.dimensions?.byMonth;

    if (periods && periods.length > 0) {
      const categories = periods.map((p) => p.period);
      const countValues = periods.map((p) => p.count);
      const amountValues = periods.map((p) => (p.amount ?? 0) / 10000);

      return {
        blockId: `dashboard-trend-${summary.resource}`,
        blockType: 'composite-trend',
        title,
        categories,
        barSeries: [{ name: '数量', values: countValues }],
        lineSeries: [{ name: '金额（万）', values: amountValues }],
        barUnitLabel: '个',
        lineUnitLabel: '万',
      };
    }

    if (monthlyBuckets && monthlyBuckets.length > 0) {
      const categories = monthlyBuckets.map((b) => b.key);
      const countValues = monthlyBuckets.map((b) => b.count);
      const amountValues = monthlyBuckets.map((b) => (b.amount ?? 0) / 10000);

      return {
        blockId: `dashboard-trend-${summary.resource}`,
        blockType: 'composite-trend',
        title,
        categories,
        barSeries: [{ name: '数量', values: countValues }],
        lineSeries: [{ name: '金额（万）', values: amountValues }],
        barUnitLabel: '个',
        lineUnitLabel: '万',
      };
    }

    return null;
  }

  /**
   * 业务转化漏斗（报备 → 商机 → 报价 → 订单）
   * 数据来源：bundle.funnel
   */
  private buildFunnelBlock(
    bundle: DashboardAnalyticsBundle,
  ): DashboardBlock | null {
    if (!bundle.funnel) {
      return null;
    }
    const f = bundle.funnel;
    const regCount = f.registrationCount ?? 0;
    const oppCount = f.opportunityCount ?? 0;
    const quoteCount = f.quoteCount ?? 0;
    const orderCount = f.orderCount ?? 0;

    if (regCount === 0 && oppCount === 0 && quoteCount === 0 && orderCount === 0) {
      return null;
    }

    const stages = [
      { name: '客户报备', value: regCount, amount: f.registrationAmount },
      {
        name: '商机',
        value: oppCount,
        amount: f.opportunityAmount,
        rate: f.registrationToOpportunityRate,
      },
      {
        name: '报价',
        value: quoteCount,
        amount: f.quoteAmount,
        rate: f.opportunityToQuoteRate,
      },
      {
        name: '订单',
        value: orderCount,
        amount: f.orderAmount,
        rate: f.quoteToOrderRate,
      },
    ];

    const insights: string[] = [];
    if (f.registrationToOpportunityRate !== undefined) {
      insights.push(`报备转商机率 ${(f.registrationToOpportunityRate * 100).toFixed(1)}%`);
    }
    if (f.opportunityToQuoteRate !== undefined) {
      insights.push(`商机转报价率 ${(f.opportunityToQuoteRate * 100).toFixed(1)}%`);
    }
    if (f.quoteToOrderRate !== undefined) {
      insights.push(`报价转订单率 ${(f.quoteToOrderRate * 100).toFixed(1)}%`);
    }

    return {
      blockId: 'dashboard-funnel',
      blockType: 'funnel',
      title: '业务转化漏斗',
      stages,
      insights,
    };
  }

  // ===== 兜底方法：从 partnerContributions 聚合分布/漏斗数据 =====
  // 当 summary 端点失败或返回空字段时，从已成功的 partnerContributions 推导

  /**
   * 从 partnerContributions 兜底构建合作级别分布饼图
   * 当 partnerSummary.byCooperationLevel 为空但 partnerContributions 有 cooperationLevel 字段时使用
   */
  private buildCooperationLevelDistributionFromContributions(
    partners: LianruanCrmOpenApiPartnerContributionRecord[],
  ): DashboardBlock | null {
    const buckets = new Map<string, number>();
    for (const p of partners) {
      const level = p.cooperationLevel ?? 'unknown';
      buckets.set(level, (buckets.get(level) ?? 0) + 1);
    }
    if (buckets.size === 0) {
      return null;
    }

    const labelMap: Record<string, string> = {
      lep: 'LEP',
      gold: '金牌',
      silver: '银牌',
      diamond: '钻石',
      unknown: '未设置',
    };

    const segments = Array.from(buckets.entries()).map(([key, count]) => ({
      name: labelMap[key] ?? key,
      value: count,
    }));

    // 按数量降序排列
    segments.sort((a, b) => b.value - a.value);

    const insights: string[] = [];
    if (segments.length > 0) {
      const top = segments[0];
      insights.push(`占比最高的是${top.name}（${top.value}家）`);
    }

    return {
      blockId: 'dashboard-cooperation-dist-fallback',
      blockType: 'pie-distribution',
      title: '合作级别分布',
      segments,
      totalValue: partners.length,
      unitLabel: '家',
      insights,
    };
  }

  /**
   * 从 partnerContributions 兜底构建技术服务商分布饼图
   * 当 partnerSummary.byTechServiceType 为空但 partnerContributions 有 techServiceType 字段时使用
   */
  private buildTechServiceTypeDistributionFromContributions(
    partners: LianruanCrmOpenApiPartnerContributionRecord[],
  ): DashboardBlock | null {
    const buckets = new Map<string, number>();
    for (const p of partners) {
      const type = p.techServiceType ?? (p.isTechnicalServiceProvider ? 'full' : 'none');
      buckets.set(type, (buckets.get(type) ?? 0) + 1);
    }
    if (buckets.size === 0) {
      return null;
    }

    const labelMap: Record<string, string> = {
      full: '签约技术服务商',
      developing: '提名技术服务商',
      nominated: '提名技术服务商',
      none: '未参与',
    };

    const segments = Array.from(buckets.entries()).map(([key, count]) => ({
      name: labelMap[key] ?? key,
      value: count,
    }));

    segments.sort((a, b) => b.value - a.value);

    const insights: string[] = [];
    const fullCount = buckets.get('full') ?? 0;
    const developingCount = (buckets.get('developing') ?? 0) + (buckets.get('nominated') ?? 0);
    if (fullCount > 0) {
      insights.push(`签约技术服务商 ${fullCount} 家`);
    }
    if (developingCount > 0) {
      insights.push(`提名技术服务商 ${developingCount} 家，持续培育中`);
    }

    return {
      blockId: 'dashboard-tech-dist-fallback',
      blockType: 'pie-distribution',
      title: '技术服务商分布',
      segments,
      unitLabel: '家',
      insights,
    };
  }

  /**
   * 从 summary 端点或 partnerContributions 兜底构建业务转化漏斗
   * 当 bundle.funnel 为空时，尝试从各 summary.totalCount 或 partnerContributions 聚合
   */
  private buildFunnelBlockFromSummariesOrContributions(
    bundle: DashboardAnalyticsBundle,
  ): DashboardBlock | null {
    // 优先从各 summary 端点的 totalCount 构建
    const regCount = bundle.registrationSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.registrationCount ?? 0), 0);
    const oppCount = bundle.opportunitySummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.opportunityCount ?? 0), 0);
    const quoteCount = bundle.quoteSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.quoteCount ?? 0), 0);
    const orderCount = bundle.orderSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.orderCount ?? 0), 0);

    if (regCount === 0 && oppCount === 0 && quoteCount === 0 && orderCount === 0) {
      return null;
    }

    // 从 partnerContributions 汇总金额
    const regAmount = bundle.registrationSummary?.totalAmount;
    const oppAmount = bundle.opportunitySummary?.totalAmount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.opportunityAmount ?? 0), 0);
    const quoteAmount = bundle.quoteSummary?.totalAmount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.quoteAmount ?? 0), 0);
    const orderAmount = bundle.orderSummary?.totalAmount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.orderAmount ?? 0), 0);

    // 计算转化率
    const regToOppRate = regCount > 0 ? oppCount / regCount : undefined;
    const oppToQuoteRate = oppCount > 0 ? quoteCount / oppCount : undefined;
    const quoteToOrderRate = quoteCount > 0 ? orderCount / quoteCount : undefined;

    const stages = [
      { name: '客户报备', value: regCount, amount: regAmount },
      { name: '商机', value: oppCount, amount: oppAmount, rate: regToOppRate },
      { name: '报价', value: quoteCount, amount: quoteAmount, rate: oppToQuoteRate },
      { name: '订单', value: orderCount, amount: orderAmount, rate: quoteToOrderRate },
    ];

    const insights: string[] = [];
    if (regToOppRate !== undefined) {
      insights.push(`报备转商机率 ${(regToOppRate * 100).toFixed(1)}%`);
    }
    if (oppToQuoteRate !== undefined) {
      insights.push(`商机转报价率 ${(oppToQuoteRate * 100).toFixed(1)}%`);
    }
    if (quoteToOrderRate !== undefined) {
      insights.push(`报价转订单率 ${(quoteToOrderRate * 100).toFixed(1)}%`);
    }

    return {
      blockId: 'dashboard-funnel-fallback',
      blockType: 'funnel',
      title: '业务转化漏斗',
      stages,
      insights,
    };
  }

  // ===== 辅助方法：字段值翻译 =====

  /**
   * 将 cooperationLevel 枚举值转为中文标签
   */
  private resolveCooperationLevelLabel(level?: string): string {
    if (!level) return '--';
    const map: Record<string, string> = {
      lep: 'LEP',
      gold: '金牌',
      silver: '银牌',
      diamond: '钻石',
    };
    return map[level] ?? level;
  }

  /**
   * 将 techServiceType 枚举值转为中文标签
   */
  private resolveTechServiceLabel(type?: string): string {
    if (!type) return '--';
    const map: Record<string, string> = {
      full: '签约技术',
      developing: '提名',
      nominated: '提名',
      none: '未参与',
    };
    return map[type] ?? type;
  }

  /**
   * 将看板分布项枚举转换为业务中文。
   *
   * 参数说明：`rawKey` 为统计分桶原始 key，`title` 为图表标题，`resource` 为统计资源名。
   * 返回值说明：返回用户可读的中文状态、阶段或原始中文文本。
   * 调用注意事项：只改变展示层文案，不影响原始统计、排序和审计字段。
   */
  private resolveDashboardBucketLabel(rawKey: unknown, title: string, resource?: string): string {
    const rawText = this.readDisplayText(rawKey);
    if (!rawText) {
      return '未设置';
    }

    const normalizedKey = rawText.toLowerCase().replace(/\s+/gu, '_');
    const context = `${title} ${resource ?? ''}`.toLowerCase();

    if (title.includes('商机') || context.includes('opportunit')) {
      return formatOpportunityStageLabel(rawText);
    }

    if (title.includes('报价') || context.includes('quote')) {
      return QUOTE_STATUS_LABELS[normalizedKey] ?? COMMON_STATUS_LABELS[normalizedKey] ?? rawText;
    }

    if (title.includes('订单') || context.includes('order')) {
      return ORDER_STATUS_LABELS[normalizedKey] ?? COMMON_STATUS_LABELS[normalizedKey] ?? rawText;
    }

    return COMMON_STATUS_LABELS[normalizedKey] ?? rawText;
  }

  // ===== 摘要构建 =====

  private buildReportTitle(profile: DashboardProfile, query: DashboardAnalyticsQuery): string {
    const scope = query.region ? `${query.region} ` : '';
    switch (profile) {
      case 'channel-order-summary':
        return `${scope}渠道下单汇总分析`;
      case 'agent-development':
        return `${scope}代理商发展运营看板`;
      case 'region-overview':
        return `${scope}区域经营概览`;
      case 'owner-performance':
        return `${scope}负责人业绩看板`;
      default:
        return '经营分析看板';
    }
  }

  private buildExecutiveSummary(profile: DashboardProfile, bundle: DashboardAnalyticsBundle): string {
    const parts: string[] = [];
    const partnerCount = bundle.partnerSummary?.totalCount ?? bundle.partnerContributions.length;
    const totalAmount = bundle.orderSummary?.totalAmount
      ? bundle.orderSummary.totalAmount / 10000
      : bundle.partnerContributions.reduce((s, p) => s + (p.orderAmount ?? 0), 0);
    const totalOrders = bundle.orderSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.orderCount ?? 0), 0);

    if (partnerCount > 0) {
      parts.push(`共 ${partnerCount} 家渠道`);
    }
    // 合作级别摘要（兜底从 partnerContributions 聚合）
    let coopoBuckets = bundle.partnerSummary?.byCooperationLevel
      ?? bundle.partnerSummary?.dimensions?.byCooperationLevel;
    if ((!coopoBuckets || coopoBuckets.length === 0) && bundle.partnerContributions.length > 0) {
      const levelCounts = new Map<string, number>();
      for (const p of bundle.partnerContributions) {
        const level = p.cooperationLevel ?? 'unknown';
        levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
      }
      coopoBuckets = Array.from(levelCounts.entries()).map(([key, count]) => ({ key, count }));
    }
    if (coopoBuckets && coopoBuckets.length > 0) {
      const levelSummary = coopoBuckets
        .map((b) => `${this.resolveCooperationLevelLabel(b.key)}${b.count}家`)
        .join('、');
      parts.push(levelSummary);
    }
    // 技术服务商摘要（兜底从 partnerContributions 聚合）
    let techBuckets = bundle.partnerSummary?.byTechServiceType
      ?? bundle.partnerSummary?.dimensions?.byTechServiceType;
    if ((!techBuckets || techBuckets.length === 0) && bundle.partnerContributions.length > 0) {
      const techCounts = new Map<string, number>();
      for (const p of bundle.partnerContributions) {
        const type = p.techServiceType ?? (p.isTechnicalServiceProvider ? 'full' : 'none');
        techCounts.set(type, (techCounts.get(type) ?? 0) + 1);
      }
      techBuckets = Array.from(techCounts.entries()).map(([key, count]) => ({ key, count }));
    }
    if (techBuckets && techBuckets.length > 0) {
      const fullCount = techBuckets.find((b) => b.key === 'full')?.count ?? 0;
      const developingCount = (techBuckets.find((b) => b.key === 'developing')?.count ?? 0)
        + (techBuckets.find((b) => b.key === 'nominated')?.count ?? 0);
      if (fullCount > 0 || developingCount > 0) {
        parts.push(`签约技术${fullCount}家、提名${developingCount}家`);
      }
    }
    // 覆盖摘要与地图同源，优先展示地市覆盖，再补充省份覆盖。
    const coveredCityCount = this.countCoveredCities(bundle.partnerContributions);
    if (coveredCityCount > 0) {
      parts.push(`覆盖${coveredCityCount}个地市`);
    }
    const coveredProvinceCount = this.countCoveredProvinces(bundle.partnerContributions);
    if (coveredProvinceCount > 0) {
      parts.push(`覆盖${coveredProvinceCount}个省份`);
    }
    // 报备/商机/报价/订单漏斗摘要（兜底从 partnerContributions 聚合）
    const regCount = bundle.funnel?.registrationCount
      ?? bundle.registrationSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.registrationCount ?? 0), 0);
    const oppCount = bundle.funnel?.opportunityCount
      ?? bundle.opportunitySummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.opportunityCount ?? 0), 0);
    const quoteCount = bundle.funnel?.quoteCount
      ?? bundle.quoteSummary?.totalCount
      ?? bundle.partnerContributions.reduce((s, p) => s + (p.quoteCount ?? 0), 0);
    if (regCount !== undefined && regCount > 0) {
      parts.push(`报备${regCount}个`);
    }
    if (oppCount !== undefined && oppCount > 0) {
      const oppAmount = bundle.opportunitySummary?.totalAmount
        ?? bundle.funnel?.opportunityAmount;
      if (oppAmount !== undefined && oppAmount > 0) {
        parts.push(`商机${oppCount}个（${(oppAmount / 10000).toFixed(0)}万）`);
      } else {
        parts.push(`商机${oppCount}个`);
      }
    }
    if (quoteCount !== undefined && quoteCount > 0) {
      parts.push(`报价${quoteCount}个`);
    }
    if (totalOrders > 0) {
      parts.push(`${totalOrders} 单`);
    }
    if (totalAmount > 0) {
      parts.push(`下单总额 ${totalAmount.toFixed(2)} 万元`);
    }
    // 漏斗转化率摘要（兜底从聚合数据计算）
    const orderCount = totalOrders;
    if (bundle.funnel) {
      const f = bundle.funnel;
      const rates: string[] = [];
      if (f.registrationToOpportunityRate !== undefined) {
        rates.push(`报备转商机${(f.registrationToOpportunityRate * 100).toFixed(0)}%`);
      }
      if (f.opportunityToQuoteRate !== undefined) {
        rates.push(`商机转报价${(f.opportunityToQuoteRate * 100).toFixed(0)}%`);
      }
      if (f.quoteToOrderRate !== undefined) {
        rates.push(`报价转订单${(f.quoteToOrderRate * 100).toFixed(0)}%`);
      }
      if (rates.length > 0) {
        parts.push(`转化率：${rates.join('、')}`);
      }
    } else if (regCount > 0 || oppCount > 0 || quoteCount > 0) {
      // 兜底：从聚合数据计算转化率
      const rates: string[] = [];
      if (regCount > 0 && oppCount > 0) {
        rates.push(`报备转商机${((oppCount / regCount) * 100).toFixed(0)}%`);
      }
      if (oppCount > 0 && quoteCount > 0) {
        rates.push(`商机转报价${((quoteCount / oppCount) * 100).toFixed(0)}%`);
      }
      if (quoteCount > 0 && orderCount > 0) {
        rates.push(`报价转订单${((orderCount / quoteCount) * 100).toFixed(0)}%`);
      }
      if (rates.length > 0) {
        parts.push(`转化率：${rates.join('、')}（估算）`);
      }
    }

    const dataSourceLabel = bundle.dataSource === 'OPENAPI_REALTIME' ? '实时数据' : 'CRM 同步数据（部分实时接口不可用）';
    parts.push(`数据来源：${dataSourceLabel}`);

    return parts.join('，');
  }

  private buildScopeSummary(query: DashboardAnalyticsQuery, bundle: DashboardAnalyticsBundle): string {
    const parts: string[] = [];
    if (query.region) parts.push(`区域：${query.region}`);
    if (query.bigRegion) parts.push(`大区：${query.bigRegion}`);
    if (query.partnerId) parts.push(`渠道：${query.partnerId}`);
    parts.push(`数据获取时间：${bundle.fetchedAt}`);
    if (bundle.errors.length > 0) {
      parts.push(`部分接口异常：${bundle.errors.length} 个`);
    }
    return parts.join(' | ');
  }
}
