import { render, fireEvent } from '@testing-library/react-native';
import { CityPicker } from '../../src/components/CityPicker';

describe('CityPicker', () => {
  it('renders selected codes and removes one on tap', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <CityPicker selected={['JFK', 'CDG']} onChange={onChange} />,
    );
    fireEvent.press(getByText('JFK ✕'));
    expect(onChange).toHaveBeenCalledWith(['CDG']);
  });

  it('adds a code on submit and uppercases it', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <CityPicker selected={['JFK']} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'cdg');
    fireEvent(input, 'submitEditing');
    expect(onChange).toHaveBeenCalledWith(['JFK', 'CDG']);
  });

  it('rejects unknown codes', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CityPicker selected={['JFK']} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'ZZZ');
    fireEvent(input, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText(/unknown airport/i)).toBeTruthy();
  });

  it('rejects duplicates', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CityPicker selected={['JFK']} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'JFK');
    fireEvent(input, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText(/already added/i)).toBeTruthy();
  });

  it('caps at 8 cities', () => {
    const onChange = jest.fn();
    const eight = ['JFK', 'CDG', 'FCO', 'AMS', 'MAD', 'BCN', 'LHR', 'FRA'];
    const { getByPlaceholderText, getByText } = render(
      <CityPicker selected={eight} onChange={onChange} />,
    );
    const input = getByPlaceholderText('Add airport (e.g. CDG)');
    fireEvent.changeText(input, 'MUC');
    fireEvent(input, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText(/maximum/i)).toBeTruthy();
  });
});
