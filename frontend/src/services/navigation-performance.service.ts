import { readonly, ref } from 'vue';

interface NavigationTraceSnapshot {
  traceId: string;
  targetPath: string;
}

const NAVIGATION_TRACE_PREFIX = 'crm-navigation';
let currentTrace: NavigationTraceSnapshot | null = null;
const isShellTransitioningState = ref(false);

function resolvePerformanceApi(): Performance | undefined {
  if (typeof performance === 'undefined') {
    return undefined;
  }

  return performance;
}

function buildMarkName(traceId: string, phase: string): string {
  return `${NAVIGATION_TRACE_PREFIX}:${traceId}:${phase}`;
}

function markTracePhase(traceId: string, phase: string): void {
  const performanceApi = resolvePerformanceApi();
  if (!performanceApi) {
    return;
  }

  performanceApi.mark(buildMarkName(traceId, phase));
}

function measureTracePhase(traceId: string, phase: string, startPhase: string, endPhase: string): void {
  const performanceApi = resolvePerformanceApi();
  if (!performanceApi) {
    return;
  }

  const startMark = buildMarkName(traceId, startPhase);
  const endMark = buildMarkName(traceId, endPhase);
  try {
    performanceApi.measure(
      `${NAVIGATION_TRACE_PREFIX}:${traceId}:${phase}`,
      startMark,
      endMark,
    );
  } catch {
    // 标记可能因重复导航或手动刷新不存在，这类观测失败不能影响主流程。
  }
}

export function beginNavigationTrace(targetPath: string): void {
  const normalizedTargetPath = targetPath.trim();
  if (!normalizedTargetPath) {
    return;
  }

  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  currentTrace = {
    traceId,
    targetPath: normalizedTargetPath,
  };
  isShellTransitioningState.value = true;
  markTracePhase(traceId, 'menu_click');
}

export function markRouteConfirmed(targetPath: string): void {
  if (!currentTrace || currentTrace.targetPath !== targetPath) {
    return;
  }

  markTracePhase(currentTrace.traceId, 'route_confirmed');
  measureTracePhase(
    currentTrace.traceId,
    'menu_click_to_route_confirmed',
    'menu_click',
    'route_confirmed',
  );
}

export function markShellVisible(targetPath: string): void {
  if (!currentTrace || currentTrace.targetPath !== targetPath) {
    return;
  }

  markTracePhase(currentTrace.traceId, 'shell_visible');
  measureTracePhase(
    currentTrace.traceId,
    'route_confirmed_to_shell_visible',
    'route_confirmed',
    'shell_visible',
  );
  isShellTransitioningState.value = false;
}

export function markPageDataReady(targetPath: string): void {
  if (!currentTrace || currentTrace.targetPath !== targetPath) {
    return;
  }

  markTracePhase(currentTrace.traceId, 'page_data_ready');
  measureTracePhase(
    currentTrace.traceId,
    'shell_visible_to_page_data_ready',
    'shell_visible',
    'page_data_ready',
  );
}

export const isShellTransitioning = readonly(isShellTransitioningState);

export function resetNavigationTraceState(): void {
  currentTrace = null;
  isShellTransitioningState.value = false;
}
