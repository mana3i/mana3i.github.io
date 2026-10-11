import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProjectDetails from './ProjectDetails'

jest.mock('./content', () => ({}))

const renderProjectDetails = (id) =>
  render(
    <MemoryRouter initialEntries={[`/projects/${id}`]}>
      <Routes>
        <Route path='/projects/:id' element={<ProjectDetails />} />
      </Routes>
    </MemoryRouter>
  )

describe('ProjectDetails', () => {
  it('shows a message when the project does not exist', () => {
    renderProjectDetails('unknown-project')

    expect(
      screen.getByRole('heading', { name: 'Project not found' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Back to projects/i })
    ).toHaveAttribute('href', '/projects')
  })

  it('renders the project name, description and stack', () => {
    renderProjectDetails('aws-scalable-web-app')

    expect(
      screen.getByRole('heading', {
        name: /Scalable Web Application with ALB and Auto Scaling/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Highly available three-tier AWS architecture/i)
    ).toBeInTheDocument()
    expect(screen.getByText('AWS')).toBeInTheDocument()
    expect(screen.getByText('RDS')).toBeInTheDocument()
  })

  it('renders the serverless project name, description and stack', () => {
    renderProjectDetails('serverless-image-pipeline')

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
  })
})