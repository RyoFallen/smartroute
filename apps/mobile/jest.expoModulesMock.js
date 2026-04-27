const EventEmitter = require('events').EventEmitter;

module.exports = {
  // This module is used for multiple things, so we need to support both
  // the expo and expo-modules-core exports

  // For expo-modules-core module itself
  NativeModule: {},
  EventEmitter,
  NativeModulesProxy: {},
  uuid: {
    v4: () => 'mock-uuid-v4',
    v5: () => 'mock-uuid-v5',
  },

  // For expo-modules-core/build/uuid/uuid.web specifically
  default: {
    v4: () => 'mock-uuid-v4',
    v5: () => 'mock-uuid-v5',
  },
};
