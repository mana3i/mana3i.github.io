import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Projects from './Projects'

jest.mock('../ProjectDetails/content', () => ({
  'aws-scalable-web-app': { markdown: 'word '.repeat(200), assets: {} },
  'serverless-image-pipeline': { markdown: 'word '.repeat(400), assets: {} },
  'serverless-rest-api': { markdown: 'word '.repeat(600), assets: {} },
  'single-node-k8s-cluster': { markdown: 'word '.repeat(800), assets: {} },
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
    expect(screen.getAllByText('WAF')[0]).toBeInTheDocument()
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
    expect(screen.getAllByText('API Gateway')[0]).toBeInTheDocument()
    expect(screen.getByText('Step Functions')).toBeInTheDocument()
    expect(screen.getByText('SNS')).toBeInTheDocument()
  })

  it('renders the third project name, description and stack', () => {
    renderProjects()

    expect(
      screen.getByRole('heading', {
        name: /Serverless REST API on AWS: Cognito/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Production-ready serverless backend for a to-do/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Cognito')).toBeInTheDocument()
    expect(screen.getAllByText('DynamoDB')[0]).toBeInTheDocument()
    expect(screen.getByText('X-Ray')).toBeInTheDocument()
  })

  it('renders the fourth project name, description and stack', () => {
    renderProjects()

    expect(
      screen.getByRole('heading', {
        name: /Single-Node Kubernetes Cluster with Terraform, Ansible, Cilium/i,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Fully automated single-node Kubernetes cluster/i)
    ).toBeInTheDocument()
    expect(screen.getByText('kubeadm')).toBeInTheDocument()
    expect(screen.getByText('Grafana')).toBeInTheDocument()
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
    expect(
      screen.getByRole('link', {
        name: /Serverless REST API on AWS: Cognito/i,
      })
    ).toHaveAttribute('href', '/projects/serverless-rest-api')
    expect(
      screen.getByRole('link', {
        name: /Single-Node Kubernetes Cluster with Terraform, Ansible, Cilium/i,
      })
    ).toHaveAttribute('href', '/projects/single-node-k8s-cluster')
  })

  it('renders the reading time for each project', () => {
    renderProjects()

    expect(screen.getByText('1 min read')).toBeInTheDocument()
    expect(screen.getByText('2 mins read')).toBeInTheDocument()
    expect(screen.getByText('3 mins read')).toBeInTheDocument()
    expect(screen.getByText('4 mins read')).toBeInTheDocument()
  })
})