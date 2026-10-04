import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from './Header'
import { ThemeProvider } from '../../contexts/theme'

const renderHeader = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </ThemeProvider>
  )

describe('Header', () => {
  it('renders the name as a link to the home page', () => {
    renderHeader()

    expect(
      screen.getByRole('link', { name: /Amine Manai/i })
    ).toHaveAttribute('href', '/')
  })

  it('renders the navigation', () => {
    renderHeader()

    expect(screen.getByRole('link', { name: 'projects' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'about' })).toBeInTheDocument()
  })
})