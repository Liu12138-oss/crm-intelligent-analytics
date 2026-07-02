/**
 * Block 渲染器注册中心
 *
 * 设计目标：
 * - 把 ManagementSectionCanvas 的静态 v-if/v-else-if 链改为可注册的渲染器表
 * - 新增 blockType 只需调用 registerBlockRenderer 注册，无需改核心 Canvas 组件
 * - 保留对现有 block 的完全兼容
 * - 支持运行时动态注册（未来插件化扩展）
 */

import type { Component } from 'vue';
import type { ManagementReportBlock } from '@/types/management-report';

/**
 * Block 渲染器接口
 * 每个 blockType 对应一个 Vue 组件
 */
export interface BlockRendererEntry {
  blockType: string;
  component: Component;
}

// 渲染器注册表，按 blockType 索引
const rendererRegistry = new Map<string, Component>();

/**
 * 注册一个 block 渲染器
 * @param blockType block 类型标识
 * @param component 对应的 Vue 组件
 */
export function registerBlockRenderer(blockType: string, component: Component): void {
  if (rendererRegistry.has(blockType)) {
    // 允许覆盖注册，用于测试 mock 或运行时升级
  }
  rendererRegistry.set(blockType, component);
}

/**
 * 批量注册 block 渲染器
 * @param entries 渲染器条目数组
 */
export function registerBlockRenderers(entries: BlockRendererEntry[]): void {
  for (const entry of entries) {
    registerBlockRenderer(entry.blockType, entry.component);
  }
}

/**
 * 查找 block 对应的渲染器组件
 * @param block 待渲染的 block 数据
 * @returns 对应的 Vue 组件，未注册时返回 undefined
 */
export function resolveBlockRenderer(block: ManagementReportBlock): Component | undefined {
  return rendererRegistry.get(block.blockType);
}

/**
 * 检查 blockType 是否已注册渲染器
 */
export function hasBlockRenderer(blockType: string): boolean {
  return rendererRegistry.has(blockType);
}

/**
 * 列出所有已注册的 blockType，用于调试和验证
 */
export function listRegisteredBlockTypes(): string[] {
  return Array.from(rendererRegistry.keys());
}
