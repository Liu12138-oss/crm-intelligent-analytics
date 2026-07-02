<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ElButton,
  ElEmpty,
  ElIcon,
  ElInput,
  ElOption,
  ElPagination,
  ElSelect,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTooltip,
} from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { QueryAssetRecommendationItem, QueryTemplateItem } from '@/types/analysis';
import { UiIcons } from '@/ui/icons';

const props = defineProps<{
  items: QueryTemplateItem[];
  recommendedItems?: QueryAssetRecommendationItem[];
  compact?: boolean;
  busy?: boolean;
  loading?: boolean;
  viewAllowed?: boolean;
  tags?: string[];
  page?: number;
  pageSize?: number;
  total?: number;
  canCreate?: boolean;
  deletingTemplateId?: string | null;
}>();

const emit = defineEmits<{
  run: [templateId: string];
  copy: [templateId: string];
  view: [templateId: string];
  create: [];
  delete: [templateId: string];
  query: [params: {
    scope: 'mine' | 'others';
    keyword?: string;
    tag?: string;
    ownerUserId?: string;
    page?: number;
    pageSize?: number;
  }];
}>();

const activeScope = ref<'mine' | 'others'>('mine');
const keyword = ref('');
const ownerUserId = ref('');
const tag = ref('');
const hiddenDisplayTags = new Set(['猜你想查', '常用查询', '内置模板']);

interface CommonQueryDisplayItem extends QueryTemplateItem {
  isRecommended?: boolean;
}

const hasExplicitQuery = computed(() => {
  const hasOwnerFilter = activeScope.value === 'others' && Boolean(ownerUserId.value.trim());
  return Boolean(keyword.value.trim() || tag.value || hasOwnerFilter);
});

const itemByTemplateId = computed(() => new Map(props.items.map((item) => [item.templateId, item])));

const visibleRecommendedItems = computed<CommonQueryDisplayItem[]>(() => {
  const usedIds = new Set<string>();
  return (props.recommendedItems ?? []).flatMap((item) => {
    if (usedIds.has(item.templateId)) {
      return [];
    }
    usedIds.add(item.templateId);
    const matchedItem = itemByTemplateId.value.get(item.templateId);
    if (matchedItem) {
      return [{
        ...matchedItem,
        recommendationReason: item.recommendationReason,
        isRecommended: true,
      }];
    }
    return [{
      templateId: item.templateId,
      name: item.name,
      description: item.description,
      defaultQuestionText: item.name,
      defaultFilters: {},
      visibleRoleIds: [],
      displayOrder: 0,
      clickCount7d: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '',
      recommendationReason: item.recommendationReason,
      isRecommended: true,
    }];
  });
});

const visibleItems = computed<CommonQueryDisplayItem[]>(() => {
  if (activeScope.value !== 'mine' || hasExplicitQuery.value) {
    return props.items;
  }
  const recommendedIds = new Set(visibleRecommendedItems.value.map((item) => item.templateId));
  return [
    ...visibleRecommendedItems.value,
    ...props.items.filter((item) => !recommendedIds.has(item.templateId)),
  ];
});

const visibleFilterTags = computed(() =>
  (props.tags ?? [])
    .map((item) => item.trim())
    .filter((item) => item && !hiddenDisplayTags.has(item)),
);

// 向父组件提交模板查询条件，查询按钮和回车都复用同一出口，避免筛选口径不一致。
function emitQuery(nextPage = 1): void {
  emit('query', {
    scope: activeScope.value,
    keyword: keyword.value.trim() || undefined,
    tag: tag.value || undefined,
    ownerUserId: ownerUserId.value.trim() || undefined,
    page: nextPage,
    pageSize: props.pageSize ?? 20,
  });
}

// 切换模板范围时立即回到第一页，保证分页结果不会沿用上一个范围的页码。
function switchScope(scope: 'mine' | 'others'): void {
  activeScope.value = scope;
  emitQuery(1);
}

// 创建人优先展示后端解析出的中文姓名，缺失时回退到用户 ID，避免空归属影响模板识别。
function resolveOwnerLabel(item: CommonQueryDisplayItem): string {
  return item.ownerName?.trim() || item.ownerUserId?.trim() || '系统模板';
}

// 过滤来源型标签，卡片只展示对业务筛选有帮助的标签，避免“常用查询 / 内置模板”占用可读空间。
function getVisibleTags(item: CommonQueryDisplayItem): string[] {
  const maxTagCount = item.isRecommended ? 3 : 4;
  return (item.tags ?? [])
    .map((itemTag) => itemTag.trim())
    .filter((itemTag) => itemTag && !hiddenDisplayTags.has(itemTag))
    .slice(0, maxTagCount);
}

// 根据标签位置生成稳定色彩层级，同一卡片内标签颜色保持区分但不过度抢占标题视觉。
function getTagToneClass(index: number): string {
  return `common-query-card__tag--tone-${(index % 4) + 1}`;
}
</script>

<template>
  <section
    class="panel common-query-panel"
    :class="{ 'analysis-asset-panel': compact }"
  >
    <div
      v-if="!compact"
      class="panel__header common-query-panel__header"
    >
      <div>
        <h3 class="table-panel__title">
          常用查询
        </h3>
        <p class="common-query-panel__subtitle">
          按当前权限范围执行，模板可复制为个人副本。
        </p>
      </div>
      <el-tag
        class="badge status-tone--neutral"
        type="info"
        round
      >
        <el-icon>
          <component :is="UiIcons.template" />
        </el-icon>
        {{ total ?? items.length }} 条
      </el-tag>
    </div>

    <div
      class="panel__body common-query-panel__body"
      :class="{ 'analysis-asset-panel__body': compact }"
    >
      <div class="common-query-panel__tabs-row">
        <el-tabs
          :model-value="activeScope"
          class="common-query-panel__tabs"
          @tab-change="(name) => switchScope(name as 'mine' | 'others')"
        >
          <el-tab-pane
            label="我的模板"
            name="mine"
          />
          <el-tab-pane
            label="其它模板"
            name="others"
          />
        </el-tabs>
        <el-tooltip
          v-if="canCreate"
          content="新增查询模板"
          placement="top"
        >
          <el-button
            class="button-primary analysis-button analysis-button--icon common-query-panel__create"
            type="primary"
            aria-label="新增查询模板"
            @click="emit('create')"
          >
            <el-icon>
              <component :is="UiIcons.plus" />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <div
        class="common-query-panel__filters"
        :class="{ 'common-query-panel__filters--mine': activeScope === 'mine' }"
      >
        <el-input
          v-model="keyword"
          class="common-query-panel__search"
          clearable
          placeholder="模板名称、说明或标签"
          @keyup.enter="emitQuery(1)"
          @clear="emitQuery(1)"
        >
          <template #prefix>
            <el-icon>
              <component :is="UiIcons.search" />
            </el-icon>
          </template>
        </el-input>
        <el-input
          v-if="activeScope === 'others'"
          v-model="ownerUserId"
          class="common-query-panel__owner"
          clearable
          placeholder="用户/创建人"
          @keyup.enter="emitQuery(1)"
          @clear="emitQuery(1)"
        >
          <template #prefix>
            <el-icon>
              <component :is="UiIcons.user" />
            </el-icon>
          </template>
        </el-input>
        <el-select
          v-model="tag"
          class="common-query-panel__select common-query-panel__select--tag"
          clearable
          filterable
          placeholder="标签"
          @change="emitQuery(1)"
          @clear="emitQuery(1)"
        >
          <el-option
            v-for="item in visibleFilterTags"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-tooltip
          content="查询模板"
          placement="top"
        >
          <el-button
            class="button-primary analysis-button analysis-button--icon common-query-panel__query-button"
            type="primary"
            :disabled="busy || loading"
            aria-label="查询模板"
            @click="emitQuery(1)"
          >
            <el-icon>
              <component :is="UiIcons.search" />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>

      <div
        class="common-query-panel__list"
        :aria-busy="loading ? 'true' : 'false'"
      >
        <div
          v-if="loading"
          class="common-query-panel__loading"
          role="status"
          aria-live="polite"
        >
          <div class="common-query-panel__loading-copy">
            <strong>模板数据加载中</strong>
            <span>正在按当前范围获取可用模板。</span>
          </div>
          <div
            v-for="index in 4"
            :key="index"
            class="common-query-panel__skeleton-card"
          >
            <div class="skeleton-line skeleton-line--long" />
            <div class="skeleton-line skeleton-line--medium" />
            <div class="common-query-panel__skeleton-meta">
              <div class="skeleton-line skeleton-line--short" />
              <div class="skeleton-line skeleton-line--short" />
            </div>
          </div>
        </div>

        <template v-else>
          <article
            v-for="item in visibleItems"
            :key="item.templateId"
            class="interactive-card analysis-asset-item common-query-card"
          >
            <div class="analysis-asset-item__content common-query-card__content">
              <h4>
                <NumberToneText :text="item.name" />
              </h4>
              <div class="common-query-card__meta">
                <span>累计执行 {{ item.usageCountTotal ?? item.clickCount7d ?? 0 }} 次</span>
              </div>
              <div class="common-query-card__identity-row">
                <span
                  class="common-query-card__owner"
                  :title="`创建人：${resolveOwnerLabel(item)}`"
                >
                  <el-icon>
                    <component :is="UiIcons.user" />
                  </el-icon>
                  <span>{{ resolveOwnerLabel(item) }}</span>
                </span>
                <div
                  v-if="item.isRecommended || getVisibleTags(item).length"
                  class="common-query-card__tags"
                >
                  <el-tag
                    v-if="item.isRecommended"
                    class="common-query-card__tag common-query-card__tag--recommend"
                    type="info"
                    round
                  >
                    猜你想查
                  </el-tag>
                  <el-tag
                    v-for="(itemTag, index) in getVisibleTags(item)"
                    :key="itemTag"
                    class="common-query-card__tag"
                    :class="getTagToneClass(index)"
                    type="info"
                    round
                  >
                    {{ itemTag }}
                  </el-tag>
                </div>
              </div>
            </div>
            <div class="common-query-card__actions">
              <el-tooltip
                content="查看模板内容"
                placement="top"
              >
                <el-button
                  class="button-secondary analysis-button analysis-button--icon"
                  :disabled="busy"
                  aria-label="查看模板内容"
                  @click="emit('view', item.templateId)"
                >
                  <el-icon>
                    <component :is="UiIcons.detail" />
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                content="执行模板"
                placement="top"
              >
                <el-button
                  class="button-primary analysis-button analysis-button--icon"
                  type="primary"
                  :disabled="busy"
                  :loading="busy"
                  aria-label="执行模板"
                  @click="emit('run', item.templateId)"
                >
                  <el-icon v-if="!busy">
                    <component :is="UiIcons.workflow" />
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                v-if="activeScope === 'others'"
                content="复制为我的个人模板副本"
                placement="top"
              >
                <el-button
                  class="button-secondary analysis-button analysis-button--icon"
                  :disabled="busy"
                  aria-label="添加到我的模板"
                  @click="emit('copy', item.templateId)"
                >
                  <el-icon>
                    <component :is="UiIcons.plus" />
                  </el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip
                v-if="activeScope === 'mine'"
                content="删除我的模板"
                placement="top"
              >
                <el-button
                  class="button-secondary analysis-button analysis-button--icon common-query-card__delete"
                  :disabled="busy || deletingTemplateId === item.templateId"
                  :loading="deletingTemplateId === item.templateId"
                  aria-label="删除我的模板"
                  @click="emit('delete', item.templateId)"
                >
                  <el-icon v-if="deletingTemplateId !== item.templateId">
                    <component :is="UiIcons.delete" />
                  </el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </article>

          <el-empty
            v-if="visibleItems.length === 0"
            :description="viewAllowed === false ? '当前账号未开通常用模板可见权限。' : '暂无符合条件的模板。'"
          />
        </template>
      </div>

      <el-pagination
        v-if="(total ?? 0) > (pageSize ?? 20)"
        class="common-query-panel__pagination"
        background
        layout="prev, pager, next"
        :current-page="page ?? 1"
        :page-size="pageSize ?? 20"
        :total="total ?? 0"
        @current-change="emitQuery"
      />
    </div>
  </section>
</template>
