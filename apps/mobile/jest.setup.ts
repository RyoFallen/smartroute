// Note: @testing-library/react-native/extend-expect causes import issues with React Native
// import '@testing-library/react-native/extend-expect';

// Mock @react-native/js-polyfills/error-guard to avoid Flow type parsing issues
jest.mock('@react-native/js-polyfills/error-guard', () => ({}), { virtual: true });

// Mock global fetch for API client tests
if (!global.fetch) {
  global.fetch = jest.fn();
}
