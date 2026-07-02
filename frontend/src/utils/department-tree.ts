export interface DepartmentTreeNode {
  id: string;
  label: string;
  selectable?: boolean;
  disabled?: boolean;
  children?: DepartmentTreeNode[];
}

export interface FlatDepartmentTreeItem {
  id: string;
  label: string;
  parentDepartmentId?: string;
  selectable?: boolean;
  disabled?: boolean;
}

/**
 * 复制部门树节点，避免后续归一化时直接改写原始树结构。
 */
function cloneDepartmentTreeNode(node: DepartmentTreeNode): DepartmentTreeNode {
  return {
    ...node,
    children: node.children?.map((item) => cloneDepartmentTreeNode(item)),
  };
}

/**
 * 合并两组同层级部门节点；若命中相同 ID，则递归合并其子节点。
 */
function mergeDepartmentTreeChildren(
  baseChildren: DepartmentTreeNode[],
  incomingChildren: DepartmentTreeNode[],
): DepartmentTreeNode[] {
  const mergedChildren = baseChildren.map((item) => cloneDepartmentTreeNode(item));
  const mergedIndexMap = new Map(
    mergedChildren.map((item, index) => [item.id, index] as const),
  );

  for (const incomingNode of incomingChildren) {
    const existingIndex = mergedIndexMap.get(incomingNode.id);
    if (existingIndex === undefined) {
      mergedChildren.push(cloneDepartmentTreeNode(incomingNode));
      mergedIndexMap.set(incomingNode.id, mergedChildren.length - 1);
      continue;
    }

    const existingNode = mergedChildren[existingIndex]!;
    const mergedGrandChildren = mergeDepartmentTreeChildren(
      existingNode.children ?? [],
      incomingNode.children ?? [],
    );
    mergedChildren[existingIndex] = {
      ...existingNode,
      selectable: existingNode.selectable ?? incomingNode.selectable,
      disabled: existingNode.disabled ?? incomingNode.disabled,
      children: mergedGrandChildren.length > 0 ? mergedGrandChildren : undefined,
    };
  }

  return mergedChildren;
}

export function buildDepartmentTree(
  items: FlatDepartmentTreeItem[],
): DepartmentTreeNode[] {
  const nodeMap = new Map<string, DepartmentTreeNode>();
  const roots: DepartmentTreeNode[] = [];

  for (const item of items) {
    nodeMap.set(item.id, {
      id: item.id,
      label: item.label,
      selectable: item.selectable,
      disabled: item.disabled,
      children: [],
    });
  }

  for (const item of items) {
    const currentNode = nodeMap.get(item.id);
    if (!currentNode) {
      continue;
    }

    if (item.parentDepartmentId && nodeMap.has(item.parentDepartmentId)) {
      nodeMap.get(item.parentDepartmentId)!.children!.push(currentNode);
      continue;
    }

    roots.push(currentNode);
  }

  return roots;
}

/**
 * 当同一棵树里同时存在“全公司”这类虚拟策略根和真实组织根时，
 * 统一保留虚拟根，并把其它顶层节点收敛到它下面，避免选择器出现两个近义根节点。
 */
export function collapseDepartmentTreeRootsIntoGlobalRoot(
  roots: DepartmentTreeNode[],
  globalRootId = '__GLOBAL_ALL__',
): DepartmentTreeNode[] {
  const globalRoot = roots.find((item) => item.id === globalRootId);
  if (!globalRoot || roots.length <= 1) {
    return roots;
  }

  const normalizedGlobalRoot = cloneDepartmentTreeNode(globalRoot);
  let normalizedChildren = normalizedGlobalRoot.children ?? [];

  for (const root of roots) {
    if (root.id === globalRootId) {
      continue;
    }

    const nodesToMerge =
      root.children && root.children.length > 0 ? root.children : [root];
    normalizedChildren = mergeDepartmentTreeChildren(
      normalizedChildren,
      nodesToMerge,
    );
  }

  normalizedGlobalRoot.children =
    normalizedChildren.length > 0 ? normalizedChildren : undefined;
  return [normalizedGlobalRoot];
}
