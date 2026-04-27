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
      preset: 'jest-expo',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@clerk/.*|react-native-maps|@react-navigation/.*))',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      testMatch: ['<rootDir>/__tests__/**/*.test.(ts|tsx)'],
      testPathIgnorePatterns: ['/__tests__/api/', '/__tests__/data/'],
    },
  ],
};
