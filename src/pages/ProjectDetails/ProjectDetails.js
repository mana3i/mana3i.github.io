import { Link, useParams } from 'react-router-dom'
import GitHubIcon from '@material-ui/icons/GitHub'
import LaunchIcon from '@material-ui/icons/Launch'
import { projects } from '../../portfolio'
import MarkdownView from './MarkdownView'
import projectContent from './content'
import './ProjectDetails.css'

const ProjectDetails = () => {
  const { id } = useParams()
  const project = projects.find((item) => item.id === id)

  if (!project) {
    return (
      <section className='section project-details center'>
        <h2>Project not found</h2>
        <Link to='/projects' className='link project-details__back'>
          Back to projects
        </Link>
      </section>
    )
  }

  const content = projectContent[project.id]

  if (content) {
    return <MarkdownView content={content} />
  }

  const { name, description, about, stack, sourceCode, livePreview, image } =
    project

  return (
    <section className='section project-details'>
      <Link to='/projects' className='link project-details__back'>
        &larr; Back to projects
      </Link>

      <h2 className='section__title'>{name}</h2>

      {image && (
        <img
          src={
            image.startsWith('http')
              ? image
              : `${process.env.PUBLIC_URL}/images/${image}`
          }
          alt={`${name} screenshot`}
          className='project-details__image'
        />
      )}

      {description && (
        <p className='project-details__description'>{description}</p>
      )}

      {about && <p className='project-details__about'>{about}</p>}

      {stack && (
        <ul className='project-details__stack'>
          {stack.map((item) => (
            <li key={item} className='project-details__stack-item'>
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className='project-details__links'>
        {sourceCode && (
          <a
            href={sourceCode}
            aria-label='source code'
            className='link link--icon'
          >
            <GitHubIcon />
          </a>
        )}

        {livePreview && (
          <a
            href={livePreview}
            aria-label='live preview'
            className='link link--icon'
          >
            <LaunchIcon />
          </a>
        )}
      </div>
    </section>
  )
}

export default ProjectDetails
