import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  ContractReviewArtifactRecord,
  ContractReviewIssueRecord,
  ContractReviewRuleSetRecord,
  ContractReviewTaskRecord,
  CrmUser,
} from '../../shared/types/domain';
import { ContractReviewSkillPackRuntimeService } from './skill-pack/contract-review-skill-pack.runtime.service';

@Injectable()
export class ContractReviewRepository {
  constructor(
    private readonly appStorage: AppStorageService,
    private readonly skillPackRuntimeService: ContractReviewSkillPackRuntimeService,
  ) {}

  listVisibleTasks(user: CrmUser, allowAllVisible = false): ContractReviewTaskRecord[] {
    return this.appStorage.state.contractReviewTasks
      .filter((task) => (allowAllVisible ? true : task.requesterId === user.id))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  findTaskById(taskId: string): ContractReviewTaskRecord | undefined {
    return this.appStorage.state.contractReviewTasks.find((task) => task.id === taskId);
  }

  saveTask(task: ContractReviewTaskRecord): ContractReviewTaskRecord {
    const currentIndex = this.appStorage.state.contractReviewTasks.findIndex(
      (item) => item.id === task.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.contractReviewTasks[currentIndex] = task;
      return task;
    }

    this.appStorage.state.contractReviewTasks.unshift(task);
    return task;
  }

  listIssuesByTaskId(taskId: string): ContractReviewIssueRecord[] {
    return this.appStorage.state.contractReviewIssues
      .filter((issue) => issue.taskId === taskId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  replaceIssues(taskId: string, issues: ContractReviewIssueRecord[]): ContractReviewIssueRecord[] {
    this.appStorage.state.contractReviewIssues = this.appStorage.state.contractReviewIssues.filter(
      (issue) => issue.taskId !== taskId,
    );
    this.appStorage.state.contractReviewIssues.push(...issues);
    return issues;
  }

  listArtifactsByTaskId(taskId: string): ContractReviewArtifactRecord[] {
    return this.appStorage.state.contractReviewArtifacts
      .filter((artifact) => artifact.taskId === taskId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  replaceArtifacts(
    taskId: string,
    artifacts: ContractReviewArtifactRecord[],
  ): ContractReviewArtifactRecord[] {
    this.appStorage.state.contractReviewArtifacts =
      this.appStorage.state.contractReviewArtifacts.filter(
        (artifact) => artifact.taskId !== taskId,
      );
    this.appStorage.state.contractReviewArtifacts.push(...artifacts);
    return artifacts;
  }

  findArtifactById(
    taskId: string,
    artifactId: string,
  ): ContractReviewArtifactRecord | undefined {
    return this.appStorage.state.contractReviewArtifacts.find(
      (artifact) => artifact.taskId === taskId && artifact.id === artifactId,
    );
  }

  getCurrentRuleSet(): ContractReviewRuleSetRecord {
    const activeRuleSet = this.skillPackRuntimeService.getActiveRuleSet();
    const existingRuleSet = this.appStorage.state.contractReviewRuleSets.find(
      (ruleSet) =>
        ruleSet.code === activeRuleSet.code && ruleSet.version === activeRuleSet.version,
    );

    if (existingRuleSet) {
      return existingRuleSet;
    }

    this.appStorage.state.contractReviewRuleSets.unshift(activeRuleSet);
    return this.appStorage.state.contractReviewRuleSets[0];
  }

  findRuleSetByCodeVersion(
    code: string,
    version: string,
  ): ContractReviewRuleSetRecord | undefined {
    const activeRuleSet = this.skillPackRuntimeService.getActiveRuleSet();
    if (activeRuleSet.code === code && activeRuleSet.version === version) {
      return this.getCurrentRuleSet();
    }

    return this.appStorage.state.contractReviewRuleSets.find(
      (ruleSet) => ruleSet.code === code && ruleSet.version === version,
    );
  }
}
