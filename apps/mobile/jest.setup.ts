import '@testing-library/react-native/extend-expect';

// Mock global fetch for API client tests
if (!global.fetch) {
  global.fetch = jest.fn();
}
