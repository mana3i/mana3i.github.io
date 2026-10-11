import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider } from './contexts/theme'

jest.mock('./pages/ProjectDetails/content', () => ({}))

const renderApp = (initialPath = '/') =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>
  )

describe('App', () => {
  it('renders the home page by default', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { level: 1, name: /Amine Manai/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /DevOps\/Cloud Engineer/i })
    ).toBeInTheDocument()
  })

  it('navigates to the projects page when the projects link is clicked', () => {
    renderApp()

    fireEvent.click(screen.getByRole('link', { name: 'projects' }))

    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Scalable Web Application with ALB and Auto Scaling/i)
    ).toBeInTheDocument()
  })

  it('redirects an unknown route to the home page', () => {
    renderApp('/does-not-exist')

    expect(
      screen.getByRole('heading', { level: 1, name: /Amine Manai/i })
    ).toBeInTheDocument()
  })
})