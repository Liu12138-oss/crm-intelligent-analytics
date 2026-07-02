import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { SessionHeartbeatService } from '../sessions/session-heartbeat.service';
import { WecomBotService } from './wecom-bot.service';

@Controller('wecom')
export class WecomBotController {
  constructor(
    private readonly wecomBotService: WecomBotService,
    private readonly sessionHeartbeatService: SessionHeartbeatService,
  ) {}

  @Post('messages')
  @HttpCode(202)
  async receiveMessage(
    @Headers('x-wecom-signature') signature: string | undefined,
    @Headers('x-wecom-source') source: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return await this.wecomBotService.receiveMessage({
      signature,
      source,
      body,
    });
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.wecomBotService.getSession(sessionId);
  }

  @Get('messages/:messageId/receipt')
  getMessageReceipt(@Param('messageId') messageId: string) {
    return this.wecomBotService.getMessageReceipt(messageId);
  }

  @Post('sessions/:sessionId/heartbeat')
  @HttpCode(200)
  reportHeartbeat(
    @Param('sessionId') sessionId: string,
    @Body() body: { reportedAt: string },
  ) {
    const session = this.sessionHeartbeatService.reportHeartbeat(
      sessionId,
      body.reportedAt,
    );
    return {
      sessionId: session.id,
      status: session.contextStatus,
      receivedAt: new Date().toISOString(),
    };
  }
}
