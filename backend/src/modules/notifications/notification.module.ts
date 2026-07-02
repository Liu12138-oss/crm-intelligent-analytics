import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { WecomTransportService } from '../wecom/wecom-transport.service';
import { ProactiveNotificationRepository } from './proactive-notification.repository';
import { ProactiveNotificationService } from './proactive-notification.service';
import { WecomAppMessageService } from './wecom-app-message.service';
import { WecomBotNotificationService } from './wecom-bot-notification.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    ProactiveNotificationRepository,
    WecomTransportService,
    WecomAppMessageService,
    WecomBotNotificationService,
    ProactiveNotificationService,
    AuditEventRepository,
    UserScopeService,
  ],
  exports: [ProactiveNotificationService, WecomTransportService],
})
export class NotificationModule {}
