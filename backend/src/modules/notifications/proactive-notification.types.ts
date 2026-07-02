import type {
  CrmUser,
  ProactiveNotificationChannel,
  ProactiveNotificationKind,
  ProactiveNotificationTaskRecord,
  WecomChatType,
} from '../../shared/types/domain';

export type ProactiveNotificationAudience =
  | {
      type: 'CRM_USER';
      crmUserIds: string[];
    }
  | {
      type: 'WECOM_USER';
      wecomUserIds: string[];
    }
  | {
      type: 'WECOM_PARTY';
      partyIds: string[];
    }
  | {
      type: 'WECOM_TAG';
      tagIds: string[];
    }
  | {
      type: 'WECOM_CONVERSATION';
      deliveryTargetId: string;
      chatType: WecomChatType;
      senderId: string;
      externalConversationId: string;
      displayName?: string;
    };

export type ProactiveNotificationMessage =
  | {
      msgtype: 'markdown';
      content: string;
    }
  | {
      msgtype: 'template_card';
      payload: Record<string, unknown>;
    };

export interface ProactiveNotificationRecipientGuardResult {
  allowed: boolean;
  reason?: string;
}

export type ProactiveNotificationRecipientGuard = (params: {
  recipient?: CrmUser;
  audience: ProactiveNotificationAudience;
}) => ProactiveNotificationRecipientGuardResult;

export interface DispatchProactiveNotificationInput {
  actor: CrmUser;
  sceneKey: string;
  title: string;
  kind?: ProactiveNotificationKind;
  preferredChannel?: ProactiveNotificationChannel;
  audience: ProactiveNotificationAudience;
  message: ProactiveNotificationMessage;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  recipientGuard?: ProactiveNotificationRecipientGuard;
}

export interface ProactiveNotificationChannelSendResult {
  status: 'SENT' | 'FAILED';
  externalMessageId?: string;
  externalErrorCode?: string;
  externalErrorMessage?: string;
  retryStrategy?: 'NONE' | 'STANDARD_RETRY' | 'RATE_LIMIT_BACKOFF';
  retryAfterMs?: number;
  invalidUserIds?: string[];
  invalidPartyIds?: string[];
  invalidTagIds?: string[];
  failureReason?: string;
}

export type DispatchProactiveNotificationResult = ProactiveNotificationTaskRecord;
