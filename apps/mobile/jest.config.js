const path = require('path');

// Manually include jest-expo preset configuration
const jestExpoPreset = require('jest-expo/jest-preset.js');

module.exports = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/__tests__/api/**/*.test.(ts|tsx)', '<rootDir>/__tests__/data/**/*.test.(ts|tsx)'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!expo-constants)',
      ],
      setupFilesAfterEnv: [],
      testEnvironment: 'node',
    },
    {
      displayName: 'react-native',
      // Manually spread jest-expo config
      ...jestExpoPreset,
      // But prepend our setup files BEFORE jest-expo's
      setupFiles: [
        '<rootDir>/jest.preSetup.js',
        ...jestExpoPreset.setupFiles,
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        ...jestExpoPreset.moduleNameMapper,
        '^@react-native/js-polyfills/error-guard$': '<rootDir>/jest.errorGuardMock.js',
        // Mock the entire problematic packages that jest-expo's setup tries to load
        '^expo-modules-core(/?.*)?$': '<rootDir>/jest.expoModulesMock.js',
        '^expo(/?.*)?$': '<rootDir>/jest.expoModulesMock.js',
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      testMatch: ['<rootDir>/__tests__/**/*.test.(ts|tsx)'],
      testPathIgnorePatterns: ['/__tests__/api/', '/__tests__/data/'],
      // Override transformIgnorePatterns to include packages that need transformation
      transformIgnorePatterns: [
        '/node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo-modules-core|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@testing-library/react-native|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))/',
        '/node_modules/react-native-reanimated/plugin/',
      ],
      // Ensure we have the babel-jest transform for js/ts/tsx files from expo-modules-core
      transform: {
        ...jestExpoPreset.transform,
      },
    },
  ],
};
