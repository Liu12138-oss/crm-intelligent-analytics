<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ElAlert,
  ElButton,
  ElIcon,
  ElInput,
  ElSwitch,
  ElTag,
} from 'element-plus';
import type {
  LianruanCrmConfigTestResult,
  LianruanCrmDiagnosticsView,
} from '@/types/analysis';
import { analysisService } from '@/services/analysis.service';
import { useAuthStore } from '@/stores/auth.store';
import { UiIcons } from '@/ui/icons';
import { resolveFeedbackTone } from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const authStore = useAuthStore();
const form = reactive({
  maxOnlineSessions: 200,
  maxConcurrentQueries: 50,
  heartbeatIntervalSeconds: 30,
  idleTimeoutSeconds: 120,
  historyRetentionDays: 30,
});

const feedback = ref('');
const feedbackTone = ref<'info' | 'success' | 'warning' | 'error'>('info');
const saving = ref(false);
const loadingLianruanConfig = ref(false);
const savingLianruanConfig = ref(false);
const testingLianruanConfig = ref(false);
const loadingLianruanDiagnostics = ref(false);
const lianruanFeedback = ref('');
const lianruanFeedbackTone = ref<'info' | 'success' | 'warning' | 'error'>('info');
const lianruanTestResult = ref<LianruanCrmConfigTestResult | null>(null);
const lianruanDiagnostics = ref<LianruanCrmDiagnosticsView | null>(null);
const lianruanConfigMeta = reactive({
  source: 'env' as 'env' | 'runtime' | 'mixed',
  effectiveEnabled: false,
  appKeyMasked: '',
  appKeyPresent: false,
  appSecretPresent: false,
  updatedBy: '',
  updatedAt: '',
});
const lianruanForm = reactive({
  enabled: true,
  baseUrl: '',
  appKey: '',
  appSecret: '',
  timeoutMs: 12000,
  tokenCacheBufferSeconds: 60,
});
const lianruanFieldResources = computed(
  () => lianruanDiagnostics.value?.fieldCapabilities?.resources ?? [],
);
const lianruanMissingP0Fields = computed(
  () => lianruanDiagnostics.value?.fieldCapabilities?.overall.missingP0Fields ?? [],
);
const lianruanPermissionResources = computed(
  () => Object.entries(lianruanDiagnostics.value?.permissionView?.resources ?? {}),
);

async function loadPolicy() {
  const policy = await analysisService.getCurrentPolicy();
  form.maxOnlineSessions = policy.maxOnlineSessions;
  form.maxConcurrentQueries = policy.maxConcurrentQueries;
  form.heartbeatIntervalSeconds = policy.heartbeatIntervalSeconds;
  form.idleTimeoutSeconds = policy.idleTimeoutSeconds;
  form.historyRetentionDays = policy.historyRetentionDays;
}

async function loadLianruanConfig() {
  loadingLianruanConfig.value = true;
  try {
    const config = await analysisService.getLianruanCrmConfig();
    lianruanForm.enabled = config.enabled;
    lianruanForm.baseUrl = config.baseUrl ?? '';
    lianruanForm.appKey = '';
    lianruanForm.appSecret = '';
    lianruanForm.timeoutMs = config.timeoutMs;
    lianruanForm.tokenCacheBufferSeconds = config.tokenCacheBufferSeconds;
    lianruanConfigMeta.source = config.source;
    lianruanConfigMeta.effectiveEnabled = config.effectiveEnabled;
    lianruanConfigMeta.appKeyMasked = config.appKeyMasked ?? '';
    lianruanConfigMeta.appKeyPresent = config.appKeyPresent;
    lianruanConfigMeta.appSecretPresent = config.appSecretPresent;
    lianruanConfigMeta.updatedBy = config.updatedBy ?? '';
    lianruanConfigMeta.updatedAt = config.updatedAt ?? '';
  } catch (error) {
    lianruanFeedbackTone.value = 'error';
    lianruanFeedback.value = toUserFacingErrorMessage(
      error,
      '联软 CRM 配置暂时读取失败，请确认当前账号具备治理权限后重试。',
    );
  } finally {
    loadingLianruanConfig.value = false;
  }
}

async function loadLianruanDiagnostics() {
  if (loadingLianruanDiagnostics.value) {
    return;
  }

  loadingLianruanDiagnostics.value = true;
  try {
    lianruanDiagnostics.value = await analysisService.getLianruanCrmDiagnostics();
  } catch (error) {
    lianruanDiagnostics.value = null;
    lianruanFeedbackTone.value = 'warning';
    lianruanFeedback.value = toUserFacingErrorMessage(
      error,
      '联软 CRM 字段与权限诊断暂时没有加载成功，请确认当前账号具备治理权限后重试。',
    );
  } finally {
    loadingLianruanDiagnostics.value = false;
  }
}

async function savePolicy() {
  if (saving.value) {
    return;
  }

  saving.value = true;
  try {
    const policy = await analysisService.getCurrentPolicy();
    await analysisService.updateCurrentPolicy({
      ...policy,
      maxOnlineSessions: Number(form.maxOnlineSessions),
      maxConcurrentQueries: Number(form.maxConcurrentQueries),
      heartbeatIntervalSeconds: Number(form.heartbeatIntervalSeconds),
      idleTimeoutSeconds: Number(form.idleTimeoutSeconds),
      historyRetentionDays: Number(form.historyRetentionDays),
    });
    await authStore.loadCapabilities(true);
    feedbackTone.value = 'success';
    feedback.value = '连接策略已更新。';
  } catch (error) {
    feedbackTone.value = 'error';
    feedback.value = toUserFacingErrorMessage(
      error,
      '连接策略暂时没有保存成功，请检查填写内容后再试；如果仍有问题，请联系管理员。',
    );
  } finally {
    saving.value = false;
  }
}

function buildLianruanPayload() {
  const payload: Record<string, unknown> = {
    enabled: lianruanForm.enabled,
    baseUrl: lianruanForm.baseUrl.trim(),
    timeoutMs: Number(lianruanForm.timeoutMs),
    tokenCacheBufferSeconds: Number(lianruanForm.tokenCacheBufferSeconds),
  };
  if (lianruanForm.appKey.trim()) {
    payload.appKey = lianruanForm.appKey.trim();
  }
  if (lianruanForm.appSecret.trim()) {
    payload.appSecret = lianruanForm.appSecret.trim();
  }
  return payload;
}

async function saveLianruanConfig() {
  if (savingLianruanConfig.value) {
    return;
  }

  savingLianruanConfig.value = true;
  try {
    await analysisService.updateLianruanCrmConfig(buildLianruanPayload());
    await loadLianruanConfig();
    await loadLianruanDiagnostics();
    lianruanFeedbackTone.value = 'success';
    lianruanFeedback.value = '联软 CRM 连接配置已保存，后续智能分析和企微机器人会使用新配置。';
  } catch (error) {
    lianruanFeedbackTone.value = 'error';
    lianruanFeedback.value = toUserFacingErrorMessage(
      error,
      '联软 CRM 配置暂时没有保存成功，请检查地址、凭证和超时设置后再试。',
    );
  } finally {
    savingLianruanConfig.value = false;
  }
}

async function testLianruanConfig() {
  if (testingLianruanConfig.value) {
    return;
  }

  testingLianruanConfig.value = true;
  try {
    const result = await analysisService.testLianruanCrmConfig(buildLianruanPayload());
    lianruanTestResult.value = result;
    lianruanFeedbackTone.value = result.success ? 'success' : 'warning';
    lianruanFeedback.value = result.message;
  } catch (error) {
    lianruanFeedbackTone.value = 'error';
    lianruanFeedback.value = toUserFacingErrorMessage(
      error,
      '联软 CRM 连接测试暂时没有完成，请检查网络、白名单或服务是否启动。',
    );
  } finally {
    testingLianruanConfig.value = false;
  }
}

function resolveConfigSourceLabel(source: 'env' | 'runtime' | 'mixed') {
  if (source === 'runtime') {
    return '页面配置';
  }
  if (source === 'mixed') {
    return '页面配置 + 环境兜底';
  }
  return '环境变量';
}

function resolveStepTagType(status: 'SUCCESS' | 'FAILED' | 'SKIPPED') {
  if (status === 'SUCCESS') {
    return 'success';
  }
  if (status === 'FAILED') {
    return 'danger';
  }
  return 'info';
}

function formatPercent(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '未计算';
  }
  return `${Math.round(value * 100)}%`;
}

function resolveResourceStatusLabel(status?: 'AVAILABLE' | 'EMPTY' | 'FAILED') {
  if (status === 'AVAILABLE') {
    return '有样例';
  }
  if (status === 'EMPTY') {
    return '空数据';
  }
  if (status === 'FAILED') {
    return '读取失败';
  }
  return '未检查';
}

function resolveResourceStatusTagType(status?: 'AVAILABLE' | 'EMPTY' | 'FAILED') {
  if (status === 'AVAILABLE') {
    return 'success';
  }
  if (status === 'FAILED') {
    return 'danger';
  }
  return 'warning';
}

function resolveScopeTypeLabel(scopeType?: string) {
  if (scopeType === 'all') {
    return '全量视角';
  }
  if (scopeType === 'region') {
    return '区域视角';
  }
  if (scopeType === 'partner') {
    return '服务商视角';
  }
  if (scopeType === 'user') {
    return '个人视角';
  }
  return scopeType || '未返回';
}

onMounted(() => {
  void loadPolicy();
  void loadLianruanConfig();
  void loadLianruanDiagnostics();
});
</script>

<template>
  <div class="page governance-page">
    <div class="governance-layout">
      <div class="governance-main-column">
        <section class="panel lianruan-panel">
          <div class="panel__header">
            <div>
              <p class="section-kicker">
                渠道 CRM 接入
              </p>
              <h2 class="table-panel__title">
                联软渠道 CRM 标准 OpenAPI
              </h2>
            </div>
            <div class="panel-actions">
              <el-button
                :disabled="loadingLianruanConfig || testingLianruanConfig"
                :loading="testingLianruanConfig"
                @click="testLianruanConfig"
              >
                <el-icon v-if="!testingLianruanConfig">
                  <component :is="UiIcons.refresh" />
                </el-icon>
                {{ testingLianruanConfig ? '测试中...' : '测试连接' }}
              </el-button>
              <el-button
                class="button-primary"
                type="primary"
                :disabled="savingLianruanConfig"
                :loading="savingLianruanConfig"
                @click="saveLianruanConfig"
              >
                <el-icon v-if="!savingLianruanConfig">
                  <component :is="UiIcons.connection" />
                </el-icon>
                {{ savingLianruanConfig ? '保存中...' : '保存联软配置' }}
              </el-button>
            </div>
          </div>

          <div class="panel__body">
            <div class="connection-status-strip">
              <article>
                <span>当前状态</span>
                <strong>{{ lianruanConfigMeta.effectiveEnabled ? '已启用' : '未启用' }}</strong>
              </article>
              <article>
                <span>配置来源</span>
                <strong>{{ resolveConfigSourceLabel(lianruanConfigMeta.source) }}</strong>
              </article>
              <article>
                <span>App Key</span>
                <strong>{{ lianruanConfigMeta.appKeyMasked || '未配置' }}</strong>
              </article>
              <article>
                <span>Secret</span>
                <strong>{{ lianruanConfigMeta.appSecretPresent ? '已配置' : '未配置' }}</strong>
              </article>
            </div>

            <div class="field-grid field-grid--lianruan">
              <label class="form-field form-field--switch">
                <span>启用联软 OpenAPI</span>
                <el-switch
                  v-model="lianruanForm.enabled"
                  active-text="启用"
                  inactive-text="停用"
                />
              </label>
              <label class="form-field form-field--wide">
                <span>OpenAPI Base URL</span>
                <el-input
                  v-model="lianruanForm.baseUrl"
                  class="input"
                  placeholder="例如：http://10.18.16.114:3000/api/open/v1"
                  clearable
                />
              </label>
              <label class="form-field">
                <span>App Key</span>
                <el-input
                  v-model="lianruanForm.appKey"
                  class="input"
                  placeholder="不修改则沿用当前配置"
                  clearable
                />
              </label>
              <label class="form-field">
                <span>App Secret</span>
                <el-input
                  v-model="lianruanForm.appSecret"
                  class="input"
                  type="password"
                  placeholder="不回显，重新填写才更新"
                  show-password
                  clearable
                />
              </label>
              <label class="form-field">
                <span>请求超时（毫秒）</span>
                <el-input
                  v-model="lianruanForm.timeoutMs"
                  class="input"
                  type="number"
                />
              </label>
              <label class="form-field">
                <span>Token 提前刷新（秒）</span>
                <el-input
                  v-model="lianruanForm.tokenCacheBufferSeconds"
                  class="input"
                  type="number"
                />
              </label>
            </div>

            <el-alert
              v-if="lianruanFeedback"
              class="feedback-state"
              :data-tone="resolveFeedbackTone(lianruanFeedbackTone)"
              :type="lianruanFeedbackTone === 'error' ? 'error' : lianruanFeedbackTone === 'warning' ? 'warning' : 'success'"
              :closable="false"
              show-icon
            >
              {{ lianruanFeedback }}
            </el-alert>

            <div
              v-if="lianruanTestResult"
              class="test-result"
            >
              <div class="test-result__header">
                <strong>最近一次测试</strong>
                <span>{{ lianruanTestResult.checkedAt }}，耗时 {{ lianruanTestResult.durationMs }}ms</span>
              </div>
              <div
                v-if="lianruanTestResult.context"
                class="bound-user-card"
              >
                <span>绑定用户</span>
                <strong>
                  {{ lianruanTestResult.context.boundUserName || lianruanTestResult.context.boundUserId }}
                  / {{ lianruanTestResult.context.boundUserRole || '未返回角色' }}
                </strong>
                <small>Client：{{ lianruanTestResult.context.clientName || '未返回' }}</small>
              </div>
              <div class="test-steps">
                <article
                  v-for="step in lianruanTestResult.steps"
                  :key="step.name"
                  class="test-step"
                >
                  <el-tag
                    :type="resolveStepTagType(step.status)"
                    effect="light"
                  >
                    {{ step.status === 'SUCCESS' ? '通过' : step.status === 'FAILED' ? '失败' : '跳过' }}
                  </el-tag>
                  <div>
                    <strong>{{ step.name }}</strong>
                    <p>{{ step.message }}</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section class="panel lianruan-diagnostics-panel">
          <div class="panel__header">
            <div>
              <p class="section-kicker">
                字段与权限诊断
              </p>
              <h2 class="table-panel__title">
                联软 OpenAPI 可分析性检查
              </h2>
            </div>
            <el-button
              :disabled="loadingLianruanDiagnostics"
              :loading="loadingLianruanDiagnostics"
              @click="loadLianruanDiagnostics"
            >
              <el-icon v-if="!loadingLianruanDiagnostics">
                <component :is="UiIcons.refresh" />
              </el-icon>
              {{ loadingLianruanDiagnostics ? '诊断中...' : '刷新诊断' }}
            </el-button>
          </div>

          <div class="panel__body">
            <el-alert
              v-if="lianruanDiagnostics && !lianruanDiagnostics.enabled"
              class="feedback-state"
              type="warning"
              :closable="false"
              show-icon
            >
              {{ lianruanDiagnostics.message || '联软标准 OpenAPI 尚未启用，请先补齐连接配置。' }}
            </el-alert>

            <div
              v-if="lianruanDiagnostics?.enabled"
              class="diagnostics-grid"
            >
              <article class="diagnostic-card diagnostic-card--wide">
                <span class="diagnostic-card__label">绑定用户与权限视角</span>
                <strong>
                  {{ lianruanDiagnostics.permissionView?.userName || lianruanDiagnostics.context?.boundUserName || '未返回用户' }}
                  / {{ resolveScopeTypeLabel(lianruanDiagnostics.permissionView?.scopeType) }}
                </strong>
                <p>
                  Client 绑定：{{ lianruanDiagnostics.permissionView?.boundClientUserId || '未返回' }}
                  <template v-if="lianruanDiagnostics.permissionView?.boundUserMatchesCurrentLogin === false">
                    ，与当前登录用户不一致，请确认是否使用了匹配的联调 client。
                  </template>
                </p>
              </article>

              <article class="diagnostic-card">
                <span class="diagnostic-card__label">字段完整度</span>
                <strong>{{ formatPercent(lianruanDiagnostics.fieldCapabilities?.overall.completeness) }}</strong>
                <p>
                  {{ lianruanDiagnostics.fieldCapabilities?.overall.availableFieldCount ?? 0 }}
                  /
                  {{ lianruanDiagnostics.fieldCapabilities?.overall.totalExpectedFieldCount ?? 0 }}
                  个字段已在样例中出现
                </p>
              </article>

              <article class="diagnostic-card">
                <span class="diagnostic-card__label">P0 缺失字段</span>
                <strong>{{ lianruanMissingP0Fields.length }} 个</strong>
                <p>重点影响智能分析可用性，需要优先让联软侧确认或补齐。</p>
              </article>

              <article class="diagnostic-card">
                <span class="diagnostic-card__label">字典完整度</span>
                <strong>{{ formatPercent(lianruanDiagnostics.dictionaries?.completeness) }}</strong>
                <p>
                  缺失：{{ lianruanDiagnostics.dictionaries?.missingKeys?.join('、') || '暂无' }}
                </p>
              </article>
            </div>

            <div
              v-if="lianruanDiagnostics?.enabled && lianruanMissingP0Fields.length > 0"
              class="missing-field-list"
            >
              <span>优先补齐字段</span>
              <el-tag
                v-for="field in lianruanMissingP0Fields"
                :key="`${field.resource}.${field.field}`"
                type="danger"
                effect="light"
              >
                {{ field.label }}（{{ field.resource }}.{{ field.field }}）
              </el-tag>
            </div>

            <div
              v-if="lianruanDiagnostics?.enabled"
              class="resource-diagnostics"
            >
              <article
                v-for="resource in lianruanFieldResources"
                :key="resource.resource"
                class="resource-diagnostic-card"
              >
                <div class="resource-diagnostic-card__header">
                  <strong>{{ resource.resourceLabel }}</strong>
                  <el-tag
                    :type="resource.missingP0Fields.length > 0 ? 'danger' : 'success'"
                    effect="light"
                  >
                    {{ resource.missingP0Fields.length > 0 ? `缺 ${resource.missingP0Fields.length} 个 P0` : 'P0 完整' }}
                  </el-tag>
                </div>
                <p>
                  字段完整度 {{ formatPercent(resource.completeness) }}，
                  样例 {{ resource.sampleCount }} 条，
                  已识别 {{ resource.availableFieldCount }}/{{ resource.totalExpectedFieldCount }} 个字段。
                </p>
                <small v-if="resource.missingP0Fields.length > 0">
                  缺失字段：{{ resource.missingP0Fields.join('、') }}
                </small>
              </article>
            </div>

            <div
              v-if="lianruanDiagnostics?.enabled"
              class="permission-resource-list"
            >
              <article
                v-for="[resource, item] in lianruanPermissionResources"
                :key="resource"
                class="permission-resource-item"
              >
                <span>{{ resource }}</span>
                <el-tag
                  :type="resolveResourceStatusTagType(item.status)"
                  effect="light"
                >
                  {{ resolveResourceStatusLabel(item.status) }}
                </el-tag>
                <strong>{{ item.total }} 条</strong>
                <small v-if="item.failureReason">{{ item.failureReason }}</small>
              </article>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel__header">
            <div>
              <h2 class="table-panel__title">
                会话与并发阈值
              </h2>
            </div>
            <el-button
              class="button-primary"
              type="primary"
              :disabled="saving"
              :loading="saving"
              :aria-busy="saving ? 'true' : 'false'"
              @click="savePolicy"
            >
              <el-icon v-if="!saving">
                <component :is="UiIcons.connection" />
              </el-icon>
              {{ saving ? '保存中...' : '保存连接策略' }}
            </el-button>
          </div>
          <div class="panel__body">
            <div class="field-grid">
              <label class="form-field">
                <span>在线会话上限</span>
                <el-input
                  v-model="form.maxOnlineSessions"
                  class="input"
                  type="number"
                />
              </label>
              <label class="form-field">
                <span>并发查询上限</span>
                <el-input
                  v-model="form.maxConcurrentQueries"
                  class="input"
                  type="number"
                />
              </label>
              <label class="form-field">
                <span>心跳周期（秒）</span>
                <el-input
                  v-model="form.heartbeatIntervalSeconds"
                  class="input"
                  type="number"
                />
              </label>
              <label class="form-field">
                <span>失活超时（秒）</span>
                <el-input
                  v-model="form.idleTimeoutSeconds"
                  class="input"
                  type="number"
                />
              </label>
              <label class="form-field">
                <span>最近查询保留天数</span>
                <el-input
                  v-model="form.historyRetentionDays"
                  class="input"
                  type="number"
                />
              </label>
            </div>
          </div>
        </section>
      </div>

      <aside
        class="governance-side-column"
        aria-label="连接策略摘要"
      >
        <section class="panel">
          <div class="panel__header">
            <div>
              <h3 class="table-panel__title">
                联软连接摘要
              </h3>
            </div>
          </div>
          <div class="panel__body panel__body--stack">
            <article class="policy-card">
              <span class="policy-card__label">连接状态</span>
              <strong class="policy-card__value">
                {{ lianruanConfigMeta.effectiveEnabled ? '已启用' : '未启用' }}
              </strong>
            </article>
            <article class="policy-card">
              <span class="policy-card__label">配置来源</span>
              <strong class="policy-card__value">{{ resolveConfigSourceLabel(lianruanConfigMeta.source) }}</strong>
            </article>
            <article class="policy-card">
              <span class="policy-card__label">测试结果</span>
              <strong class="policy-card__value">
                {{ lianruanTestResult ? (lianruanTestResult.success ? '通过' : '未通过') : '未测试' }}
              </strong>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="panel__header">
            <div>
              <h3 class="table-panel__title">
                会话阈值
              </h3>
            </div>
          </div>
          <div class="panel__body panel__body--stack">
            <article class="policy-card">
              <span class="policy-card__label">在线会话</span>
              <strong class="policy-card__value">{{ form.maxOnlineSessions }}</strong>
            </article>
            <article class="policy-card">
              <span class="policy-card__label">并发查询</span>
              <strong class="policy-card__value">{{ form.maxConcurrentQueries }}</strong>
            </article>
            <article class="policy-card">
              <span class="policy-card__label">心跳周期</span>
              <strong class="policy-card__value">{{ form.heartbeatIntervalSeconds }}s</strong>
            </article>
            <el-alert
              v-if="feedback"
              class="feedback-state"
              :data-tone="resolveFeedbackTone(feedbackTone)"
              :type="feedbackTone === 'error' ? 'error' : 'success'"
              :closable="false"
              show-icon
            >
              {{ feedback }}
            </el-alert>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.section-kicker {
  margin: 0 0 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.lianruan-panel {
  overflow: hidden;
}

.connection-status-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.connection-status-strip article {
  padding: 14px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 16px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(244, 248, 245, 0.72));
}

.connection-status-strip span,
.bound-user-card span {
  display: block;
  margin-bottom: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.connection-status-strip strong,
.bound-user-card strong {
  color: var(--color-text-primary);
  font-size: 15px;
}

.field-grid--lianruan {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-field--wide {
  grid-column: 1 / -1;
}

.form-field--switch {
  align-items: flex-start;
}

.test-result {
  display: grid;
  gap: 14px;
  margin-top: 18px;
  padding: 16px;
  border: 1px solid rgba(69, 117, 88, 0.18);
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(110, 152, 116, 0.16), transparent 42%),
    rgba(249, 251, 247, 0.92);
}

.test-result__header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.test-result__header span,
.bound-user-card small {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.bound-user-card {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
}

.bound-user-card small {
  display: block;
  margin-top: 4px;
}

.test-steps {
  display: grid;
  gap: 10px;
}

.test-step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
}

.test-step p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.lianruan-diagnostics-panel {
  overflow: hidden;
}

.diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.diagnostic-card,
.resource-diagnostic-card,
.permission-resource-item {
  border: 1px solid var(--color-border-subtle);
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(247, 250, 246, 0.78));
}

.diagnostic-card {
  padding: 16px;
}

.diagnostic-card--wide {
  grid-column: span 3;
}

.diagnostic-card__label {
  display: block;
  margin-bottom: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.diagnostic-card strong {
  color: var(--color-text-primary);
  font-size: 20px;
}

.diagnostic-card p,
.resource-diagnostic-card p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.missing-field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 16px;
  padding: 12px;
  border: 1px dashed rgba(186, 88, 70, 0.32);
  border-radius: 16px;
  background: rgba(255, 247, 244, 0.82);
}

.missing-field-list span {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.resource-diagnostics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.resource-diagnostic-card {
  padding: 14px;
}

.resource-diagnostic-card__header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.resource-diagnostic-card small {
  display: block;
  margin-top: 8px;
  color: var(--color-danger, #a33a2a);
  line-height: 1.5;
}

.permission-resource-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.permission-resource-item {
  display: grid;
  gap: 6px;
  padding: 12px;
}

.permission-resource-item span {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.permission-resource-item strong {
  color: var(--color-text-primary);
}

.permission-resource-item small {
  color: var(--color-text-secondary);
  line-height: 1.5;
}

@media (max-width: 960px) {
  .connection-status-strip,
  .field-grid--lianruan,
  .diagnostics-grid,
  .resource-diagnostics,
  .permission-resource-list {
    grid-template-columns: 1fr;
  }

  .diagnostic-card--wide {
    grid-column: auto;
  }

  .panel-actions {
    justify-content: flex-start;
  }
}
</style>
