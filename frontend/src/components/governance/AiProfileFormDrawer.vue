<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  ElButton,
  ElCheckbox,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus';
import type { AiModelProfileItem } from '@/types/analysis';

const OPENAI_HTTP_REASONING_EFFORT_OPTIONS = ['low', 'medium', 'high'] as const;

const PLATFORM_PRESET_OPTIONS = [
  {
    label: '内部 OpenAI 兼容网关',
    value: 'internal-openai-gateway',
    providerCode: 'internal-openai-gateway',
    wireApi: 'responses',
    structuredOutputMode: 'json_schema',
  },
  {
    label: 'Qwen / 阿里百炼',
    value: 'qwen',
    providerCode: 'qwen',
    wireApi: 'chat_completions',
    structuredOutputMode: 'json_object',
  },
  {
    label: 'DeepSeek',
    value: 'deepseek',
    providerCode: 'deepseek',
    wireApi: 'chat_completions',
    structuredOutputMode: 'json_object',
  },
  {
    label: 'GLM / 智谱',
    value: 'glm',
    providerCode: 'glm',
    wireApi: 'chat_completions',
    structuredOutputMode: 'json_object',
  },
  {
    label: '手动配置',
    value: 'manual',
    providerCode: '',
    wireApi: 'responses',
    structuredOutputMode: 'json_schema',
  },
] as const;

const props = defineProps<{
  visible: boolean;
  profile?: AiModelProfileItem | null;
  saving?: boolean;
  testing?: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  save: [payload: Record<string, unknown>];
  test: [payload: Record<string, unknown>];
  clearSecret: [profile: AiModelProfileItem];
}>();

type FormErrorKey =
  | 'name'
  | 'providerCode'
  | 'model'
  | 'baseUrl'
  | 'apiKey';

const form = reactive({
  name: '',
  providerCode: '',
  platformPreset: 'internal-openai-gateway',
  model: '',
  baseUrl: '',
  apiKey: '',
  reasoningEffort: 'low',
  wireApi: 'responses',
  structuredOutputMode: 'json_schema',
  disableResponseStorage: true,
  proxyEnvText: '',
});

const drawerTitle = computed(() => (props.profile ? '编辑 AI 配置' : '新增 AI 配置'));
const canClearSecret = computed(() => Boolean(props.profile?.secretConfigured));
const requireApiKey = computed(() => !props.profile?.secretConfigured);
const bootstrapWarnings = computed(() => props.profile?.bootstrapWarnings ?? []);
const formErrors = reactive<Record<FormErrorKey, string>>({
  name: '',
  providerCode: '',
  model: '',
  baseUrl: '',
  apiKey: '',
});

watch(
  () => props.profile,
  (profile) => {
    form.name = profile?.name ?? '';
    form.providerCode = profile?.providerCode ?? '';
    form.platformPreset = resolvePlatformPreset(profile);
    form.model = profile?.model ?? '';
    form.baseUrl = profile?.baseUrl ?? '';
    form.apiKey = '';
    form.reasoningEffort = normalizeReasoningEffort(profile?.reasoningEffort);

    const sdkOptions = profile?.sdkOptions ?? {};
    form.wireApi = String(sdkOptions.wireApi ?? 'responses');
    form.structuredOutputMode = String(
      sdkOptions.structuredOutputMode ??
        (form.wireApi === 'chat_completions' ? 'json_object' : 'json_schema'),
    );
    form.disableResponseStorage = sdkOptions.disableResponseStorage !== false;
    form.proxyEnvText =
      sdkOptions.proxyEnv && typeof sdkOptions.proxyEnv === 'object'
        ? JSON.stringify(sdkOptions.proxyEnv, null, 2)
        : '';
  },
  { immediate: true },
);

watch(
  () => form.platformPreset,
  (presetValue) => {
    const preset = PLATFORM_PRESET_OPTIONS.find((item) => item.value === presetValue);
    if (!preset || preset.value === 'manual') {
      return;
    }

    form.providerCode = preset.providerCode;
    form.wireApi = preset.wireApi;
    form.structuredOutputMode = preset.structuredOutputMode;
  },
);

function closeDrawer(): void {
  emit('update:visible', false);
}

function normalizeReasoningEffort(value?: string): string {
  const normalizedValue = value?.trim().toLowerCase();
  return OPENAI_HTTP_REASONING_EFFORT_OPTIONS.includes(normalizedValue as never)
    ? normalizedValue!
    : 'low';
}

function clearErrors(): void {
  (Object.keys(formErrors) as FormErrorKey[]).forEach((key) => {
    formErrors[key] = '';
  });
}

function setError(key: FormErrorKey, message: string): void {
  formErrors[key] = message;
}

/**
 * 判断管理员是否把完整接口 URL 误填到了基础地址字段。
 *
 * 当前后端会根据协议类型自动拼接 `/responses` 或 `/chat/completions`，
 * 因此这里必须拦住“完整路径误填”，避免健康检查命中 404。
 */
function isEndpointStyleBaseUrl(value: string): boolean {
  const normalizedValue = value.trim().replace(/\/+$/u, '').toLowerCase();
  return (
    normalizedValue.endsWith('/responses') ||
    normalizedValue.endsWith('/chat/completions') ||
    normalizedValue.endsWith('/v1/messages')
  );
}

/**
 * OpenAI 兼容 HTTP 接入不应误填 Anthropic 协议网关。
 *
 * 当前页面固定维护的是 OpenAI 兼容 HTTP Profile，
 * 一旦填入 `/anthropic` 路径，后端继续拼接 `/responses` 或 `/chat/completions`
 * 就会命中错误地址，健康检查直接返回 404。
 */
function isAnthropicGatewayBaseUrl(value: string): boolean {
  const normalizedValue = value.trim().replace(/\/+$/u, '').toLowerCase();
  return normalizedValue.includes('/anthropic');
}

function parseProxyEnvText(): Record<string, string> | undefined {
  if (!form.proxyEnvText.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(form.proxyEnvText) as Record<string, unknown>;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) {
        normalized[key] = value.trim();
      }
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function resolvePlatformPreset(profile?: AiModelProfileItem | null): string {
  const preset = profile?.sdkOptions?.platformPreset;
  if (typeof preset === 'string' && preset.trim()) {
    return preset;
  }

  const matchedPreset = PLATFORM_PRESET_OPTIONS.find(
    (item) => item.providerCode === profile?.providerCode,
  );
  return matchedPreset?.value ?? 'manual';
}

function buildPayload(): Record<string, unknown> {
  return {
    ...(props.profile?.id ? { profileId: props.profile.id } : {}),
    name: form.name,
    providerCode: form.providerCode,
    sdkType: 'openai-compatible-http',
    model: form.model,
    baseUrl: form.baseUrl,
    apiKey: form.apiKey,
    reasoningEffort: form.reasoningEffort,
    sdkOptions: {
      platformPreset: form.platformPreset,
      wireApi: form.wireApi,
      structuredOutputMode: form.structuredOutputMode,
      requiresOpenaiAuth: true,
      disableResponseStorage: form.disableResponseStorage,
      proxyEnv: parseProxyEnvText(),
    },
  };
}

function validateForm(): boolean {
  clearErrors();
  let valid = true;

  if (!form.name.trim()) {
    setError('name', '请填写配置名称');
    valid = false;
  }

  if (!form.providerCode.trim()) {
    setError('providerCode', '请填写提供方标识');
    valid = false;
  }

  if (!form.model.trim()) {
    setError('model', '请填写模型名称');
    valid = false;
  }

  if (!form.baseUrl.trim()) {
    setError('baseUrl', '请输入服务地址');
    valid = false;
  } else if (isEndpointStyleBaseUrl(form.baseUrl)) {
    setError(
      'baseUrl',
      '服务地址请填写基础地址，不要包含 /chat/completions、/responses 或 /v1/messages。例如：https://api.lkeap.cloud.tencent.com/plan/v3',
    );
    valid = false;
  } else if (isAnthropicGatewayBaseUrl(form.baseUrl)) {
    setError(
      'baseUrl',
      '当前接入类型是 OpenAI 兼容 HTTP，请不要填写 /anthropic 网关。若接腾讯 Token Plan，请改为基础地址：https://api.lkeap.cloud.tencent.com/plan/v3',
    );
    valid = false;
  }

  if (requireApiKey.value && !form.apiKey.trim()) {
    setError('apiKey', '请输入密钥');
    valid = false;
  }

  return valid;
}

function submit(): void {
  if (!validateForm()) {
    return;
  }

  emit('save', buildPayload());
}

function testConnection(): void {
  if (!validateForm()) {
    return;
  }

  emit('test', buildPayload());
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="drawerTitle"
    size="520px"
    @close="closeDrawer"
  >
    <el-form label-position="top">
      <el-form-item v-if="profile?.sourceType === 'ENV_BOOTSTRAPPED' || bootstrapWarnings.length > 0">
        <div class="form-field-hint">
          <div v-if="profile?.sourceType === 'ENV_BOOTSTRAPPED'">来源：环境默认</div>
          <div v-for="warning in bootstrapWarnings" :key="warning">{{ warning }}</div>
        </div>
      </el-form-item>
      <el-form-item :error="formErrors.name">
        <template #label>
          <span class="form-label-required">
            <span class="form-label-required__asterisk">*</span>
            配置名称
          </span>
        </template>
        <el-input v-model="form.name" />
        <div v-if="formErrors.name" class="form-field-error">{{ formErrors.name }}</div>
      </el-form-item>
      <el-form-item :error="formErrors.providerCode">
        <template #label>
          <span class="form-label-required">
            <span class="form-label-required__asterisk">*</span>
            提供方标识
          </span>
        </template>
        <el-input v-model="form.providerCode" />
        <div v-if="formErrors.providerCode" class="form-field-error">{{ formErrors.providerCode }}</div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="form-label-plain">接入类型</span>
        </template>
        <el-input model-value="OpenAI 兼容 HTTP" disabled />
      </el-form-item>
      <el-form-item :error="formErrors.model">
        <template #label>
          <span class="form-label-required">
            <span class="form-label-required__asterisk">*</span>
            模型名称
          </span>
        </template>
        <el-input v-model="form.model" />
        <div v-if="formErrors.model" class="form-field-error">{{ formErrors.model }}</div>
      </el-form-item>
      <el-form-item :error="formErrors.baseUrl">
        <template #label>
          <span class="form-label-required">
            <span class="form-label-required__asterisk">*</span>
            服务地址
          </span>
        </template>
        <el-input v-model="form.baseUrl" />
        <div class="form-field-hint">
          这里只填基础地址，系统会按“协议类型”自动拼接真实接口路径；不要直接填写
          <code>/chat/completions</code>、<code>/responses</code> 等完整接口后缀。
        </div>
        <div v-if="formErrors.baseUrl" class="form-field-error">{{ formErrors.baseUrl }}</div>
      </el-form-item>
      <el-form-item :error="formErrors.apiKey">
        <template #label>
          <span :class="requireApiKey ? 'form-label-required' : 'form-label-plain'">
            <span v-if="requireApiKey" class="form-label-required__asterisk">*</span>
            密钥
          </span>
        </template>
        <el-input
          v-model="form.apiKey"
          type="password"
          autocomplete="new-password"
          placeholder="留空则保持原密钥不变"
        />
        <div v-if="formErrors.apiKey" class="form-field-error">{{ formErrors.apiKey }}</div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="form-label-plain">推理等级</span>
        </template>
        <el-select v-model="form.reasoningEffort">
          <el-option
            v-for="option in OPENAI_HTTP_REASONING_EFFORT_OPTIONS"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
        <div class="form-field-hint">
          默认使用当前 Provider 可用的最低等级，优先保障响应速度；如需更强推理深度，可再手工调高。
        </div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="form-label-plain">平台预设</span>
        </template>
        <el-select v-model="form.platformPreset">
          <el-option
            v-for="preset in PLATFORM_PRESET_OPTIONS"
            :key="preset.value"
            :label="preset.label"
            :value="preset.value"
          />
        </el-select>
        <div class="form-field-hint">
          预设只填充建议值，真实模型名、服务地址和密钥仍以当前租户网关为准。
        </div>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="form-label-plain">协议类型</span>
        </template>
        <el-select v-model="form.wireApi">
          <el-option label="Responses 协议" value="responses" />
          <el-option label="Chat Completions 协议" value="chat_completions" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <template #label>
          <span class="form-label-plain">结构化输出模式</span>
        </template>
        <el-select v-model="form.structuredOutputMode">
          <el-option label="JSON Schema（最稳定）" value="json_schema" />
          <el-option label="JSON object（兼容模式）" value="json_object" />
          <el-option label="Prompt schema（提示词约束）" value="prompt_schema" />
        </el-select>
        <div class="form-field-hint">
          无论选择哪种模式，后端都会继续执行本地 schema 校验，非法结构不会进入业务执行。
        </div>
      </el-form-item>
      <el-form-item>
        <el-checkbox v-model="form.disableResponseStorage">
          禁用响应存储
        </el-checkbox>
      </el-form-item>
      <el-form-item label="代理环境变量 JSON">
        <el-input
          v-model="form.proxyEnvText"
          type="textarea"
          :rows="4"
          placeholder='例如 {"HTTPS_PROXY":"http://127.0.0.1:7890"}'
        />
      </el-form-item>
      <el-form-item v-if="canClearSecret">
        <el-button type="danger" plain @click="emit('clearSecret', profile!)">
          清空已保存密钥
        </el-button>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="audit-filter-actions">
        <el-button @click="closeDrawer">取消</el-button>
        <el-button :loading="testing" @click="testConnection">测试连接</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </div>
    </template>
  </el-drawer>
</template>
