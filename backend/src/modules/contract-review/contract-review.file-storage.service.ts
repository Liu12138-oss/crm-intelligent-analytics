import { Injectable } from '@nestjs/common';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { ContractReviewConfigService } from './contract-review.config';
import type { UploadedContractFile } from './contract-review.types';

@Injectable()
export class ContractReviewFileStorageService {
  constructor(private readonly configService: ContractReviewConfigService) {}

  async saveSourceFile(taskId: string, file: UploadedContractFile): Promise<string> {
    const taskDir = await this.ensureTaskDirectory(taskId);
    const filePath = join(taskDir, `source-${basename(file.originalname)}`);
    await writeFile(filePath, file.buffer);
    return filePath;
  }

  async saveTextArtifact(
    taskId: string,
    fileName: string,
    content: string,
  ): Promise<string> {
    const taskDir = await this.ensureTaskDirectory(taskId);
    const filePath = join(taskDir, fileName);
    await writeFile(filePath, content, 'utf8');
    return filePath;
  }

  async saveBinaryArtifact(
    taskId: string,
    fileName: string,
    content: Buffer,
  ): Promise<string> {
    const taskDir = await this.ensureTaskDirectory(taskId);
    const filePath = join(taskDir, fileName);
    await writeFile(filePath, content);
    return filePath;
  }

  async copyArtifactFromSource(
    taskId: string,
    fileName: string,
    sourceFilePath: string,
  ): Promise<string> {
    const taskDir = await this.ensureTaskDirectory(taskId);
    const filePath = join(taskDir, fileName);
    await copyFile(sourceFilePath, filePath);
    return filePath;
  }

  private async ensureTaskDirectory(taskId: string): Promise<string> {
    const taskDir = join(this.configService.getStorageRoot(), taskId);
    await mkdir(taskDir, { recursive: true });
    return taskDir;
  }
}
