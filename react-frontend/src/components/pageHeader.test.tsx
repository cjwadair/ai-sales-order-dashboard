import {cleanup, render} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {ThemeContext} from '../contexts';
import {PageHeader} from './PageHeader';

const themeWrapper = ({children}: {children: React.ReactNode}) => (
  <ThemeContext.Provider value={{theme: 'light', toggleTheme: () => {}}}>
    {children}
  </ThemeContext.Provider>
);

afterEach(() => {
  cleanup();
});

describe('PageHeader', () => {
  it('renders the title', () => {
    const {getByText} = render(<PageHeader title="Orders" />, {
      wrapper: themeWrapper,
    });

    expect(getByText('Orders')).toBeInTheDocument();
  });

  it('renders children elements', () => {
    const {getByText} = render(
      <PageHeader title="Products">
        <button>New Product</button>
      </PageHeader>,
      {wrapper: themeWrapper},
    );

    expect(getByText('New Product')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    const {getByLabelText} = render(<PageHeader title="Dashboard" />, {
      wrapper: themeWrapper,
    });

    expect(getByLabelText('Toggle dark mode')).toBeInTheDocument();
  });
});