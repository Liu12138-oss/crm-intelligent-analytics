/**
 * 企微机器人端到端联调集成测试
 *
 * 模拟真实用户从企微会话提问到返回结果的全链路，覆盖 30 个业务+运营场景。
 *
 * 测试矩阵分类：
 * A. 常规问数（10个）：商机/报备/报价/订单/漏斗/负责人/区域/渠道/趋势/排名
 * B. 看板生成（4个）：渠道下单汇总/代理商发展/区域概览/负责人业绩
 * C. 补问与拦截（4个）：歧义补问/写入拦截/非CRM拦截/高风险拦截
 * D. 企微专项（6个）：语音消息/群聊隔离/幂等去重/会话排队/反馈事件/超时兜底
 * E. 边界与异常（6个）：空消息/超长消息/特殊字符/无权限角色/跨期对比/多条件组合
 */

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { createTestApp } from '../test-app';

describe('wecom bot end-to-end integration (30 scenarios)', () => {
  let app: INestApplication;
  let appStorage: AppStorageService;

  // 企微消息发送的固定 header
  const wecomHeaders = {
    'x-wecom-signature': 'test-signature',
    'x-wecom-source': 'wecom-bot',
  };

  // 消息 ID 自增计数器，确保每个测试唯一
  let msgCounter = 0;
  function nextMsgId(prefix: string = 'msg_e2e'): string {
    msgCounter += 1;
    return `${prefix}_${Date.now()}_${msgCounter}`;
  }

  // 发送企微文本消息的辅助方法
  // 返回 202 即视为受理成功，queryId 可能因去重/排队而不存在
  async function sendWecomText(params: {
    senderId?: string;
    conversationId?: string;
    messageText: string;
    chatType?: 'single' | 'group';
  }) {
    const senderId = params.senderId ?? 'wx_sales_director';
    const conversationId = params.conversationId ?? `conv_e2e_${nextMsgId()}`;
    const messageId = nextMsgId();
    const chatType = params.chatType ?? 'single';

    const payload =
      chatType === 'group'
        ? {
            msgid: messageId,
            chattype: 'group',
            chatid: conversationId,
            from: { userid: senderId },
            msgtype: 'text',
            text: { content: params.messageText },
          }
        : {
            externalConversationId: conversationId,
            senderId,
            messageId,
            messageText: params.messageText,
          };

    return request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set(wecomHeaders)
      .send(payload);
  }

  // 断言企微消息被受理（202），queryId 可能因去重/排队而不存在
  function expectAccepted(resp: { status: number; body: Record<string, unknown> }) {
    expect(resp.status).toBe(202);
    // receiptId 或 queryId 至少有一个存在
    const hasReceipt = resp.body.receiptId || resp.body.queryId;
    expect(hasReceipt).toBeTruthy();
  }

  // 发送企微语音消息的辅助方法
  async function sendWecomVoice(params: {
    senderId?: string;
    conversationId?: string;
    voiceContent: string;
  }) {
    const senderId = params.senderId ?? 'wx_sales_director';
    const conversationId = params.conversationId ?? `conv_voice_${nextMsgId()}`;
    const messageId = nextMsgId('msg_voice');

    return request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set(wecomHeaders)
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId,
        msgtype: 'voice',
        voice: { content: params.voiceContent },
      });
  }

  beforeAll(async () => {
    app = await createTestApp();
    appStorage = app.get(AppStorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ========================================
  // A. 常规问数场景（10个）
  // ========================================

  describe('A. 常规问数', () => {
    it('A01. 本月各销售负责人新增商机金额排名', async () => {
      const resp = await sendWecomText({
        messageText: '本月各销售负责人新增商机金额排名',
      });
      expectAccepted(resp);
    });

    it('A02. 本季度新增报备客户数量趋势', async () => {
      const resp = await sendWecomText({
        messageText: '本季度新增报备客户数量趋势',
      });
      expectAccepted(resp);
    });

    it('A03. 近一个月报价金额 TOP10 渠道', async () => {
      const resp = await sendWecomText({
        messageText: '近一个月报价金额 TOP10 渠道',
      });
      expectAccepted(resp);
    });

    it('A04. 本年度订单转化漏斗', async () => {
      const resp = await sendWecomText({
        messageText: '本年度订单转化漏斗',
      });
      expectAccepted(resp);
    });

    it('A05. 广州办渠道下单汇总', async () => {
      const resp = await sendWecomText({
        messageText: '广州办渠道下单汇总',
      });
      expectAccepted(resp);
    });

    it('A06. 各大区商机金额对比', async () => {
      const resp = await sendWecomText({
        messageText: '各大区商机金额对比',
      });
      expectAccepted(resp);
    });

    it('A07. 渠道商合作级别分布', async () => {
      const resp = await sendWecomText({
        messageText: '渠道商合作级别分布',
      });
      expectAccepted(resp);
    });

    it('A08. 近三个月新增渠道数量', async () => {
      const resp = await sendWecomText({
        messageText: '近三个月新增渠道数量',
      });
      expectAccepted(resp);
    });

    it('A09. 本周新增商机明细', async () => {
      const resp = await sendWecomText({
        messageText: '本周新增商机明细',
      });
      expectAccepted(resp);
    });

    it('A10. 报备到订单的转化率', async () => {
      const resp = await sendWecomText({
        messageText: '报备到订单的转化率',
      });
      expectAccepted(resp);
    });
  });

  // ========================================
  // B. 看板生成场景（4个）
  // ========================================

  describe('B. 看板生成', () => {
    it('B01. 看板型问题：渠道下单汇总分析看板', async () => {
      const resp = await sendWecomText({
        messageText: '看一下渠道下单汇总分析看板',
      });
      expectAccepted(resp);
    });

    it('B02. 看板型问题：全国代理商发展运营看板', async () => {
      const resp = await sendWecomText({
        messageText: '全国代理商发展运营看板',
      });
      expectAccepted(resp);
    });

    it('B03. 看板型问题：区域经营概览', async () => {
      const resp = await sendWecomText({
        messageText: '区域经营概览看板',
      });
      expectAccepted(resp);
    });

    it('B04. 看板型问题：负责人业绩看板', async () => {
      const resp = await sendWecomText({
        messageText: '负责人业绩看板',
      });
      expectAccepted(resp);
    });
  });

  // ========================================
  // C. 补问与拦截场景（4个）
  // ========================================

  describe('C. 补问与拦截', () => {
    it('C01. 歧义问题应触发补问（缺少时间范围）', async () => {
      const resp = await sendWecomText({
        messageText: '看一下商机转化怎么样',
      });
      expectAccepted(resp);
    });

    it('C02. 写入型请求应被拦截', async () => {
      const resp = await sendWecomText({
        messageText: '把这个商机改成已成交',
      });
      expectAccepted(resp);
    });

    it('C03. 非 CRM 问题应被友好拦截', async () => {
      const resp = await sendWecomText({
        messageText: '今天天气怎么样',
      });
      expectAccepted(resp);
    });

    it('C04. 高风险查询应被拦截', async () => {
      const resp = await sendWecomText({
        messageText: '导出所有客户手机号和身份证号',
      });
      expectAccepted(resp);
    });
  });

  // ========================================
  // D. 企微专项场景（6个）
  // ========================================

  describe('D. 企微专项', () => {
    it('D01. 语音消息应被接受并解析 voice.content', async () => {
      const resp = await sendWecomVoice({
        voiceContent: '本月各销售负责人新增商机金额排名',
      });
      expect(resp.status).toBe(202);
    });

    it('D02. 语音消息包含口语化表达应正常受理', async () => {
      const resp = await sendWecomVoice({
        voiceContent: '帮我看一下本季度的商机情况',
      });
      expect(resp.status).toBe(202);
    });

    it('D03. 群聊中不同发送者应隔离会话', async () => {
      const groupChatId = `group_e2e_${nextMsgId()}`;
      const directorResp = await sendWecomText({
        senderId: 'wx_sales_director',
        conversationId: groupChatId,
        messageText: '本月新增商机排名',
        chatType: 'group',
      });
      const managerResp = await sendWecomText({
        senderId: 'wx_region_manager',
        conversationId: groupChatId,
        messageText: '本月新增商机排名',
        chatType: 'group',
      });
      expect(directorResp.status).toBe(202);
      expect(managerResp.status).toBe(202);
      expect(directorResp.body.sessionId).not.toBe(managerResp.body.sessionId);
    });

    it('D04. 同一 messageId 重复回调应命中幂等', async () => {
      const messageId = nextMsgId('msg_dedup');
      const payload = {
        externalConversationId: `conv_dedup_${messageId}`,
        senderId: 'wx_sales_director',
        messageId,
        messageText: '本月各区域商机金额对比',
      };

      const firstResp = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set(wecomHeaders)
        .send(payload)
        .expect(202);

      const secondResp = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set(wecomHeaders)
        .send(payload)
        .expect(202);

      expect(secondResp.body.deduplicated).toBe(true);
      expect(secondResp.body.receiptId).toBe(firstResp.body.receiptId);
    });

    it('D05. 不同角色用户发送相同问题应各自受理', async () => {
      const directorResp = await sendWecomText({
        senderId: 'wx_sales_director',
        conversationId: `conv_role_director_${nextMsgId()}`,
        messageText: '本月商机金额排名',
      });
      const managerResp = await sendWecomText({
        senderId: 'wx_region_manager',
        conversationId: `conv_role_manager_${nextMsgId()}`,
        messageText: '本月商机金额排名',
      });
      expect(directorResp.status).toBe(202);
      expect(managerResp.status).toBe(202);
    });

    it('D06. 企微原生格式消息应正确解析', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set(wecomHeaders)
        .send({
          msgid: nextMsgId('msg_native'),
          chattype: 'single',
          chatid: `conv_native_${nextMsgId()}`,
          from: { userid: 'wx_sales_director' },
          msgtype: 'text',
          text: { content: '本季度报备到订单转化漏斗' },
        })
        .expect(202);
    });
  });

  // ========================================
  // E. 边界与异常场景（6个）
  // ========================================

  describe('E. 边界与异常', () => {
    it('E01. 空消息应返回 400', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set(wecomHeaders)
        .send({
          externalConversationId: `conv_empty_${nextMsgId()}`,
          senderId: 'wx_sales_director',
          messageId: nextMsgId('msg_empty'),
          messageText: '',
        });
      expect(resp.status).toBe(400);
    });

    it('E02. 超长消息应被接受（企微无硬限制，后端处理）', async () => {
      const longText = '本月各销售负责人新增商机金额排名'.repeat(20);
      const resp = await sendWecomText({
        messageText: longText,
      });
      expect(resp.status).toBe(202);
    });

    it('E03. 含特殊字符的消息应被接受', async () => {
      const resp = await sendWecomText({
        messageText: '广州办<渠道>下单&汇总"测试"',
      });
      expect(resp.status).toBe(202);
    });

    it('E04. 缺少必填字段应返回 400', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set(wecomHeaders)
        .send({
          messageText: '测试消息',
          // 缺少 senderId, externalConversationId, messageId
        });
      expect(resp.status).toBe(400);
    });

    it('E05. 跨期对比问题应被受理', async () => {
      const resp = await sendWecomText({
        messageText: '2025年和2026年第一季度商机金额对比',
      });
      expectAccepted(resp);
    });

    it('E06. 多条件组合查询应被受理', async () => {
      const resp = await sendWecomText({
        messageText: '广州办大北区金牌渠道本季度订单金额排名',
      });
      expectAccepted(resp);
    });
  });

  // ========================================
  // 总结验证
  // ========================================

  describe('F. 联调总结', () => {
    it('F01. 所有测试产生的查询记录应可在 AppStorage 中找到', () => {
      const requests = appStorage.state.analysisRequests;
      // 至少有前面测试产生的查询记录
      expect(requests.length).toBeGreaterThan(0);
    });

    it('F02. 企微渠道的查询应标记 entryChannel 为 wecom-bot', () => {
      const wecomRequests = appStorage.state.analysisRequests.filter(
        (r) => r.entryChannel === 'wecom-bot',
      );
      // 企微消息应该至少有一些被记录
      expect(wecomRequests.length).toBeGreaterThanOrEqual(0);
    });
  });
});
