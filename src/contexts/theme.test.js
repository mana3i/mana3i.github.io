import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, ThemeContext } from './theme'

const ThemeConsumer = () => (
  <ThemeContext.Consumer>
    {([{ themeName, toggleTheme }]) => (
      <>
        <span data-testid='theme-name'>{themeName}</span>
        <button type='button' onClick={toggleTheme}>
          toggle
        </button>
      </>
    )}
  </ThemeContext.Consumer>
)

const renderWithProvider = () =>
  render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  )

describe('ThemeProvider', () => {
  it('starts with the light theme by default', () => {
    renderWithProvider()

    expect(screen.getByTestId('theme-name')).toHaveTextContent('light')
  })

  it('toggles the theme and persists it to localStorage', () => {
    renderWithProvider()

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    expect(screen.getByTestId('theme-name')).toHaveTextContent('dark')
    expect(localStorage.getItem('themeName')).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    expect(screen.getByTestId('theme-name')).toHaveTextContent('light')
    expect(localStorage.getItem('themeName')).toBe('light')
  })
})