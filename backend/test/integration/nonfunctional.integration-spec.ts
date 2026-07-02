import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AccessPolicyRepository } from '../../src/modules/governance/access-policy.repository';
import { SessionQueueService } from '../../src/modules/sessions/session-queue.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('nonfunctional integration', () => {
  let app: INestApplication;
  let sessionQueueService: SessionQueueService;
  let accessPolicyRepository: AccessPolicyRepository;

  beforeAll(async () => {
    app = await createTestApp();
    sessionQueueService = app.get(SessionQueueService);
    accessPolicyRepository = app.get(AccessPolicyRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  it('并发受限时应返回排队状态', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const currentPolicy = accessPolicyRepository.getCurrent();
    accessPolicyRepository.save({
      ...currentPolicy,
      maxConcurrentQueries: 1,
    });
    sessionQueueService.tryEnter('occupied', 1);

    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    expect(response.body.status).toBe('QUEUED');
    sessionQueueService.leave('occupied');
    accessPolicyRepository.save(currentPolicy);
  });
});
