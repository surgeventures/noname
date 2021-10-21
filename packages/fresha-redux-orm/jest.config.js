const path = require('path');

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: path.resolve('./src/'),
    testRegex: 'test/(.*)/(.*)\\.(ts)',
    moduleFileExtensions: ['js', 'ts', 'json'],
    testPathIgnorePatterns: [
        'test/functional/es5\\.(ts)',
        'test/functional/performance\\.(ts)',
    ],
    coverageDirectory: './coverage/',
    collectCoverage: false,
    collectCoverageFrom: [
        '*.ts',
        '*/*.ts',
    ],
    coveragePathIgnorePatterns: [
        'test/*',
    ],
    coverageThreshold: {
        global: {
            branches: 75,
            functions: 80,
            lines: 85,
            statements: 85,
        },
    },
};
