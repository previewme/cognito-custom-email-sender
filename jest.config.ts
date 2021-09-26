import type { Config } from '@jest/types';

export default async (): Promise<Config.InitialOptions> => {
    return {
        verbose: true,
        preset: 'ts-jest',
        testEnvironment: 'node',
        collectCoverage: true,
        testResultsProcessor: 'jest-sonar-reporter',
        coverageDirectory: 'reports/coverage'
    };
};
