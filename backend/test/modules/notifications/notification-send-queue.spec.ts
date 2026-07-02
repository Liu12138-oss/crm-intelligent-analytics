import { NotificationSendQueue } from '../../../src/modules/notifications/notification-send-queue';

describe('NotificationSendQueue', () => {
  it('应按队列串行执行并保持相邻发送最小间隔', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    try {
      const queue = new NotificationSendQueue();
      const events: string[] = [];

      const first = queue.enqueue(async () => {
        events.push(`first:${Date.now()}`);
        return 'first';
      }, 3000);
      const second = queue.enqueue(async () => {
        events.push(`second:${Date.now()}`);
        return 'second';
      }, 3000);

      await Promise.resolve();
      expect(events).toEqual(['first:0']);

      jest.advanceTimersByTime(2999);
      await Promise.resolve();
      expect(events).toEqual(['first:0']);

      jest.advanceTimersByTime(1);
      await expect(Promise.all([first, second])).resolves.toEqual([
        'first',
        'second',
      ]);
      expect(events).toEqual(['first:0', 'second:3000']);
    } finally {
      jest.useRealTimers();
    }
  });
});
