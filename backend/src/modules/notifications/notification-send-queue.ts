export class NotificationSendQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStartedAt: number | undefined;

  async enqueue<T>(
    operation: () => Promise<T>,
    minIntervalMs: number,
  ): Promise<T> {
    const run = async (): Promise<T> => {
      const waitMs =
        this.lastStartedAt === undefined
          ? 0
          : Math.max(0, this.lastStartedAt + minIntervalMs - Date.now());
      if (waitMs > 0) {
        await this.delay(waitMs);
      }

      this.lastStartedAt = Date.now();
      return await operation();
    };

    const next = this.tail.then(run, run);
    this.tail = next.catch(() => undefined);
    return await next;
  }

  private async delay(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}
