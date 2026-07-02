import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { ContractReviewAiReviewService } from '../../src/modules/contract-review/contract-review.ai-review.service';
import { createTestApp } from '../test-app';
import { loginAs } from '../auth-test.helper';

describe('contract review integration', () => {
  let app: INestApplication;
  let contractReviewAiReviewService: ContractReviewAiReviewService;

  beforeAll(async () => {
    app = await createTestApp();
    contractReviewAiReviewService = app.get(ContractReviewAiReviewService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('合同上传前置校验失败时不应进入 AI 审核链路', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const reviewSpy = jest.spyOn(contractReviewAiReviewService, 'reviewDocument');

    await request(app.getHttpServer())
      .post('/api/v1/contract-reviews/tasks')
      .set('Cookie', cookies)
      .expect(400);

    expect(reviewSpy).not.toHaveBeenCalled();
  });
});
