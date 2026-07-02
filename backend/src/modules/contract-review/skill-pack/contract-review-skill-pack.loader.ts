import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { ContractReviewConfigService } from '../contract-review.config';
import type {
  ContractReviewSkillPack,
  ContractReviewSkillPackFileSet,
} from './contract-review-skill-pack.types';
import { ContractReviewSkillPackValidator } from './contract-review-skill-pack.validator';

@Injectable()
export class ContractReviewSkillPackLoader {
  constructor(
    private readonly configService: ContractReviewConfigService,
    private readonly validator: ContractReviewSkillPackValidator,
  ) {}

  loadActivePack(): ContractReviewSkillPack {
    return this.loadPack(this.configService.getActiveSkillPackCode());
  }

  loadPack(packCode: string): ContractReviewSkillPack {
    const packRootDir = this.resolvePackDirectory(packCode);
    const profilePath = this.resolvePackFilePath(packRootDir, 'profile.yaml', 'profile.yaml');
    const profileRaw = this.readUtf8File(profilePath, 'profile.yaml');
    const profile = this.validator.validateProfile(
      this.parseProfileYaml(profileRaw, profilePath),
      profilePath,
    );

    const files: ContractReviewSkillPackFileSet = {
      profile: profilePath,
      requirements: this.resolvePackFilePath(
        packRootDir,
        profile.requirementsFile,
        'requirements',
      ),
      workflow: this.resolvePackFilePath(packRootDir, profile.workflowFile, 'workflow'),
      checks: this.resolvePackFilePath(packRootDir, profile.checksFile, 'checks'),
      plannerPrompt: this.resolvePackFilePath(
        packRootDir,
        profile.plannerPromptFile,
        'planner prompt',
      ),
      reviewerPrompt: this.resolvePackFilePath(
        packRootDir,
        profile.reviewerPromptFile,
        'reviewer prompt',
      ),
      summarizerPrompt: this.resolvePackFilePath(
        packRootDir,
        profile.summarizerPromptFile,
        'summarizer prompt',
      ),
    };

    const requirements = this.readUtf8File(files.requirements, 'requirements');
    const workflow = this.readUtf8File(files.workflow, 'workflow');
    const plannerPrompt = this.readUtf8File(files.plannerPrompt, 'planner prompt');
    const reviewerPrompt = this.readUtf8File(files.reviewerPrompt, 'reviewer prompt');
    const summarizerPrompt = this.readUtf8File(
      files.summarizerPrompt,
      'summarizer prompt',
    );
    const checksRaw = this.readUtf8File(files.checks, 'checks');

    this.validator.validateTextAsset('requirements', requirements, files.requirements);
    this.validator.validateTextAsset('workflow', workflow, files.workflow);
    this.validator.validateTextAsset('planner prompt', plannerPrompt, files.plannerPrompt);
    this.validator.validateTextAsset('reviewer prompt', reviewerPrompt, files.reviewerPrompt);
    this.validator.validateTextAsset(
      'summarizer prompt',
      summarizerPrompt,
      files.summarizerPrompt,
    );

    let checksPayload: unknown;
    try {
      checksPayload = JSON.parse(checksRaw) as unknown;
    } catch (error) {
      throw new Error(
        `合同审核 skill pack checks 解析失败（${files.checks}）：${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    const checks = this.validator.validateChecks(checksPayload, files.checks);
    const checksum = this.computeChecksum([
      profileRaw,
      requirements,
      workflow,
      plannerPrompt,
      reviewerPrompt,
      summarizerPrompt,
      checksRaw,
    ]);

    const pack: ContractReviewSkillPack = {
      rootDir: packRootDir,
      files,
      code: profile.code,
      version: profile.version,
      title: profile.title,
      summary: profile.summary,
      issuedAt: profile.issuedAt,
      requirements,
      workflow,
      prompts: {
        planner: plannerPrompt,
        reviewer: reviewerPrompt,
        summarizer: summarizerPrompt,
      },
      checks,
      defaultExecutionMode: profile.defaultExecutionMode,
      defaultModelProfile: profile.defaultModelProfile,
      applicableContractTypes: [...profile.applicableContractTypes],
      deterministicValidators: [...profile.deterministicValidators],
      checksum,
      checksumSummary: checksum.slice(0, 12),
    };

    this.validator.validatePack(pack);
    return pack;
  }

  private resolvePackDirectory(packCode: string): string {
    const packRoot = this.configService.getSkillPackRootDir();
    const packDirectory = resolve(packRoot, packCode);
    if (!existsSync(packDirectory)) {
      throw new Error(`未找到激活的合同审核 skill pack 目录：${packDirectory}`);
    }

    return packDirectory;
  }

  private resolvePackFilePath(
    packRootDir: string,
    relativePath: string,
    label: string,
  ): string {
    const packRoot = resolve(packRootDir);
    const resolvedPath = resolve(packRootDir, relativePath);
    const pathFromRoot = relative(packRoot, resolvedPath);

    // 使用相对路径判断是否越界，避免仅按 Windows 反斜杠判断导致 Linux 误报。
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      throw new Error(`合同审核 skill pack ${label} 路径越界：${relativePath}`);
    }

    if (!existsSync(resolvedPath)) {
      throw new Error(`合同审核 skill pack ${label} 文件不存在：${resolvedPath}`);
    }

    return resolvedPath;
  }

  private readUtf8File(filePath: string, label: string): string {
    try {
      return readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(
        `读取合同审核 skill pack ${label} 失败（${filePath}）：${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  private computeChecksum(contents: string[]): string {
    const hash = createHash('sha256');
    for (const content of contents) {
      hash.update(content);
      hash.update('\n---\n');
    }

    return hash.digest('hex');
  }

  private parseProfileYaml(
    rawContent: string,
    filePath: string,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = rawContent.split(/\r?\n/);
    let index = 0;

    // 一期只支持顶层键值和字符串数组，避免为单个 profile.yaml 引入额外 YAML 依赖。
    while (index < lines.length) {
      const rawLine = lines[index];
      const trimmedLine = rawLine.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        index += 1;
        continue;
      }

      if (/^\s/.test(rawLine)) {
        throw new Error(
          `合同审核 skill pack profile 格式非法（${filePath}）：仅支持顶层字段，出错行：${rawLine}`,
        );
      }

      const matched = trimmedLine.match(/^([A-Za-z0-9_.-]+):(?:\s*(.+))?$/);
      if (!matched) {
        throw new Error(
          `合同审核 skill pack profile 格式非法（${filePath}）：无法解析行：${rawLine}`,
        );
      }

      const key = matched[1];
      const scalarValue = matched[2]?.trim();

      if (scalarValue) {
        result[key] = this.parseProfileScalar(scalarValue);
        index += 1;
        continue;
      }

      const listValues: string[] = [];
      index += 1;
      while (index < lines.length) {
        const childRawLine = lines[index];
        const childTrimmedLine = childRawLine.trim();

        if (!childTrimmedLine || childTrimmedLine.startsWith('#')) {
          index += 1;
          continue;
        }

        if (!/^\s/.test(childRawLine)) {
          break;
        }

        const itemMatch = childTrimmedLine.match(/^-\s+(.+)$/);
        if (!itemMatch) {
          throw new Error(
            `合同审核 skill pack profile 数组格式非法（${filePath}）：无法解析行：${childRawLine}`,
          );
        }

        listValues.push(String(this.parseProfileScalar(itemMatch[1].trim())));
        index += 1;
      }

      result[key] = listValues;
    }

    return result;
  }

  private parseProfileScalar(rawValue: string): string | boolean {
    if (rawValue === 'true') {
      return true;
    }

    if (rawValue === 'false') {
      return false;
    }

    const doubleQuoted = rawValue.match(/^"(.*)"$/);
    if (doubleQuoted) {
      return doubleQuoted[1];
    }

    const singleQuoted = rawValue.match(/^'(.*)'$/);
    if (singleQuoted) {
      return singleQuoted[1];
    }

    return rawValue;
  }
}
