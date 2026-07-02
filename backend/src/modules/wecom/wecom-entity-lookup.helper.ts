import type {
  CustomerLookupRecord,
} from '../opportunities/crm-customer-api.service';
import type {
  OpportunityLookupRecord,
} from '../opportunities/crm-opportunity-api.service';
import type { WecomEntityLookupListItem } from '../../shared/types/domain';

/**
 * 将客户候选转换为企业微信列表态快照，供上一轮列表引用继续查看详情。
 */
export function buildCustomerListItems(
  records: CustomerLookupRecord[],
): WecomEntityLookupListItem[] {
  return records.map((record) => ({
    id: record.id,
    entityType: 'Customer',
    displayTitle: record.name,
    ownerName: record.ownerName,
    summaryFields: [record.category, record.ownerName].filter(
      (item): item is string => Boolean(item),
    ),
  }));
}

/**
 * 将商机候选转换为企业微信列表态快照，供上一轮列表引用继续查看详情。
 */
export function buildOpportunityListItems(
  records: OpportunityLookupRecord[],
): WecomEntityLookupListItem[] {
  return records.map((record) => ({
    id: record.id,
    entityType: 'Opportunity',
    displayTitle: record.title,
    ownerName: record.ownerName,
    summaryFields: [
      record.customerName,
      record.stage,
      Number.isFinite(record.expectAmount)
        ? `预计${record.expectAmount.toLocaleString()}`
        : undefined,
      record.ownerName,
    ].filter((item): item is string => Boolean(item)),
  }));
}

/**
 * 统一构造客户/商机列表回复，明确告诉用户当前只展开前 N 条并可继续看详情。
 */
export function buildEntityLookupListReply(params: {
  entityType: 'Customer' | 'Opportunity';
  totalCount: number;
  items: WecomEntityLookupListItem[];
}): string {
  const objectLabel = params.entityType === 'Customer' ? '客户' : '商机';
  const header = `已找到 ${params.totalCount} 条${objectLabel}，先给你前 ${params.items.length} 条：`;
  const lines = params.items.map((item, index) => {
    const detailText = item.summaryFields.join('｜');
    return detailText
      ? `候选${index + 1}：${item.displayTitle}（${detailText}）`
      : `候选${index + 1}：${item.displayTitle}`;
  });

  return [
    header,
    ...lines,
    '如需看详情，请直接回复“第2个详情”或“候选2”。',
  ].join('\n');
}

/**
 * 统一构造客户详情回复，首版只返回当前链路稳定可得字段。
 */
export function buildCustomerDetailReply(record: CustomerLookupRecord): string {
  return [
    `客户详情：${record.name}`,
    `客户分类：${record.category ?? '未分类'}`,
    `负责人：${record.ownerName}`,
    record.departmentId ? `所属部门：${record.departmentId}` : undefined,
    record.organizationId ? `所属组织：${record.organizationId}` : undefined,
    record.createdAt ? `创建时间：${record.createdAt}` : undefined,
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n');
}

/**
 * 统一构造商机详情回复，首版只返回当前链路稳定可得字段。
 */
export function buildOpportunityDetailReply(
  record: OpportunityLookupRecord,
): string {
  return [
    `商机详情：${record.title}`,
    record.customerName ? `所属客户：${record.customerName}` : undefined,
    `当前阶段：${record.stage}`,
    `预计金额：${record.expectAmount.toLocaleString()}`,
    `负责人：${record.ownerName}`,
    record.departmentId ? `所属部门：${record.departmentId}` : undefined,
    record.organizationId ? `所属组织：${record.organizationId}` : undefined,
    record.createdAt ? `创建时间：${record.createdAt}` : undefined,
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n');
}

/**
 * 统一构造列表态失效或序号越界时的澄清提示。
 */
export function buildEntityLookupClarificationReply(params: {
  entityType?: 'Customer' | 'Opportunity';
  reason:
    | 'MISSING_ENTITY_TYPE'
    | 'MISSING_QUERY'
    | 'NO_RESULTS'
    | 'MISSING_LIST_MEMORY'
    | 'INVALID_SELECTION'
    | 'DETAIL_NOT_FOUND';
}): string {
  const objectLabel =
    params.entityType === 'Customer'
      ? '客户'
      : params.entityType === 'Opportunity'
        ? '商机'
        : '对象';

  switch (params.reason) {
    case 'MISSING_ENTITY_TYPE':
      return '我还没确定你要查客户还是商机，请补充更明确的对象名称或类型。';
    case 'MISSING_QUERY':
      return `请补充更完整的${objectLabel}名称，我再继续帮你查。`;
    case 'NO_RESULTS':
      return `当前没查到可继续跟进的${objectLabel}，请补充更完整的名称后再试。`;
    case 'MISSING_LIST_MEMORY':
      return '当前没有可引用的上一轮列表，请先重新查询客户或商机列表。';
    case 'INVALID_SELECTION':
      return '当前候选序号无效，请直接回复已有候选范围内的序号。';
    case 'DETAIL_NOT_FOUND':
      return `当前无法读取该${objectLabel}的详情，请重新查询后再试。`;
    default:
      return '当前无法处理这次查询，请稍后再试。';
  }
}
