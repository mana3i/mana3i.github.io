import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from './Navbar'
import { ThemeProvider } from '../../contexts/theme'

const renderNavbar = () =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </ThemeProvider>
  )

describe('Navbar', () => {
  it('renders links to every section', () => {
    renderNavbar()

    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute(
      'href',
      '/'
    )
    expect(screen.getByRole('link', { name: 'projects' })).toHaveAttribute(
      'href',
      '/projects'
    )
    expect(
      screen.getByRole('link', { name: 'certifications' })
    ).toHaveAttribute('href', '/certifications')
    expect(screen.getByRole('link', { name: 'about' })).toHaveAttribute(
      'href',
      '/about'
    )
  })

  it('renders the theme and navigation toggle buttons', () => {
    renderNavbar()

    expect(
      screen.getByRole('button', { name: 'toggle theme' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'toggle navigation' })
    ).toBeInTheDocument()
  })

  it('toggles the theme when the theme button is clicked', () => {
    renderNavbar()

    fireEvent.click(screen.getByRole('button', { name: 'toggle theme' }))

    expect(localStorage.getItem('themeName')).toBe('dark')
  })
})