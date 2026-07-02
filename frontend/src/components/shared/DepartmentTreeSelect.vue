<script setup lang="ts">
import { computed } from 'vue';
import { ElTreeSelect } from 'element-plus';
import type { DepartmentTreeNode } from '@/utils/department-tree';

type DepartmentTreeSelectValue = string | string[] | undefined;

const props = withDefaults(
  defineProps<{
    modelValue: DepartmentTreeSelectValue;
    departments: DepartmentTreeNode[];
    placeholder?: string;
    disabled?: boolean;
    multiple?: boolean;
    showCheckbox?: boolean;
    filterable?: boolean;
    clearable?: boolean;
    checkStrictly?: boolean;
    collapseTags?: boolean;
    collapseTagsTooltip?: boolean;
    popperClass?: string;
    dataTest?: string;
  }>(),
  {
    placeholder: '请选择部门',
    disabled: false,
    multiple: false,
    showCheckbox: false,
    filterable: true,
    clearable: true,
    checkStrictly: true,
    collapseTags: false,
    collapseTagsTooltip: false,
    popperClass: '',
    dataTest: '',
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: DepartmentTreeSelectValue): void;
  (event: 'change', value: DepartmentTreeSelectValue): void;
}>();

function normalizeDepartments(nodes: DepartmentTreeNode[]): DepartmentTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    disabled: node.disabled ?? node.selectable === false,
    children: node.children ? normalizeDepartments(node.children) : undefined,
  }));
}

const normalizedDepartments = computed(() => normalizeDepartments(props.departments));
const mergedPopperClass = computed(() =>
  ['department-tree-select__popper', props.popperClass].filter(Boolean).join(' '),
);
</script>

<template>
  <el-tree-select
    :model-value="props.modelValue"
    :data-test="props.dataTest || undefined"
    :data="normalizedDepartments"
    node-key="id"
    :props="{ label: 'label', children: 'children', disabled: 'disabled' }"
    :disabled="props.disabled"
    :multiple="props.multiple"
    :show-checkbox="props.showCheckbox"
    :filterable="props.filterable"
    :clearable="props.clearable"
    :check-strictly="props.checkStrictly"
    :collapse-tags="props.collapseTags"
    :collapse-tags-tooltip="props.collapseTagsTooltip"
    :popper-class="mergedPopperClass"
    :placeholder="props.placeholder"
    @update:model-value="emit('update:modelValue', $event as DepartmentTreeSelectValue)"
    @change="emit('change', $event as DepartmentTreeSelectValue)"
  />
</template>
