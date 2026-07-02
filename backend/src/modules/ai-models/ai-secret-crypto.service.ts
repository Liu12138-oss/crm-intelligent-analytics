import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';

/**
 * 负责 AI Profile 密钥的加解密，避免把真实密钥明文落到应用存储中。
 */
@Injectable()
export class AiSecretCryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private readonly keyFilePath: string;

  constructor(
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: Pick<
      LocalRuntimeConfigService,
      'getRepoRoot'
    >,
  ) {
    this.keyFilePath = join(
      this.localRuntimeConfigService.getRepoRoot(),
      '.runtime',
      'ai-profile-master.key',
    );
  }

  /**
   * 将明文密钥加密为可持久化的密文字符串。
   */
  encrypt(plaintext: string): string {
    const key = this.resolveEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(AiSecretCryptoService.ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted]
      .map((buffer) => buffer.toString('base64'))
      .join('.');
  }

  /**
   * 将持久化密文解密回原始密钥，供运行时实际调用 SDK。
   */
  decrypt(ciphertext: string): string {
    const [ivPart, authTagPart, encryptedPart] = ciphertext.split('.');
    if (!ivPart || !authTagPart || !encryptedPart) {
      throw new Error('AI Profile 密文字段格式不合法。');
    }

    const key = this.resolveEncryptionKey();
    const decipher = createDecipheriv(
      AiSecretCryptoService.ALGORITHM,
      key,
      Buffer.from(ivPart, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagPart, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * 解析当前环境使用的主密钥。
   *
   * 规则：
   * 1. 优先读取环境变量；
   * 2. 测试环境使用基于仓库路径的稳定派生值，避免测试写盘；
   * 3. 其它环境在本地 `.runtime` 生成并复用主密钥文件。
   */
  private resolveEncryptionKey(): Buffer {
    const envKey = process.env.AI_PROFILE_MASTER_KEY?.trim();
    if (envKey) {
      return this.normalizeKeyMaterial(envKey);
    }

    if (process.env.NODE_ENV === 'test') {
      return this.normalizeKeyMaterial(
        `test:${this.localRuntimeConfigService.getRepoRoot()}`,
      );
    }

    if (existsSync(this.keyFilePath)) {
      return this.normalizeKeyMaterial(readFileSync(this.keyFilePath, 'utf8'));
    }

    const generatedKey = randomBytes(32).toString('hex');
    mkdirSync(dirname(this.keyFilePath), { recursive: true });
    writeFileSync(this.keyFilePath, generatedKey, 'utf8');
    return this.normalizeKeyMaterial(generatedKey);
  }

  /**
   * 将任意长度的原始主密钥归一化成 AES-256 所需的 32 字节长度。
   */
  private normalizeKeyMaterial(value: string): Buffer {
    return createHash('sha256').update(value.trim()).digest();
  }
}
