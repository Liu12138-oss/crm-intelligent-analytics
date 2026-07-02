import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/auth.controller.spec.ts',
    '<rootDir>/test/contract/ai-model-governance.contract-spec.ts',
    '<rootDir>/test/contract/wecom-bot.contract-spec.ts',
    '<rootDir>/test/cors-options.spec.ts',
    '<rootDir>/test/database/app-storage.service.spec.ts',
    '<rootDir>/test/local-runtime-config.service.spec.ts',
    '<rootDir>/test/modules/ai-models/**/*.spec.ts',
    '<rootDir>/test/modules/auth/**/*.spec.ts',
    '<rootDir>/test/modules/governance/access-decision.service.spec.ts',
    '<rootDir>/test/modules/governance/application-super-admin-policy.repository.spec.ts',
    '<rootDir>/test/modules/governance/feature-permission-catalog.spec.ts',
    '<rootDir>/test/modules/governance/simplified-permission-profile.spec.ts',
    '<rootDir>/test/modules/governance/user-scope.service.spec.ts',
    '<rootDir>/test/modules/wecom/wecom-core-bot.service.spec.ts',
    '<rootDir>/test/modules/wecom/wecom-maintenance-degradation.service.spec.ts',
    '<rootDir>/test/modules/wecom/wecom-message-adapter.service.spec.ts',
    '<rootDir>/test/modules/wecom/wecom-stream-dispatcher.service.spec.ts',
    '<rootDir>/test/modules/wecom/wecom-transport.service.spec.ts',
    '<rootDir>/test/shared/**/*.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};

export default config;
