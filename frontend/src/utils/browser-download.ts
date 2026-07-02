export interface BrowserDownloadPayload {
  fileName: string;
  mimeType: string;
  content: string;
}

/**
 * 在浏览器侧创建 Blob 并触发下载。
 */
export function triggerBrowserDownload(payload: BrowserDownloadPayload): void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([payload.content], { type: payload.mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = payload.fileName;
  link.click();
  URL.revokeObjectURL(blobUrl);
}
