const path = require('path');

module.exports = {
    preset: 'ts-jest',
    rootDir: path.resolve('./src/'),
    testRegex: 'test/functional/performance\\.(ts)',
    moduleFileExtensions: ['js', 'ts', 'json'],
    collectCoverage: false,
    verbose: true,
};
