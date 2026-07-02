<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { RouterLink } from 'vue-router';
import {
  type IntegrationTestResult,
  integrationsService,
} from '@/services/integrations.service';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';
import { UiIcons } from '@/ui/icons';

const loading = ref(false);
const savingWecom = ref(false);
const savingCrm = ref(false);
const savingMapping = ref(false);
const savingPilot = ref(false);
const testingWecom = ref(false);
const testingCrm = ref(false);
const loadingDiagnostics = ref(false);
const activeTab = ref('wecom');
const statusSnapshot = ref<Record<string, any> | null>(null);
const wecomTestResult = ref<IntegrationTestResult | null>(null);
const crmTestResult = ref<IntegrationTestResult | null>(null);
const crmDiagnostics = ref<Record<string, any> | null>(null);
const mappings = ref<Record<string, any>[]>([]);
const mappingSummary = ref<Record<string, any> | null>(null);
const auditEvents = ref<Record<string, any>[]>([]);

const wecomForm = reactive({
  enabled: true,
  botId: '',
  botSecret: '',
  botSignature: '',
  botSource: 'wecom-bot',
  botTransportMode: 'mock',
  botWsUrl: 'wss://openws.work.weixin.qq.com',
  botMaxReconnectAttempts: 10,
  botHeartbeatIntervalMs: 30000,
  deliveryMaxRetries: 2,
  deliveryRetryDelayMs: 300,
  deliveryChunkMaxLength: 900,
});

const crmForm = reactive({
  enabled: true,
  baseUrl: '',
  appKey: '',
  appSecret: '',
  timeoutMs: 12000,
  tokenCacheBufferSeconds: 60,
});

const mappingForm = reactive({
  wecomUserId: '',
  wecomUserName: '',
  crmUserId: '',
  departmentIdsText: '',
});

const pilotForm = reactive({
  mode: 'FULL',
  allowUserIdsText: '',
  allowRoleIdsText: '',
  allowDepartmentIdsText: '',
  denyUserIdsText: '',
  note: '',
});

const summaryCards = computed(() => {
  const snapshot = statusSnapshot.value;
  return [
    {
      key: 'ai',
      title: 'AI 配置',
      status: snapshot?.ai?.ready ? '正常' : '待配置',
      detail: snapshot?.ai?.activeProfileName ?? '未检测到已激活模型',
      tone: snapshot?.ai?.ready ? 'success' : 'warning',
    },
    {
      key: 'wecom',
      title: '企微机器人',
      status: snapshot?.wecom?.inboundReady ? '可接收' : '待补齐',
      detail: snapshot?.wecom?.botSource ?? '未配置消息来源',
      tone: snapshot?.wecom?.inboundReady ? 'success' : 'warning',
    },
    {
      key: 'crm',
      title: '开放接口',
      status: snapshot?.crmOpenApi?.effectiveEnabled ? '已启用' : '待配置',
      detail: snapshot?.crmOpenApi?.baseUrl ?? '未配置接口地址',
      tone: snapshot?.crmOpenApi?.effectiveEnabled ? 'success' : 'warning',
    },
    {
      key: 'identity',
      title: '用户映射',
      status: `${snapshot?.identityMapping?.mappedCount ?? 0} 已绑定`,
      detail: `${snapshot?.identityMapping?.unmappedCount ?? 0} 个未绑定`,
      tone:
        (snapshot?.identityMapping?.unmappedCount ?? 0) > 0
          ? 'warning'
          : 'success',
    },
  ];
});

function splitLines(value: string): string[] {
  return value
    .split(/[\n,，]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyWecomConfig(config: Record<string, any>): void {
  wecomForm.enabled = Boolean(config.enabled ?? true);
  wecomForm.botId = '';
  wecomForm.botSecret = '';
  wecomForm.botSignature = '';
  wecomForm.botSource = config.botSource ?? 'wecom-bot';
  wecomForm.botTransportMode = config.botTransportMode ?? 'mock';
  wecomForm.botWsUrl = config.botWsUrl ?? 'wss://openws.work.weixin.qq.com';
  wecomForm.botMaxReconnectAttempts = Number(config.botMaxReconnectAttempts ?? 10);
  wecomForm.botHeartbeatIntervalMs = Number(config.botHeartbeatIntervalMs ?? 30000);
  wecomForm.deliveryMaxRetries = Number(config.deliveryMaxRetries ?? 2);
  wecomForm.deliveryRetryDelayMs = Number(config.deliveryRetryDelayMs ?? 300);
  wecomForm.deliveryChunkMaxLength = Number(config.deliveryChunkMaxLength ?? 900);
}

function applyCrmConfig(config: Record<string, any>): void {
  crmForm.enabled = Boolean(config.enabled ?? true);
  crmForm.baseUrl = config.baseUrl ?? '';
  crmForm.appKey = '';
  crmForm.appSecret = '';
  crmForm.timeoutMs = Number(config.timeoutMs ?? 12000);
  crmForm.tokenCacheBufferSeconds = Number(config.tokenCacheBufferSeconds ?? 60);
}

function applyPilotPolicy(policy: Record<string, any>): void {
  pilotForm.mode = policy.mode ?? 'FULL';
  pilotForm.allowUserIdsText = (policy.allowUserIds ?? []).join('\n');
  pilotForm.allowRoleIdsText = (policy.allowRoleIds ?? []).join('\n');
  pilotForm.allowDepartmentIdsText = (policy.allowDepartmentIds ?? []).join('\n');
  pilotForm.denyUserIdsText = (policy.denyUserIds ?? []).join('\n');
  pilotForm.note = policy.note ?? '';
}

async function loadPage(): Promise<void> {
  loading.value = true;
  try {
    const [
      status,
      wecomConfig,
      crmConfig,
      mappingResponse,
      pilotPolicy,
      auditResponse,
    ] = await Promise.all([
      integrationsService.getStatus(),
      integrationsService.getWecomConfig(),
      integrationsService.getCrmOpenApiConfig(),
      integrationsService.listIdentityMappings(),
      integrationsService.getPilotPolicy(),
      integrationsService.listAuditEvents({ pageSize: 8 }),
    ]);
    statusSnapshot.value = status;
    applyWecomConfig(wecomConfig);
    applyCrmConfig(crmConfig);
    mappings.value = mappingResponse.items ?? [];
    mappingSummary.value = mappingResponse.summary ?? null;
    applyPilotPolicy(pilotPolicy);
    auditEvents.value = auditResponse.items ?? [];
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '联调管理信息加载失败，请稍后重试。'),
    );
  } finally {
    loading.value = false;
  }
}

function buildWecomPayload(): Record<string, unknown> {
  return {
    enabled: wecomForm.enabled,
    botId: wecomForm.botId || undefined,
    botSecret: wecomForm.botSecret || undefined,
    botSignature: wecomForm.botSignature || undefined,
    botSource: wecomForm.botSource,
    botTransportMode: wecomForm.botTransportMode,
    botWsUrl: wecomForm.botWsUrl,
    botMaxReconnectAttempts: wecomForm.botMaxReconnectAttempts,
    botHeartbeatIntervalMs: wecomForm.botHeartbeatIntervalMs,
    deliveryMaxRetries: wecomForm.deliveryMaxRetries,
    deliveryRetryDelayMs: wecomForm.deliveryRetryDelayMs,
    deliveryChunkMaxLength: wecomForm.deliveryChunkMaxLength,
  };
}

function buildCrmPayload(): Record<string, unknown> {
  return {
    enabled: crmForm.enabled,
    baseUrl: crmForm.baseUrl,
    appKey: crmForm.appKey || undefined,
    appSecret: crmForm.appSecret || undefined,
    timeoutMs: crmForm.timeoutMs,
    tokenCacheBufferSeconds: crmForm.tokenCacheBufferSeconds,
  };
}

async function saveWecomConfig(): Promise<void> {
  savingWecom.value = true;
  try {
    const config = await integrationsService.updateWecomConfig(buildWecomPayload());
    applyWecomConfig(config);
    ElMessage.success('企业微信机器人配置已保存。');
    await loadPage();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '企业微信机器人配置保存失败。'),
    );
  } finally {
    savingWecom.value = false;
  }
}

async function testWecomConfig(): Promise<void> {
  testingWecom.value = true;
  try {
    wecomTestResult.value = await integrationsService.testWecomConfig(
      buildWecomPayload(),
    );
    ElMessage[wecomTestResult.value.success ? 'success' : 'warning'](
      wecomTestResult.value.message,
    );
    await refreshAuditEvents();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '企业微信机器人配置测试失败。'),
    );
  } finally {
    testingWecom.value = false;
  }
}

async function saveCrmConfig(): Promise<void> {
  savingCrm.value = true;
  try {
    const config = await integrationsService.updateCrmOpenApiConfig(buildCrmPayload());
    applyCrmConfig(config);
    ElMessage.success('客户关系管理系统开放接口配置已保存。');
    await loadPage();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '开放接口配置保存失败。'),
    );
  } finally {
    savingCrm.value = false;
  }
}

async function testCrmConfig(): Promise<void> {
  testingCrm.value = true;
  try {
    crmTestResult.value = await integrationsService.testCrmOpenApiConfig(
      buildCrmPayload(),
    );
    ElMessage[crmTestResult.value.success ? 'success' : 'warning'](
      crmTestResult.value.message,
    );
    await refreshAuditEvents();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '开放接口自检失败。'),
    );
  } finally {
    testingCrm.value = false;
  }
}

async function loadDiagnostics(): Promise<void> {
  loadingDiagnostics.value = true;
  try {
    crmDiagnostics.value = await integrationsService.getCrmOpenApiDiagnostics();
    ElMessage.success('开放接口诊断已刷新。');
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '开放接口诊断刷新失败。'),
    );
  } finally {
    loadingDiagnostics.value = false;
  }
}

async function saveMapping(): Promise<void> {
  savingMapping.value = true;
  try {
    await integrationsService.upsertIdentityMapping({
      wecomUserId: mappingForm.wecomUserId,
      wecomUserName: mappingForm.wecomUserName || undefined,
      crmUserId: mappingForm.crmUserId,
      departmentIds: splitLines(mappingForm.departmentIdsText),
    });
    ElMessage.success('用户映射已保存。');
    mappingForm.wecomUserId = '';
    mappingForm.wecomUserName = '';
    mappingForm.crmUserId = '';
    mappingForm.departmentIdsText = '';
    await loadPage();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '用户映射保存失败。'),
    );
  } finally {
    savingMapping.value = false;
  }
}

async function savePilotPolicy(): Promise<void> {
  savingPilot.value = true;
  try {
    const saved = await integrationsService.updatePilotPolicy({
      mode: pilotForm.mode,
      allowUserIds: splitLines(pilotForm.allowUserIdsText),
      allowRoleIds: splitLines(pilotForm.allowRoleIdsText),
      allowDepartmentIds: splitLines(pilotForm.allowDepartmentIdsText),
      denyUserIds: splitLines(pilotForm.denyUserIdsText),
      note: pilotForm.note || undefined,
    });
    applyPilotPolicy(saved);
    ElMessage.success('企业微信灰度准入已保存。');
    await loadPage();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(error, '灰度准入保存失败。'),
    );
  } finally {
    savingPilot.value = false;
  }
}

async function refreshAuditEvents(): Promise<void> {
  const auditResponse = await integrationsService.listAuditEvents({ pageSize: 8 });
  auditEvents.value = auditResponse.items ?? [];
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('、') : '无';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (value === undefined || value === null || value === '') {
    return '未返回';
  }
  return String(value);
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <main
    v-loading="loading"
    class="page governance-page integrations-page"
  >
    <section class="integrations-header">
      <div>
        <p class="integrations-header__eyebrow">第一阶段联调管理</p>
        <h2>企业微信机器人与客户关系管理系统接入</h2>
      </div>
      <div class="integrations-header__actions">
        <RouterLink to="/governance/ai-models">
          <el-button>
            <el-icon><component :is="UiIcons.magic" /></el-icon>
            AI 配置
          </el-button>
        </RouterLink>
        <el-button
          type="primary"
          :loading="loading"
          @click="loadPage"
        >
          <el-icon><component :is="UiIcons.refresh" /></el-icon>
          刷新状态
        </el-button>
      </div>
    </section>

    <section class="integrations-summary">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="integrations-status"
        :class="`integrations-status--${card.tone}`"
      >
        <span class="integrations-status__title">{{ card.title }}</span>
        <strong>{{ card.status }}</strong>
        <small>{{ card.detail }}</small>
      </article>
    </section>

    <el-tabs
      v-model="activeTab"
      class="integrations-tabs"
    >
      <el-tab-pane
        label="企微机器人"
        name="wecom"
      >
        <section class="integrations-panel">
          <el-form
            label-position="top"
            class="integrations-form"
          >
            <div class="integrations-form-grid">
              <el-form-item label="启用企微入口">
                <el-switch v-model="wecomForm.enabled" />
              </el-form-item>
              <el-form-item label="通道模式">
                <el-segmented
                  v-model="wecomForm.botTransportMode"
                  :options="[
                    { label: '本地模拟', value: 'mock' },
                    { label: '真实长连接', value: 'sdk' },
                  ]"
                />
              </el-form-item>
              <el-form-item label="机器人编号">
                <el-input
                  v-model="wecomForm.botId"
                  placeholder="留空表示沿用当前配置"
                />
              </el-form-item>
              <el-form-item label="机器人密钥">
                <el-input
                  v-model="wecomForm.botSecret"
                  type="password"
                  show-password
                  placeholder="留空表示不修改"
                />
              </el-form-item>
              <el-form-item label="消息签名">
                <el-input
                  v-model="wecomForm.botSignature"
                  type="password"
                  show-password
                  placeholder="留空表示不修改"
                />
              </el-form-item>
              <el-form-item label="消息来源">
                <el-input v-model="wecomForm.botSource" />
              </el-form-item>
              <el-form-item label="长连接地址">
                <el-input v-model="wecomForm.botWsUrl" />
              </el-form-item>
              <el-form-item label="分片长度">
                <el-input-number
                  v-model="wecomForm.deliveryChunkMaxLength"
                  :min="100"
                  :max="3000"
                />
              </el-form-item>
            </div>
            <div class="integrations-actions">
              <el-button
                type="primary"
                :loading="savingWecom"
                @click="saveWecomConfig"
              >
                <el-icon><component :is="UiIcons.success" /></el-icon>
                保存企微配置
              </el-button>
              <el-button
                :loading="testingWecom"
                @click="testWecomConfig"
              >
                <el-icon><component :is="UiIcons.connection" /></el-icon>
                测试企微配置
              </el-button>
            </div>
          </el-form>
          <div
            v-if="wecomTestResult"
            class="integrations-test-result"
          >
            <h3>{{ wecomTestResult.message }}</h3>
            <ol>
              <li
                v-for="step in wecomTestResult.steps"
                :key="step.name"
                :class="`integrations-step--${step.status.toLowerCase()}`"
              >
                <strong>{{ step.name }}</strong>
                <span>{{ step.message }}</span>
              </li>
            </ol>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane
        label="开放接口"
        name="crm"
      >
        <section class="integrations-panel">
          <el-form
            label-position="top"
            class="integrations-form"
          >
            <div class="integrations-form-grid">
              <el-form-item label="启用开放接口">
                <el-switch v-model="crmForm.enabled" />
              </el-form-item>
              <el-form-item label="接口地址">
                <el-input
                  v-model="crmForm.baseUrl"
                  placeholder="http://host/api/open/v1"
                />
              </el-form-item>
              <el-form-item label="App Key">
                <el-input
                  v-model="crmForm.appKey"
                  placeholder="留空表示沿用当前配置"
                />
              </el-form-item>
              <el-form-item label="App Secret">
                <el-input
                  v-model="crmForm.appSecret"
                  type="password"
                  show-password
                  placeholder="留空表示不修改"
                />
              </el-form-item>
              <el-form-item label="请求超时毫秒">
                <el-input-number
                  v-model="crmForm.timeoutMs"
                  :min="3000"
                  :max="120000"
                />
              </el-form-item>
              <el-form-item label="令牌缓存缓冲秒">
                <el-input-number
                  v-model="crmForm.tokenCacheBufferSeconds"
                  :min="0"
                  :max="600"
                />
              </el-form-item>
            </div>
            <div class="integrations-actions">
              <el-button
                type="primary"
                :loading="savingCrm"
                @click="saveCrmConfig"
              >
                <el-icon><component :is="UiIcons.success" /></el-icon>
                保存接口配置
              </el-button>
              <el-button
                :loading="testingCrm"
                @click="testCrmConfig"
              >
                <el-icon><component :is="UiIcons.connection" /></el-icon>
                自检开放接口
              </el-button>
              <el-button
                :loading="loadingDiagnostics"
                @click="loadDiagnostics"
              >
                <el-icon><component :is="UiIcons.monitor" /></el-icon>
                刷新诊断
              </el-button>
            </div>
          </el-form>

          <div
            v-if="crmTestResult"
            class="integrations-test-result"
          >
            <h3>{{ crmTestResult.message }}</h3>
            <ol>
              <li
                v-for="step in crmTestResult.steps"
                :key="step.name"
                :class="`integrations-step--${step.status.toLowerCase()}`"
              >
                <strong>{{ step.name }}</strong>
                <span>{{ step.message }}</span>
              </li>
            </ol>
          </div>

          <div
            v-if="crmDiagnostics"
            class="integrations-diagnostics"
          >
            <div>
              <span>接口状态</span>
              <strong>{{ crmDiagnostics.enabled ? '已启用' : '未启用' }}</strong>
            </div>
            <div>
              <span>绑定用户</span>
              <strong>{{ formatValue(crmDiagnostics.context?.boundUserName) }}</strong>
            </div>
            <div>
              <span>权限范围</span>
              <strong>{{ formatValue(crmDiagnostics.permissionScope?.scopeType) }}</strong>
            </div>
            <div>
              <span>字典完整度</span>
              <strong>{{ formatValue(crmDiagnostics.dictionaries?.completeness) }}</strong>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane
        label="用户映射"
        name="mapping"
      >
        <section class="integrations-panel">
          <div class="integrations-mapping-layout">
            <el-form label-position="top">
              <div class="integrations-form-grid integrations-form-grid--mapping">
                <el-form-item label="企微用户编号">
                  <el-input v-model="mappingForm.wecomUserId" />
                </el-form-item>
                <el-form-item label="企微用户名称">
                  <el-input v-model="mappingForm.wecomUserName" />
                </el-form-item>
                <el-form-item label="系统用户编号">
                  <el-input v-model="mappingForm.crmUserId" />
                </el-form-item>
                <el-form-item label="部门编号">
                  <el-input
                    v-model="mappingForm.departmentIdsText"
                    type="textarea"
                    :rows="3"
                    placeholder="一行一个部门编号"
                  />
                </el-form-item>
              </div>
              <el-button
                type="primary"
                :loading="savingMapping"
                @click="saveMapping"
              >
                <el-icon><component :is="UiIcons.user" /></el-icon>
                保存映射
              </el-button>
            </el-form>

            <div class="integrations-mini-summary">
              <strong>{{ mappingSummary?.mappedCount ?? 0 }}</strong>
              <span>已绑定用户</span>
              <strong>{{ mappingSummary?.unmappedCount ?? 0 }}</strong>
              <span>未绑定用户</span>
            </div>
          </div>

          <el-table
            :data="mappings"
            class="integrations-table"
            stripe
          >
            <el-table-column
              prop="wecomUserId"
              label="企微用户"
              min-width="160"
            />
            <el-table-column
              prop="wecomUserName"
              label="名称"
              min-width="140"
            />
            <el-table-column
              prop="crmUserId"
              label="系统用户"
              min-width="160"
            />
            <el-table-column
              prop="status"
              label="状态"
              width="120"
            />
            <el-table-column
              prop="reason"
              label="诊断"
              min-width="260"
            />
          </el-table>
        </section>
      </el-tab-pane>

      <el-tab-pane
        label="灰度准入"
        name="pilot"
      >
        <section class="integrations-panel">
          <el-form
            label-position="top"
            class="integrations-form"
          >
            <div class="integrations-form-grid">
              <el-form-item label="开放模式">
                <el-select v-model="pilotForm.mode">
                  <el-option
                    label="关闭"
                    value="DISABLED"
                  />
                  <el-option
                    label="仅试点"
                    value="PILOT_ONLY"
                  />
                  <el-option
                    label="全量开放"
                    value="FULL"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="允许用户编号">
                <el-input
                  v-model="pilotForm.allowUserIdsText"
                  type="textarea"
                  :rows="4"
                />
              </el-form-item>
              <el-form-item label="允许角色编号">
                <el-input
                  v-model="pilotForm.allowRoleIdsText"
                  type="textarea"
                  :rows="4"
                />
              </el-form-item>
              <el-form-item label="允许部门编号">
                <el-input
                  v-model="pilotForm.allowDepartmentIdsText"
                  type="textarea"
                  :rows="4"
                />
              </el-form-item>
              <el-form-item label="拒绝用户编号">
                <el-input
                  v-model="pilotForm.denyUserIdsText"
                  type="textarea"
                  :rows="4"
                />
              </el-form-item>
              <el-form-item label="备注">
                <el-input
                  v-model="pilotForm.note"
                  type="textarea"
                  :rows="4"
                />
              </el-form-item>
            </div>
            <el-button
              type="primary"
              :loading="savingPilot"
              @click="savePilotPolicy"
            >
              <el-icon><component :is="UiIcons.flag" /></el-icon>
              保存灰度准入
            </el-button>
          </el-form>
        </section>
      </el-tab-pane>

      <el-tab-pane
        label="诊断日志"
        name="audit"
      >
        <section class="integrations-panel">
          <div class="integrations-actions integrations-actions--right">
            <el-button @click="refreshAuditEvents">
              <el-icon><component :is="UiIcons.refresh" /></el-icon>
              刷新日志
            </el-button>
          </div>
          <el-table
            :data="auditEvents"
            class="integrations-table"
            stripe
          >
            <el-table-column
              prop="createdAt"
              label="时间"
              min-width="180"
            />
            <el-table-column
              prop="eventType"
              label="事件"
              min-width="220"
            />
            <el-table-column
              prop="actorId"
              label="操作者"
              min-width="140"
            />
            <el-table-column
              prop="outcome"
              label="结果"
              min-width="280"
            />
            <el-table-column
              prop="riskLevel"
              label="风险"
              width="100"
            />
          </el-table>
        </section>
      </el-tab-pane>
    </el-tabs>
  </main>
</template>

<style scoped>
.integrations-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.integrations-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.integrations-header h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
  color: var(--el-text-color-primary);
}

.integrations-header__eyebrow {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.integrations-header__actions,
.integrations-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.integrations-actions--right {
  justify-content: flex-end;
  margin-bottom: 12px;
}

.integrations-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.integrations-status {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-bg-color);
  min-width: 0;
}

.integrations-status strong {
  display: block;
  margin: 8px 0 4px;
  font-size: 20px;
  color: var(--el-text-color-primary);
}

.integrations-status small,
.integrations-status__title {
  display: block;
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
}

.integrations-status--success {
  border-color: var(--el-color-success-light-5);
}

.integrations-status--warning {
  border-color: var(--el-color-warning-light-5);
}

.integrations-tabs {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  padding: 0 16px 16px;
}

.integrations-panel {
  padding-top: 8px;
}

.integrations-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}

.integrations-form-grid--mapping {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.integrations-test-result,
.integrations-diagnostics {
  margin-top: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-fill-color-extra-light);
}

.integrations-test-result h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.integrations-test-result ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
}

.integrations-test-result li strong {
  margin-right: 8px;
}

.integrations-step--success strong {
  color: var(--el-color-success);
}

.integrations-step--failed strong {
  color: var(--el-color-danger);
}

.integrations-step--skipped strong {
  color: var(--el-color-warning);
}

.integrations-diagnostics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.integrations-diagnostics span,
.integrations-mini-summary span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.integrations-diagnostics strong,
.integrations-mini-summary strong {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.integrations-mapping-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  align-items: start;
  margin-bottom: 16px;
}

.integrations-mini-summary {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 14px;
}

.integrations-mini-summary strong {
  font-size: 24px;
}

.integrations-table {
  width: 100%;
}

@media (max-width: 1100px) {
  .integrations-summary,
  .integrations-diagnostics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .integrations-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .integrations-header,
  .integrations-mapping-layout {
    grid-template-columns: 1fr;
    display: grid;
  }

  .integrations-summary,
  .integrations-diagnostics,
  .integrations-form-grid,
  .integrations-form-grid--mapping {
    grid-template-columns: 1fr;
  }
}
</style>
