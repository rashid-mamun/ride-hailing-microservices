import type { Config } from 'jest';

const config: Config = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.test\\.ts$',
    transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
    collectCoverageFrom: ['src/ride.service.ts', 'src/ride.controller.ts'],
    coverageDirectory: 'coverage',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@ride-hailing/shared-types$': '<rootDir>/../../packages/shared-types/src',
        '^@ride-hailing/shared-events$': '<rootDir>/../../packages/shared-events/src',
        '^@ride-hailing/shared-utils$': '<rootDir>/../../packages/shared-utils/src',
    },
    coverageThreshold: {
        global: { lines: 70, functions: 65, branches: 60 },
    },
};

export default config;
