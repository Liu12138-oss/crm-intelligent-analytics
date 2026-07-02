import { Injectable } from '@nestjs/common';
import type {
  CrmEntityAssistUser,
  CrmUser,
  FollowUpLoggableType,
} from '../../shared/types/domain';
import { CrmCustomerApiService } from './crm-customer-api.service';
import { CrmOpportunityApiService } from './crm-opportunity-api.service';

export interface FollowUpAuthorizationTargetSnapshot {
  objectType: FollowUpLoggableType;
  objectId: string;
  objectTitle: string;
  customerName?: string;
  ownerId: string;
  ownerName?: string;
  assistUserIds: string[];
  assistUserNames: string[];
  assistUsersResolved: boolean;
}

@Injectable()
export class FollowUpAuthorizationTargetService {
  constructor(
    private readonly crmCustomerApiService: CrmCustomerApiService,
    private readonly crmOpportunityApiService: CrmOpportunityApiService,
  ) {}

  /**
   * 解析目标对象当前的负责人和协作人集合，供对象级授权统一复用。
   * 参数：当前操作者、对象类型、对象 ID、可选 access token 与兜底标题。
   * 返回：授权快照；对象不存在时返回 undefined。
   */
  async resolve(params: {
    user: CrmUser;
    objectType: FollowUpLoggableType;
    objectId: string;
    fallbackTitle?: string;
    accessToken?: string;
  }): Promise<FollowUpAuthorizationTargetSnapshot | undefined> {
    if (params.objectType === 'Customer') {
      const customer = await this.crmCustomerApiService.getById(
        params.user,
        params.objectId,
        {
          accessToken: params.accessToken,
        },
      );
      if (!customer) {
        return undefined;
      }

      const assistUsers = await this.resolveAssistUsersSafely(async () => {
        return await this.crmCustomerApiService.getAssistUsersById(
          params.user,
          params.objectId,
          {
            accessToken: params.accessToken,
          },
        );
      });

      return {
        objectType: 'Customer',
        objectId: customer.id,
        objectTitle: customer.name ?? params.fallbackTitle ?? customer.id,
        customerName: customer.name,
        ownerId: customer.ownerId,
        ownerName: customer.ownerName,
        assistUserIds: assistUsers.users.map((item) => item.id),
        assistUserNames: assistUsers.users.map((item) => item.name),
        assistUsersResolved: assistUsers.resolved,
      };
    }

    const opportunity = await this.crmOpportunityApiService.getById(
      params.user,
      params.objectId,
      {
        accessToken: params.accessToken,
      },
    );
    if (!opportunity) {
      return undefined;
    }

    const assistUsers = await this.resolveAssistUsersSafely(async () => {
      return await this.crmOpportunityApiService.getAssistUsersById(
        params.user,
        params.objectId,
        {
          accessToken: params.accessToken,
        },
      );
    });

    return {
      objectType: 'Opportunity',
      objectId: opportunity.id,
      objectTitle: opportunity.title ?? params.fallbackTitle ?? opportunity.id,
      customerName: opportunity.customerName,
      ownerId: opportunity.ownerId,
      ownerName: opportunity.ownerName,
      assistUserIds: assistUsers.users.map((item) => item.id),
      assistUserNames: assistUsers.users.map((item) => item.name),
      assistUsersResolved: assistUsers.resolved,
    };
  }

  /**
   * 在草稿创建阶段仅补齐协作人集合，避免重复覆盖当前查询链路已经拿到的负责人快照。
   * 参数：当前操作者、对象类型、对象 ID 与可选 access token。
   * 返回：协作人集合与是否成功解析。
   */
  async resolveAssistUsers(params: {
    user: CrmUser;
    objectType: FollowUpLoggableType;
    objectId: string;
    accessToken?: string;
  }): Promise<{
    assistUserIds: string[];
    assistUserNames: string[];
    assistUsersResolved: boolean;
  }> {
    if (params.objectType === 'Customer') {
      const assistUsers = await this.resolveAssistUsersSafely(async () => {
        return await this.crmCustomerApiService.getAssistUsersById(
          params.user,
          params.objectId,
          {
            accessToken: params.accessToken,
          },
        );
      });

      return {
        assistUserIds: assistUsers.users.map((item) => item.id),
        assistUserNames: assistUsers.users.map((item) => item.name),
        assistUsersResolved: assistUsers.resolved,
      };
    }

    const assistUsers = await this.resolveAssistUsersSafely(async () => {
      return await this.crmOpportunityApiService.getAssistUsersById(
        params.user,
        params.objectId,
        {
          accessToken: params.accessToken,
        },
      );
    });

    return {
      assistUserIds: assistUsers.users.map((item) => item.id),
      assistUserNames: assistUsers.users.map((item) => item.name),
      assistUsersResolved: assistUsers.resolved,
    };
  }

  /**
   * 协作人读取失败时按“事实未确认”返回，由授权层统一决定阻断，而不是在这里抛出未分类异常。
   * 参数：实际协作人读取器。
   * 返回：协作人列表与是否成功解析的标记。
   */
  private async resolveAssistUsersSafely(
    executor: () => Promise<CrmEntityAssistUser[]>,
  ): Promise<{ users: CrmEntityAssistUser[]; resolved: boolean }> {
    try {
      return {
        users: this.uniqueAssistUsers(await executor()),
        resolved: true,
      };
    } catch {
      return {
        users: [],
        resolved: false,
      };
    }
  }

  /** 协作人集合按用户 ID 去重，避免同一对象重复返回同一成员。 */
  private uniqueAssistUsers(users: CrmEntityAssistUser[]): CrmEntityAssistUser[] {
    const seenIds = new Set<string>();
    const result: CrmEntityAssistUser[] = [];

    for (const user of users) {
      const normalizedId = user.id.trim();
      if (!normalizedId || seenIds.has(normalizedId)) {
        continue;
      }

      seenIds.add(normalizedId);
      result.push({
        id: normalizedId,
        name: user.name.trim() || normalizedId,
      });
    }

    return result;
  }
}
