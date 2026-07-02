import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionQueueService {
  private readonly activeRequests = new Set<string>();
  private readonly activeSessionRequests = new Map<string, string>();
  private readonly requestSessionMap = new Map<string, string>();

  tryEnter(
    requestId: string,
    maxConcurrentQueries: number,
    sessionKey?: string,
  ): {
    accepted: boolean;
    queueNotice?: string;
  } {
    if (sessionKey) {
      const currentSessionRequest = this.activeSessionRequests.get(sessionKey);
      if (currentSessionRequest && currentSessionRequest !== requestId) {
        return {
          accepted: false,
          queueNotice: '当前会话仍有请求处理中，请稍后查看结果或继续等待。',
        };
      }
    }

    if (this.activeRequests.size >= maxConcurrentQueries) {
      return {
        accepted: false,
        queueNotice: '当前并发较高，已进入排队队列，请稍后查看结果。',
      };
    }

    this.activeRequests.add(requestId);
    if (sessionKey) {
      this.activeSessionRequests.set(sessionKey, requestId);
      this.requestSessionMap.set(requestId, sessionKey);
    }
    return { accepted: true };
  }

  leave(requestId: string): void {
    this.activeRequests.delete(requestId);
    const sessionKey = this.requestSessionMap.get(requestId);
    if (sessionKey) {
      const currentSessionRequest = this.activeSessionRequests.get(sessionKey);
      if (currentSessionRequest === requestId) {
        this.activeSessionRequests.delete(sessionKey);
      }
      this.requestSessionMap.delete(requestId);
    }
  }

  isSessionBusy(sessionKey: string): boolean {
    return this.activeSessionRequests.has(sessionKey);
  }
}
