import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from './Home'

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )

describe('Home', () => {
  it('renders the name and role', () => {
    renderHome()

    expect(
      screen.getByRole('heading', { name: /Amine Manai/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /DevOps\/Cloud Engineer/i })
    ).toBeInTheDocument()
  })

  it('renders the profile picture with the name as alt text', () => {
    renderHome()

    expect(screen.getByAltText(/Amine Manai/i)).toHaveAttribute(
      'src',
      '/images/amine.jpg'
    )
  })

  it('renders the social links', () => {
    renderHome()

    expect(screen.getByRole('link', { name: 'github' })).toHaveAttribute(
      'href',
      'https://github.com/mana3i'
    )
    expect(screen.getByRole('link', { name: 'linkedin' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/amine-manai'
    )
    expect(screen.getByRole('link', { name: 'email' })).toHaveAttribute(
      'href',
      'mailto:amine.manai@supcom.tn'
    )
  })

  it('renders the projects list', () => {
    renderHome()

    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Scalable Web Application with ALB and Auto Scaling/i,
      })
    ).toBeInTheDocument()
  })

  it('renders the footer', () => {
    renderHome()

    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument()
  })
})
