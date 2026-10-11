import { Link } from 'react-router-dom'
import { projects } from '../../portfolio'
import projectContent from '../ProjectDetails/content'
import readingTime from '../../utils/readingTime'
import './Projects.css'

const Projects = () => {
  if (!projects.length) return null

  return (
    <section className='section projects'>
      <h2 className='section__title'>Projects</h2>

      <div className='projects__grid'>
        {projects.map((project) => {
          const readTime = readingTime(
            (projectContent[project.id] || {}).markdown
          )

          return (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className='project'
            >
              {project.image && (
                <img
                  src={
                    project.image.startsWith('http')
                      ? project.image
                      : `${process.env.PUBLIC_URL}/images/${project.image}`
                  }
                  alt={`${project.name} screenshot`}
                  className='project__image'
                />
              )}

              <h3>{project.name}</h3>

              {readTime && <p className='project__read-time'>{readTime}</p>}

              <p className='project__description'>{project.description}</p>

              {project.stack && (
                <ul className='project__stack'>
                  {project.stack.map((item) => (
                    <li key={item} className='project__stack-item'>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default Projects
