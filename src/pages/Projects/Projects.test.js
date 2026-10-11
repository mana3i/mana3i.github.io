import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Projects from './Projects'

jest.mock('../ProjectDetails/content', () => ({
  'aws-scalable-web-app': { markdown: 'word '.repeat(200), assets: {} },
  'serverless-image-pipeline': { markdown: 'word '.repeat(400), assets: {} },
}))

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

  it('renders the first project name, description and stack', () => {
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

  it('renders the second project name, description and stack', () => {
    renderProjects()

    expect(
      screen.getByRole('heading', {
        name: /Building a Serverless Image Processing Pipeline with S3/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Serverless image processing pipeline on AWS/i)
    ).toBeInTheDocument()
    expect(screen.getByText('API Gateway')).toBeInTheDocument()
    expect(screen.getByText('Step Functions')).toBeInTheDocument()
    expect(screen.getByText('SNS')).toBeInTheDocument()
  })

  it('links each project to its details page', () => {
    renderProjects()

    expect(
      screen.getByRole('link', {
        name: /Scalable Web Application with ALB and Auto Scaling/i,
      })
    ).toHaveAttribute('href', '/projects/aws-scalable-web-app')
    expect(
      screen.getByRole('link', {
        name: /Building a Serverless Image Processing Pipeline with S3/i,
      })
    ).toHaveAttribute('href', '/projects/serverless-image-pipeline')
  })

  it('renders the reading time for each project', () => {
    renderProjects()

    expect(screen.getByText('1 min read')).toBeInTheDocument()
    expect(screen.getByText('2 mins read')).toBeInTheDocument()
  })
})