import { AiSecretCryptoService } from '../../../src/modules/ai-models/ai-secret-crypto.service';

describe('AiSecretCryptoService', () => {
  it('应能加密并解密密钥，且密文不应包含原文', () => {
    const service = new AiSecretCryptoService({
      getRepoRoot: jest.fn().mockReturnValue('D:\\code\\CRM'),
    } as never);

    const ciphertext = service.encrypt('secret-token');
    const plaintext = service.decrypt(ciphertext);

    expect(ciphertext).not.toContain('secret-token');
    expect(plaintext).toBe('secret-token');
  });
});
