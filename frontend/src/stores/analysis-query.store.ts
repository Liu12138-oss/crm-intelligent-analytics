import { defineStore } from 'pinia';
import { analysisService } from '@/services/analysis.service';
import { triggerBrowserDownload } from '@/utils/browser-download';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';
import { useAuthStore } from './auth.store';
import type {
  AnalysisCapability,
  AnalysisQueryResult,
  AnalysisRoute,
  QueryTemplateItem,
  QueryTemplateListParams,
  RecentQueryItem,
  SaveQueryAsTemplatePayload,
  UpdateMyQueryTemplatePayload,
} from '@/types/analysis';

const ANALYSIS_BOOTSTRAP_TTL_MS = 30 * 1000;
const ANALYSIS_TOAST_AUTO_DISMISS_MS = 3000;
let bootstrapPromise: Promise<void> | null = null;
let feedbackDismissTimer: number | undefined;

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';
type SelectedAnalysisRoute = 'DEFAULT' | AnalysisRoute;
type AnalysisViewState =
  | 'idle'
  | 'clarifying'
  | 'running'
  | 'queued'
  | 'reported'
  | 'blocked'
  | 'failed';

interface AnalysisQueryState {
  capabilities: AnalysisCapability | null;
  templates: QueryTemplateItem[];
  templateListMeta: {
    scope: 'mine' | 'others' | 'all';
    page: number;
    pageSize: number;
    total: number;
    tags: string[];
  };
  histories: RecentQueryItem[];
  currentResult: AnalysisQueryResult | null;
  queryText: string;
  analysisRoute: SelectedAnalysisRoute;
  activeQuestionText: string;
  isBootstrapping: boolean;
  isTemplateListLoading: boolean;
  isSubmitting: boolean;
  isSubmittingFollowUp: boolean;
  isExporting: boolean;
  isSavingTemplate: boolean;
  isUpdatingTemplate: boolean;
  deletingTemplateId: string | null;
  bootstrapped: boolean;
  bootstrapHydratedAt: number | null;
  errorMessage: string;
  feedbackMessage: string;
  feedbackTone: FeedbackTone;
  followUpText: string;
  viewState: AnalysisViewState;
}

export const useAnalysisQueryStore = defineStore('analysisQuery', {
  state: (): AnalysisQueryState => ({
    capabilities: null,
    templates: [],
    templateListMeta: {
      scope: 'mine',
      page: 1,
      pageSize: 20,
      total: 0,
      tags: [],
    },
    histories: [],
    currentResult: null,
    queryText: '',
    analysisRoute: 'DEFAULT',
    activeQuestionText: '',
    isBootstrapping: false,
    isTemplateListLoading: false,
    isSubmitting: false,
    isSubmittingFollowUp: false,
    isExporting: false,
    isSavingTemplate: false,
    isUpdatingTemplate: false,
    deletingTemplateId: null,
    bootstrapped: false,
    bootstrapHydratedAt: null,
    errorMessage: '',
    feedbackMessage: '',
    feedbackTone: 'info',
    followUpText: '',
    viewState: 'idle',
  }),
  getters: {
    hasResult: (state) => state.viewState === 'reported',
    hasClarification: (state) => state.viewState === 'clarifying',
    isRunning: (state) => state.viewState === 'running',
  },
  actions: {
    setViewState(viewState: AnalysisViewState): void {
      this.viewState = viewState;
    },

    dismissFeedback(): void {
      if (feedbackDismissTimer && typeof window !== 'undefined') {
        window.clearTimeout(feedbackDismissTimer);
        feedbackDismissTimer = undefined;
      }
      this.feedbackMessage = '';
      this.errorMessage = '';
    },

    setFeedback(message: string, tone: FeedbackTone = 'info'): void {
      if (feedbackDismissTimer && typeof window !== 'undefined') {
        window.clearTimeout(feedbackDismissTimer);
        feedbackDismissTimer = undefined;
      }
      this.feedbackMessage = message;
      this.feedbackTone = tone;
      this.errorMessage = tone === 'error' ? message : '';
      if (typeof window !== 'undefined') {
        feedbackDismissTimer = window.setTimeout(() => {
          this.dismissFeedback();
        }, ANALYSIS_TOAST_AUTO_DISMISS_MS);
      }
    },

    clearFeedback(): void {
      if (feedbackDismissTimer && typeof window !== 'undefined') {
        window.clearTimeout(feedbackDismissTimer);
        feedbackDismissTimer = undefined;
      }
      this.feedbackMessage = '';
      this.errorMessage = '';
      this.feedbackTone = 'info';
      if (this.viewState !== 'running') {
        this.viewState = this.currentResult?.status === 'RETURNED' ? 'reported' : 'idle';
      }
    },

    async bootstrap(force = false): Promise<void> {
      if (
        !force &&
        this.bootstrapped &&
        this.bootstrapHydratedAt !== null &&
        Date.now() - this.bootstrapHydratedAt < ANALYSIS_BOOTSTRAP_TTL_MS
      ) {
        return;
      }
      if (bootstrapPromise) {
        return bootstrapPromise;
      }

      this.isBootstrapping = true;
      this.isTemplateListLoading = true;
      this.clearFeedback();

      const authStore = useAuthStore();
      const bootstrapWarnings: string[] = [];

      bootstrapPromise = (async () => {
        try {
          // 登录成功和路由守卫阶段都已经做过能力快照加载，分析页首屏优先复用现成结果，
          // 避免刚进入工作台就并发触发多次会话鉴权与身份查询。
          this.capabilities = await authStore.loadCapabilities(force);

          const [templatesResult, historiesResult] = await Promise.allSettled([
            analysisService.listTemplates({ scope: 'mine', sort: 'usage_desc' }),
            analysisService.listRecentQueries(),
          ]);

          if (templatesResult.status === 'fulfilled') {
            this.templates = templatesResult.value.items;
            this.templateListMeta = {
              scope: 'mine',
              page: templatesResult.value.page ?? 1,
              pageSize: templatesResult.value.pageSize ?? 20,
              total: templatesResult.value.total ?? templatesResult.value.items.length,
              tags: templatesResult.value.tags ?? [],
            };
          } else {
            this.templates = [];
            bootstrapWarnings.push(
              templatesResult.reason instanceof Error
                ? templatesResult.reason.message
                : '常用查询加载失败',
            );
          }

          if (historiesResult.status === 'fulfilled') {
            this.histories = historiesResult.value.items;
          } else {
            this.histories = [];
            bootstrapWarnings.push(
              historiesResult.reason instanceof Error
                ? historiesResult.reason.message
                : '最近查询加载失败',
            );
          }

          this.bootstrapped = true;
          this.bootstrapHydratedAt = Date.now();
          if (bootstrapWarnings.length > 0) {
            this.setFeedback(
              toUserFacingErrorMessage(
                bootstrapWarnings[0],
                '工作台有部分内容暂时没有加载完成，请稍后刷新重试。',
              ),
              'warning',
            );
          }
        } catch (error) {
          this.setFeedback(
            toUserFacingErrorMessage(
              error,
              '工作台初始化暂未完成，请稍后刷新重试；如果多次失败，请联系管理员。',
            ),
            'error',
          );
        } finally {
          this.isBootstrapping = false;
          this.isTemplateListLoading = false;
          bootstrapPromise = null;
        }
      })();

      return bootstrapPromise;
    },

    async submitQuery(questionText?: string): Promise<void> {
      const text = (questionText ?? this.queryText).trim();
      if (!text) {
        this.setFeedback('请输入要分析的 CRM 问题后再开始查询。', 'warning');
        return;
      }

      this.isSubmitting = true;
      this.setViewState('running');
      this.clearFeedback();
      this.queryText = text;
      this.activeQuestionText = text;
      this.currentResult = null;

      try {
        const created = await analysisService.createQuery({
          querySource: 'FREE_TEXT',
          channel: 'web-console',
          questionText: text,
          analysisRoute: this.resolvePayloadAnalysisRoute(),
        });

        this.currentResult = created;
        await this.handleCreatedResult(created);
      } catch (error) {
        this.currentResult = null;
        this.setViewState('failed');
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '本次分析暂时没有成功提交，请稍后重试；如果多次失败，请联系管理员。',
          ),
          'error',
        );
      } finally {
        this.isSubmitting = false;
      }
    },

    async submitFollowUp(questionText?: string): Promise<void> {
      if (this.isSubmittingFollowUp) {
        return;
      }

      const text = (questionText ?? this.followUpText).trim();
      if (!text) {
        this.setFeedback('请输入要追问的内容后再提交。', 'warning');
        return;
      }

      const sourceQueryId = this.currentResult?.queryId;
      if (!sourceQueryId) {
        this.setFeedback('请先完成一次分析，再基于当前结果继续追问。', 'warning');
        return;
      }

      this.isSubmittingFollowUp = true;
      this.clearFeedback();
      const previousResult = this.currentResult;

      try {
        const created = await analysisService.createQuery({
          querySource: 'FREE_TEXT',
          channel: 'web-console',
          questionText: text,
          followUpQueryId: sourceQueryId,
          analysisRoute: this.resolvePayloadAnalysisRoute(),
        });

        if (created.status !== 'RETURNED') {
          this.currentResult = previousResult;
          this.setViewState(previousResult?.status === 'RETURNED' ? 'reported' : 'failed');
          this.setFeedback(
            created.clarificationPrompt ??
              (created.status === 'BLOCKED'
                ? '追问已被系统拦截，请调整查询条件后重试。'
                : '追问暂时没有生成新结果，请调整后重试。'),
            created.status === 'BLOCKED' ? 'error' : 'warning',
          );
          return;
        }

        await this.handleCreatedResult(created);
        this.followUpText = '';
      } catch (error) {
        this.setViewState(this.currentResult?.status === 'RETURNED' ? 'reported' : 'failed');
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '追问暂时没有提交成功，请稍后重试；如果多次失败，请联系管理员。',
          ),
          'error',
        );
      } finally {
        this.isSubmittingFollowUp = false;
      }
    },

    async runTemplate(templateId: string): Promise<void> {
      this.isSubmitting = true;
      this.setViewState('running');
      this.clearFeedback();
      this.currentResult = null;

      try {
        const template = this.templates.find((item) => item.templateId === templateId);
        this.queryText = template?.defaultQuestionText ?? this.queryText;
        this.activeQuestionText = template?.defaultQuestionText ?? this.activeQuestionText;

        const executed = await analysisService.executeTemplate(templateId, {
          parameters: template?.defaultFilters ?? {},
          includeAiReport: true,
        });
        this.currentResult = await analysisService.getQuery(executed.queryId);
        this.setViewState('reported');
        await this.refreshHistories();
        await this.refreshTemplates({
          scope: this.templateListMeta.scope,
          page: this.templateListMeta.page,
          pageSize: this.templateListMeta.pageSize,
        });
        if (this.shouldRequestRichReport(this.currentResult)) {
          void this.requestRichReport(executed.queryId);
        }
        this.setFeedback(
          this.currentResult.report?.detailMarkdown
            ? '模板数据与完整分析报告均已生成。'
            : '模板数据已返回，AI 报告正在补充生成。',
          'success',
        );
      } catch (error) {
        this.currentResult = null;
        this.setViewState('failed');
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '当前常用查询暂时无法执行，请换一个查询，或联系管理员协助处理。',
          ),
          'error',
        );
      } finally {
        this.isSubmitting = false;
      }
    },

    async rerunHistory(historyId: string, questionText?: string): Promise<void> {
      this.isSubmitting = true;
      this.setViewState('running');
      this.clearFeedback();
      this.currentResult = null;

      try {
        const history = this.histories.find((item) => item.historyId === historyId);
        const resolvedQuestion = (questionText ?? history?.questionText ?? '').trim();
        if (resolvedQuestion) {
          this.queryText = resolvedQuestion;
          this.activeQuestionText = resolvedQuestion;
        }

        const created = await analysisService.rerunHistory(historyId, {
          overrideQuestionText: resolvedQuestion || undefined,
          channel: 'web-console',
          analysisRoute: this.resolvePayloadAnalysisRoute(),
        });

        this.currentResult = created;
        await this.handleCreatedResult(created);
      } catch (error) {
        this.currentResult = null;
        this.setViewState('failed');
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '最近查询暂时无法重新执行，请稍后重试，或换一个查询继续查看。',
          ),
          'error',
        );
      } finally {
        this.isSubmitting = false;
      }
    },

    async exportCurrentResult(): Promise<void> {
      if (!this.currentResult?.queryId || this.isExporting) {
        return;
      }

      this.isExporting = true;
      this.clearFeedback();

      try {
        const response = await analysisService.createExport(this.currentResult.queryId, 'csv');
        if (response.status === 'COMPLETED' && response.content && response.fileName && response.mimeType) {
          triggerBrowserDownload({
            fileName: response.fileName,
            mimeType: response.mimeType,
            content: response.content,
          });
        }
        this.setFeedback(
          response.status === 'BLOCKED'
            ? String(response.blockedReason ?? '导出被拦截')
            : '导出文件已开始下载。',
          response.status === 'BLOCKED' ? 'warning' : 'success',
        );
      } catch (error) {
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '当前结果暂时无法导出，请稍后重试；如果多次失败，请联系管理员。',
          ),
          'error',
        );
      } finally {
        this.isExporting = false;
      }
    },

    async refreshHistories(): Promise<void> {
      const histories = await analysisService.listRecentQueries();
      this.histories = histories.items;
    },

    async refreshTemplates(params?: QueryTemplateListParams): Promise<void> {
      this.isTemplateListLoading = true;
      try {
        const response = await analysisService.listTemplates({
          scope: params?.scope ?? this.templateListMeta.scope,
          keyword: params?.keyword,
          tag: params?.tag,
          ownerUserId: params?.ownerUserId,
          page: params?.page ?? 1,
          pageSize: params?.pageSize ?? this.templateListMeta.pageSize,
          sort: params?.sort ?? 'usage_desc',
        });
        this.templates = response.items;
        this.templateListMeta = {
          scope: params?.scope ?? this.templateListMeta.scope,
          page: response.page ?? params?.page ?? 1,
          pageSize: response.pageSize ?? params?.pageSize ?? this.templateListMeta.pageSize,
          total: response.total ?? response.items.length,
          tags: response.tags ?? [],
        };
      } finally {
        this.isTemplateListLoading = false;
      }
    },

    async copyTemplateToMine(templateId: string): Promise<void> {
      try {
        await analysisService.copyTemplateToMine(templateId);
        this.setFeedback('已添加到我的模板。', 'success');
        await this.refreshTemplates({ scope: this.templateListMeta.scope });
      } catch (error) {
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '当前模板暂时无法添加到我的模板，请稍后重试；如果多次失败，请联系管理员。',
          ),
          'error',
        );
      }
    },

    async deleteMyTemplate(templateId: string): Promise<void> {
      if (this.deletingTemplateId) {
        return;
      }

      this.deletingTemplateId = templateId;
      try {
        await analysisService.deleteMyTemplate(templateId);
        this.setFeedback('模板已删除。', 'success');
        await this.refreshTemplates({
          scope: this.templateListMeta.scope,
          page: this.templateListMeta.page,
          pageSize: this.templateListMeta.pageSize,
        });
      } catch (error) {
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '当前模板暂时无法删除，请确认这是你自己的模板后再试。',
          ),
          'error',
        );
      } finally {
        this.deletingTemplateId = null;
      }
    },

    async updateMyTemplate(
      templateId: string,
      payload: UpdateMyQueryTemplatePayload,
    ): Promise<QueryTemplateItem | null> {
      if (this.isUpdatingTemplate) {
        return null;
      }

      this.isUpdatingTemplate = true;
      try {
        const updatedTemplate = await analysisService.updateMyTemplate(templateId, payload);
        this.templates = this.templates.map((item) =>
          item.templateId === templateId ? updatedTemplate : item,
        );
        this.setFeedback('模板已保存。', 'success');
        await this.refreshTemplates({
          scope: this.templateListMeta.scope,
          page: this.templateListMeta.page,
          pageSize: this.templateListMeta.pageSize,
        });
        return updatedTemplate;
      } catch (error) {
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '当前模板暂时无法保存，请确认这是你自己的模板后再试。',
          ),
          'error',
        );
        return null;
      } finally {
        this.isUpdatingTemplate = false;
      }
    },

    async saveCurrentResultAsTemplate(payload: SaveQueryAsTemplatePayload): Promise<void> {
      if (!this.currentResult?.queryId || this.isSavingTemplate) {
        return;
      }

      this.isSavingTemplate = true;
      try {
        await analysisService.saveQueryAsTemplate(this.currentResult.queryId, payload);
        this.setFeedback('当前结果已保存为我的模板。', 'success');
        await this.refreshTemplates({ scope: 'mine' });
      } catch (error) {
        this.setFeedback(
          toUserFacingErrorMessage(
            error,
            '当前结果暂时无法保存为模板，请确认结果已成功返回后再试。',
          ),
          'error',
        );
      } finally {
        this.isSavingTemplate = false;
      }
    },

    async handleCreatedResult(created: AnalysisQueryResult): Promise<void> {
      if (created.status === 'RETURNED' && created.queryId) {
        this.currentResult = await analysisService.getQuery(created.queryId);
        this.setViewState('reported');
        await this.refreshHistories();
        if (this.shouldRequestRichReport(this.currentResult)) {
          void this.requestRichReport(created.queryId);
        }
        this.setFeedback('分析结果已生成，并通过当前权限范围校验。', 'success');
        return;
      }

      if (created.status === 'CLARIFICATION_REQUIRED') {
        this.setViewState('clarifying');
        this.setFeedback(
          created.clarificationPrompt ?? '当前问题还需要补充条件后才能继续分析。',
          'warning',
        );
        return;
      }

      if (created.status === 'BLOCKED') {
        this.setViewState('blocked');
        this.setFeedback(
          created.clarificationPrompt ?? '当前问题已被系统拦截，请调整后重试。',
          'error',
        );
        return;
      }

      if (created.status === 'QUEUED') {
        this.setViewState('queued');
        this.setFeedback(
          created.queueNotice ?? '当前会话已有请求处理中，请等上一条完成后再重新发起分析。',
          'warning',
        );
        return;
      }

      this.setViewState('running');
      this.setFeedback('当前请求已提交，正在等待分析结果。', 'info');
    },

    shouldRequestRichReport(result: AnalysisQueryResult | null): boolean {
      return Boolean(
        result?.queryId &&
        result?.report &&
        !result.report.detailMarkdown &&
        !result.report.analysisConfidence,
      );
    },

    async requestRichReport(queryId: string): Promise<void> {
      try {
        const response = await analysisService.getQueryReport(queryId, {
          waitMs: 55000,
        });

        if (response.status !== 'READY' || !response.report || queryId !== this.currentResult?.queryId) {
          return;
        }

        this.currentResult = {
          ...this.currentResult,
          report: response.report,
          keyFindings: response.keyFindings ?? this.currentResult.keyFindings,
          groundedMarkdown: response.groundedMarkdown ?? this.currentResult.groundedMarkdown,
          wecomMarkdown: response.wecomMarkdown ?? this.currentResult.wecomMarkdown,
          markdownOutline: response.markdownOutline ?? this.currentResult.markdownOutline,
          completedAt: response.completedAt ?? this.currentResult.completedAt,
        };
      } catch {
        // AI 报告是第二阶段增强能力，不应因为补充分析失败而打断已展示的数据结果区。
      }
    },

    resolvePayloadAnalysisRoute(): AnalysisRoute | undefined {
      return this.analysisRoute === 'DEFAULT' ? undefined : this.analysisRoute;
    },
  },
});
