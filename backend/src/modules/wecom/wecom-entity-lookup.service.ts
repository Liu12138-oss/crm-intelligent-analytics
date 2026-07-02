import { Injectable } from '@nestjs/common';
import type { WecomEntityLookupMemory } from '../../shared/types/domain';
import {
  CrmCustomerApiService,
  type CustomerLookupRecord,
} from '../opportunities/crm-customer-api.service';
import {
  CrmOpportunityApiService,
  type OpportunityLookupRecord,
} from '../opportunities/crm-opportunity-api.service';
import type { CrmUser } from '../../shared/types/domain';
import {
  buildCustomerDetailReply,
  buildCustomerListItems,
  buildEntityLookupClarificationReply,
  buildEntityLookupListReply,
  buildOpportunityDetailReply,
  buildOpportunityListItems,
} from './wecom-entity-lookup.helper';

export interface WecomEntityLookupExecuteParams {
  user: CrmUser;
  accessToken?: string;
  entityLookupAction: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
  entityType: 'Customer' | 'Opportunity' | 'Unknown';
  queryText?: string;
  selectionIndex?: number;
  memory?: WecomEntityLookupMemory;
}

export interface WecomEntityLookupExecuteResult {
  status: 'LIST_RETURNED' | 'DETAIL_RETURNED' | 'CLARIFICATION_REQUIRED';
  replyText: string;
  listItems: WecomEntityLookupMemory['listItems'];
  selectedItemId?: string;
}

@Injectable()
export class WecomEntityLookupService {
  constructor(
    private readonly customerLookupService: CrmCustomerApiService,
    private readonly opportunityLookupService: CrmOpportunityApiService,
  ) {}

  /**
   * 统一执行企业微信客户/商机列表与详情查询。
   * 参数：当前用户、AI 输出动作、对象类型、查询词、上一轮列表态。
   * 返回：列表态、详情态或澄清态的统一结果。
   */
  async execute(
    params: WecomEntityLookupExecuteParams,
  ): Promise<WecomEntityLookupExecuteResult> {
    if (params.entityLookupAction === 'LIST') {
      return await this.handleList(params);
    }
    if (params.entityLookupAction === 'DETAIL') {
      return await this.handleDetail(params);
    }

    return await this.handleSelectFromLastList(params);
  }

  private async handleList(
    params: WecomEntityLookupExecuteParams,
  ): Promise<WecomEntityLookupExecuteResult> {
    if (params.entityType === 'Unknown') {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          reason: 'MISSING_ENTITY_TYPE',
        }),
        listItems: [],
      };
    }
    if (!params.queryText?.trim()) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: params.entityType,
          reason: 'MISSING_QUERY',
        }),
        listItems: [],
      };
    }

    if (params.entityType === 'Customer') {
      const result = await this.customerLookupService.lookupByName(
        params.user,
        params.queryText,
        {
          limit: 10,
          accessToken: params.accessToken,
          restrictToOwnerOrCollaborator: true,
        },
      );
      const listItems = buildCustomerListItems(result.records);
      if (listItems.length === 0) {
        return {
          status: 'CLARIFICATION_REQUIRED',
          replyText: buildEntityLookupClarificationReply({
            entityType: 'Customer',
            reason: 'NO_RESULTS',
          }),
          listItems: [],
        };
      }

      return {
        status: 'LIST_RETURNED',
        replyText: buildEntityLookupListReply({
          entityType: 'Customer',
          totalCount: result.totalCount,
          items: listItems,
        }),
        listItems,
      };
    }

    const result = await this.opportunityLookupService.lookupByCompanyName(
      params.user,
      params.queryText,
      {
        limit: 10,
        accessToken: params.accessToken,
        restrictToOwnerOrCollaborator: true,
      },
    );
    const listItems = buildOpportunityListItems(result.records);
    if (listItems.length === 0) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: 'Opportunity',
          reason: 'NO_RESULTS',
        }),
        listItems: [],
      };
    }

    return {
      status: 'LIST_RETURNED',
      replyText: buildEntityLookupListReply({
        entityType: 'Opportunity',
        totalCount: result.totalCount,
        items: listItems,
      }),
      listItems,
    };
  }

  private async handleDetail(
    params: WecomEntityLookupExecuteParams,
  ): Promise<WecomEntityLookupExecuteResult> {
    if (params.entityType === 'Unknown') {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          reason: 'MISSING_ENTITY_TYPE',
        }),
        listItems: [],
      };
    }
    if (!params.queryText?.trim()) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: params.entityType,
          reason: 'MISSING_QUERY',
        }),
        listItems: [],
      };
    }

    if (params.entityType === 'Customer') {
      const result = await this.customerLookupService.lookupByName(
        params.user,
        params.queryText,
        {
          limit: 10,
          accessToken: params.accessToken,
          restrictToOwnerOrCollaborator: true,
        },
      );
      return await this.buildCustomerDetailOrListResult(params, result.records);
    }

    const result = await this.opportunityLookupService.lookupByCompanyName(
      params.user,
      params.queryText,
      {
        limit: 10,
        accessToken: params.accessToken,
        restrictToOwnerOrCollaborator: true,
      },
    );
    return await this.buildOpportunityDetailOrListResult(params, result.records);
  }

  private async handleSelectFromLastList(
    params: WecomEntityLookupExecuteParams,
  ): Promise<WecomEntityLookupExecuteResult> {
    const memory = params.memory;
    if (!memory || memory.mode !== 'LIST_RETURNED' || memory.listItems.length === 0) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          reason: 'MISSING_LIST_MEMORY',
        }),
        listItems: [],
      };
    }

    const selectionIndex = (params.selectionIndex ?? 0) - 1;
    const selectedItem = memory.listItems[selectionIndex];
    if (selectionIndex < 0 || !selectedItem) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: memory.entityType,
          reason: 'INVALID_SELECTION',
        }),
        listItems: memory.listItems,
      };
    }

    if (selectedItem.entityType === 'Customer') {
      const detail = await this.customerLookupService.getById(
        params.user,
        selectedItem.id,
        {
          accessToken: params.accessToken,
        },
      );
      if (!detail) {
        return {
          status: 'CLARIFICATION_REQUIRED',
          replyText: buildEntityLookupClarificationReply({
            entityType: 'Customer',
            reason: 'DETAIL_NOT_FOUND',
          }),
          listItems: memory.listItems,
        };
      }

      return {
        status: 'DETAIL_RETURNED',
        replyText: buildCustomerDetailReply(detail),
        listItems: memory.listItems,
        selectedItemId: detail.id,
      };
    }

    const detail = await this.opportunityLookupService.getById(
      params.user,
      selectedItem.id,
      {
        accessToken: params.accessToken,
      },
    );
    if (!detail) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: 'Opportunity',
          reason: 'DETAIL_NOT_FOUND',
        }),
        listItems: memory.listItems,
      };
    }

    return {
      status: 'DETAIL_RETURNED',
      replyText: buildOpportunityDetailReply(detail),
      listItems: memory.listItems,
      selectedItemId: detail.id,
    };
  }

  private async buildCustomerDetailOrListResult(
    params: WecomEntityLookupExecuteParams,
    records: CustomerLookupRecord[],
  ): Promise<WecomEntityLookupExecuteResult> {
    if (records.length === 0) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: 'Customer',
          reason: 'NO_RESULTS',
        }),
        listItems: [],
      };
    }
    if (records.length > 1) {
      const listItems = buildCustomerListItems(records);
      return {
        status: 'LIST_RETURNED',
        replyText: buildEntityLookupListReply({
          entityType: 'Customer',
          totalCount: records.length,
          items: listItems,
        }),
        listItems,
      };
    }

    const detail = await this.customerLookupService.getById(
      params.user,
      records[0].id,
      {
        accessToken: params.accessToken,
      },
    );
    if (!detail) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: 'Customer',
          reason: 'DETAIL_NOT_FOUND',
        }),
        listItems: [],
      };
    }

    return {
      status: 'DETAIL_RETURNED',
      replyText: buildCustomerDetailReply(detail),
      listItems: buildCustomerListItems(records),
      selectedItemId: detail.id,
    };
  }

  private async buildOpportunityDetailOrListResult(
    params: WecomEntityLookupExecuteParams,
    records: OpportunityLookupRecord[],
  ): Promise<WecomEntityLookupExecuteResult> {
    if (records.length === 0) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: 'Opportunity',
          reason: 'NO_RESULTS',
        }),
        listItems: [],
      };
    }
    if (records.length > 1) {
      const listItems = buildOpportunityListItems(records);
      return {
        status: 'LIST_RETURNED',
        replyText: buildEntityLookupListReply({
          entityType: 'Opportunity',
          totalCount: records.length,
          items: listItems,
        }),
        listItems,
      };
    }

    const detail = await this.opportunityLookupService.getById(
      params.user,
      records[0].id,
      {
        accessToken: params.accessToken,
      },
    );
    if (!detail) {
      return {
        status: 'CLARIFICATION_REQUIRED',
        replyText: buildEntityLookupClarificationReply({
          entityType: 'Opportunity',
          reason: 'DETAIL_NOT_FOUND',
        }),
        listItems: [],
      };
    }

    return {
      status: 'DETAIL_RETURNED',
      replyText: buildOpportunityDetailReply(detail),
      listItems: buildOpportunityListItems(records),
      selectedItemId: detail.id,
    };
  }
}
