import { Injectable } from '@nestjs/common';

@Injectable()
export class AiCapabilityPackRolloutPolicy {
  private readonly disabledPackCodes = new Set<string>();

  static fromDisabledPackCodes(
    disabledPackCodes: string[],
  ): AiCapabilityPackRolloutPolicy {
    const policy = new AiCapabilityPackRolloutPolicy();
    for (const packCode of disabledPackCodes) {
      const normalizedPackCode = packCode.trim();
      if (normalizedPackCode) {
        policy.disabledPackCodes.add(normalizedPackCode);
      }
    }
    return policy;
  }

  isEnabled(packCode: string): boolean {
    return !this.getDisabledPackCodes().has(packCode.trim());
  }

  private getDisabledPackCodes(): Set<string> {
    const disabledPackCodes = new Set(
      [...this.disabledPackCodes],
    );
    const envValue = process.env.AI_CAPABILITY_DISABLED_PACKS ?? '';
    for (const packCode of envValue.split(',')) {
      const normalizedPackCode = packCode.trim();
      if (normalizedPackCode) {
        disabledPackCodes.add(normalizedPackCode);
      }
    }

    return disabledPackCodes;
  }
}
