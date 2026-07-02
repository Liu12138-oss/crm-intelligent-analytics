<script setup lang="ts">
import { ElButton, ElTable, ElTableColumn } from 'element-plus';
import type { AiModelActivationView, AiModelProfileItem } from '@/types/analysis';

const props = defineProps<{
  items: AiModelProfileItem[];
  activation: AiModelActivationView;
  loading?: boolean;
  busyProfileId?: string;
  busyAction?: 'activate' | 'copy' | 'delete' | 'healthCheck' | null;
}>();

defineEmits<{
  activate: [profile: AiModelProfileItem];
  copy: [profile: AiModelProfileItem];
  delete: [profile: AiModelProfileItem];
  edit: [profile: AiModelProfileItem];
  healthCheck: [profile: AiModelProfileItem];
}>();

function formatSdkLabel(value: AiModelProfileItem['sdkType']): string {
  return value === 'openai-compatible-http' ? 'OpenAI 兼容 HTTP' : '已移除';
}

/**
 * 将档案来源转成页面展示文案，帮助管理员区分环境默认项与手工维护项。
 */
function formatSourceLabel(value?: AiModelProfileItem['sourceType']): string {
  return value === 'ENV_BOOTSTRAPPED' ? '环境默认' : '手工维护';
}

/**
 * 推理等级当前直接展示稳定枚举值，便于管理员与运行时参数一一对应。
 */
function formatReasoningEffort(profile: AiModelProfileItem): string {
  if (profile.reasoningEffort?.trim()) {
    return profile.reasoningEffort.trim();
  }

  return 'low';
}

/**
 * 环境默认档案删除后会在下次 bootstrap 时重新出现，当前生效项删除会直接破坏运行时来源。
 * 因此只允许删除手工维护且非当前生效的档案。
 */
function canDeleteProfile(
  profile: AiModelProfileItem,
  activation: AiModelActivationView,
): boolean {
  return (
    profile.sourceType !== 'ENV_BOOTSTRAPPED' &&
    activation.activeProfileId !== profile.id
  );
}

/**
 * 判断当前行是否正在执行某个异步动作，供 loading / disabled 统一复用。
 */
function isBusyAction(
  profile: AiModelProfileItem,
  busyProfileId: string | undefined,
  busyAction: string | null | undefined,
  targetAction: 'activate' | 'copy' | 'delete' | 'healthCheck',
): boolean {
  return busyProfileId === profile.id && busyAction === targetAction;
}
</script>

<template>
  <div class="table-wrap">
    <el-table
      class="table"
      :data="items"
      :loading="loading"
      stripe
      border
      empty-text="暂无 AI Profile。"
    >
      <el-table-column
        prop="name"
        label="配置名称"
        min-width="180"
      />
      <el-table-column
        prop="providerCode"
        label="提供方"
        min-width="150"
      />
      <el-table-column
        label="来源"
        min-width="120"
      >
        <template #default="{ row }">
          <span>{{ formatSourceLabel(row.sourceType) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="model"
        label="模型"
        min-width="180"
      />
      <el-table-column
        prop="sdkType"
        label="接入方式"
        min-width="160"
      >
        <template #default="{ row }">
          {{ formatSdkLabel(row.sdkType) }}
        </template>
      </el-table-column>
      <el-table-column
        label="推理等级"
        min-width="120"
      >
        <template #default="{ row }">
          {{ formatReasoningEffort(row) }}
        </template>
      </el-table-column>
      <el-table-column
        label="启用"
        min-width="150"
      >
        <template #default="{ row }">
          <label class="ai-profile-radio">
            <input
              type="radio"
              name="active-ai-profile"
              :checked="activation.activeProfileId === row.id"
              :disabled="Boolean(props.busyAction)"
              @change="$emit('activate', row)"
            >
            <span>
              {{
                isBusyAction(row, props.busyProfileId, props.busyAction, 'activate')
                  ? '切换中...'
                  : activation.activeProfileId === row.id
                    ? '当前生效'
                    : '设为生效'
              }}
            </span>
          </label>
        </template>
      </el-table-column>
      <el-table-column
        label="最近测试"
        min-width="140"
      >
        <template #default="{ row }">
          {{ row.lastHealthCheckStatus === 'SUCCEEDED' ? '成功' : row.lastHealthCheckStatus === 'FAILED' ? '失败' : '未测试' }}
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        min-width="320"
        class-name="table-action-column"
      >
        <template #default="{ row }">
          <div class="ai-profile-table__actions table-action-buttons">
            <el-button size="small" :disabled="Boolean(props.busyAction)" @click="$emit('edit', row)">编辑</el-button>
            <el-button
              size="small"
              :loading="isBusyAction(row, props.busyProfileId, props.busyAction, 'copy')"
              :disabled="Boolean(props.busyAction)"
              @click="$emit('copy', row)"
            >
              {{ isBusyAction(row, props.busyProfileId, props.busyAction, 'copy') ? '复制中...' : '复制' }}
            </el-button>
            <el-button
              size="small"
              :loading="isBusyAction(row, props.busyProfileId, props.busyAction, 'healthCheck')"
              :disabled="Boolean(props.busyAction)"
              @click="$emit('healthCheck', row)"
            >
              {{ isBusyAction(row, props.busyProfileId, props.busyAction, 'healthCheck') ? '测试中...' : '测试' }}
            </el-button>
            <el-button
              v-if="canDeleteProfile(row, activation)"
              size="small"
              type="danger"
              plain
              :loading="isBusyAction(row, props.busyProfileId, props.busyAction, 'delete')"
              :disabled="Boolean(props.busyAction)"
              @click="$emit('delete', row)"
            >
              {{ isBusyAction(row, props.busyProfileId, props.busyAction, 'delete') ? '删除中...' : '删除' }}
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
