import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Projects from './Projects'

const renderProjects = () =>
  render(
    <MemoryRouter>
      <Projects />
    </MemoryRouter>
  )

describe('Projects', () => {
  it('renders the section title', () => {
    renderProjects()

    expect(
      screen.getByRole('heading', { name: 'Projects' })
    ).toBeInTheDocument()
  })

  it('renders the project name, description and stack', () => {
    renderProjects()

    expect(
      screen.getByRole('heading', {
        name: /Scalable Web Application with ALB and Auto Scaling/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Highly available three-tier AWS architecture/i)
    ).toBeInTheDocument()
    expect(screen.getByText('AWS')).toBeInTheDocument()
    expect(screen.getByText('EC2')).toBeInTheDocument()
    expect(screen.getByText('WAF')).toBeInTheDocument()
  })

  it('links each project to its details page', () => {
    renderProjects()

    expect(
      screen.getByRole('link', {
        name: /Scalable Web Application with ALB and Auto Scaling/i,
      })
    ).toHaveAttribute('href', '/projects/aws-scalable-web-app')
  })
})