import type { DailyReportFragmentType } from '../../shared/types/domain';

export const DAILY_REPORT_SECTION_ORDER: DailyReportFragmentType[] = [
  'TODAY_FOLLOW_UP',
  'CUSTOMER_OR_OPPORTUNITY_CHANGE',
  'INFORMATION_SHARE',
  'HELP_REQUIRED',
  'TOMORROW_PLAN',
];

export const DAILY_REPORT_SECTION_LABELS: Record<DailyReportFragmentType, string> = {
  TODAY_FOLLOW_UP: '今日跟进',
  CUSTOMER_OR_OPPORTUNITY_CHANGE: '客户/商机变化',
  HELP_REQUIRED: '需要协助',
  INFORMATION_SHARE: '信息共享',
  TOMORROW_PLAN: '计划',
};

export function getDailyReportNextSectionType(
  fragmentTypes: DailyReportFragmentType[],
): DailyReportFragmentType | undefined {
  return DAILY_REPORT_SECTION_ORDER.find(
    (sectionType) => !fragmentTypes.includes(sectionType),
  );
}

export function getDailyReportSectionLabel(
  sectionType: DailyReportFragmentType,
): string {
  return DAILY_REPORT_SECTION_LABELS[sectionType];
}
