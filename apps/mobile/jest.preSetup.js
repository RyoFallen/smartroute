// This runs BEFORE jest-expo setup
const EventEmitter = require('events').EventEmitter;

// Initialize globalThis.expo with everything jest-expo setup will need
globalThis.expo = {
  modules: {
    EventEmitter,
  },
};

// Pre-load and then mock the uuid module so jest-expo setup won't fail
// when it tries to use jest.requireActual
try {
  // Create a mock that will work with jest-expo's expectation
  const mockUuid = {
    default: {
      v4: () => 'mock-uuid-v4',
      v5: () => 'mock-uuid-v5',
    },
  };

  // Use jest.doMock with the actual module loader to replace it
  jest.doMock('expo-modules-core/build/uuid/uuid.web', () => mockUuid, { virtual: true });
} catch (e) {
  // If it fails, that's ok - jest-expo might handle it differently
}
