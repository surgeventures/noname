const path = require('path');

module.exports = {
    preset: 'ts-jest',
    rootDir: path.resolve('./src/'),
    testRegex: 'test/functional/es5\\.(ts)',
    moduleFileExtensions: ['ts', 'js', 'json'],
    transform: {},
    collectCoverage: false,
};
