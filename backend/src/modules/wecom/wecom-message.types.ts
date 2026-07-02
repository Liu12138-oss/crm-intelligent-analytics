import type {
  StreamBlock,
  WecomInboundMessage,
  WecomDeliveryRecord,
  WecomDeliveryStatus,
} from '../../shared/types/domain';

export interface WecomDeliveryTarget {
  chatType: WecomInboundMessage['chatType'];
  deliveryTargetId: string;
  senderId: string;
  externalConversationId: string;
  replyFrameHeaders?: WecomInboundMessage['replyFrameHeaders'];
  streamId?: string;
}

export interface WecomDispatchImageAttachment {
  sequence: number;
  filename: string;
  buffer: Buffer;
  contentPreview: string;
}

export interface WecomDispatchTemplateCard {
  sequence: number;
  templateCard: Record<string, unknown>;
  contentPreview: string;
}

export interface WecomDispatchEnvelope {
  receiptId: string;
  sessionId: string;
  queryId?: string;
  target: WecomDeliveryTarget;
  blocks: StreamBlock[];
  imageAttachments?: WecomDispatchImageAttachment[];
  templateCards?: WecomDispatchTemplateCard[];
  finalize?: boolean;
}

export interface WecomDispatchResult {
  status: WecomDeliveryStatus;
  deliveredCount: number;
  failedCount: number;
  records: WecomDeliveryRecord[];
}

export interface WecomInboundEnvelope {
  signature?: string;
  source?: string;
  body: Record<string, unknown>;
}

export interface WecomFollowUpWritebackPayload {
  id: string;
  objectType: 'Opportunity' | 'Customer';
  objectId: string;
  objectTitle: string;
  customerName?: string;
  draftContent: string;
  status:
    | 'DRAFTED'
    | 'AWAITING_CONTENT_CONFIRMATION'
    | 'FAILED'
    | 'COMPLETED'
    | 'CANCELLED';
  failureReason?: string;
  externalRevisitLogId?: string;
  writtenAt?: string;
}

export interface WecomCrmCreatePayload {
  entityType: 'Customer' | 'Opportunity';
  status: 'COLLECTING' | 'AWAITING_CONFIRMATION' | 'FAILED' | 'COMPLETED';
  title: string;
  resultId?: string;
  failureReason?: string;
}

export interface WecomReceiveMessageResult {
  receiptId: string;
  sessionId?: string;
  queryId?: string;
  status: string;
  acceptedAt: string;
  deduplicated?: boolean;
  queueNotice?: string;
  clarificationPrompt?: string;
  deliveryStatus?: WecomDeliveryStatus;
  deliveredBlockCount?: number;
  followUpWriteback?: WecomFollowUpWritebackPayload;
  crmCreate?: WecomCrmCreatePayload;
}
