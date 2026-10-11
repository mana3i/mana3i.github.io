import GitHubIcon from '@material-ui/icons/GitHub'
import LinkedInIcon from '@material-ui/icons/LinkedIn'
import EmailIcon from '@material-ui/icons/Email'
import { home, about } from '../../portfolio'
import Projects from '../Projects/Projects'
import './Home.css'

const Home = () => {
  const { name, role, picture } = home
  const { social } = about

  return (
    <>
      <section className='home__hero'>
        <div className='home__header'>
          {picture && (
            <img
              src={
                picture.startsWith('http')
                  ? picture
                  : `${process.env.PUBLIC_URL}/images/${picture}`
              }
              alt={name}
              className='home__picture'
            />
          )}

          <div className='home__intro'>
            {name && (
              <h1>
                <span className='home__name'>{name}.</span>
              </h1>
            )}

            {role && <h2 className='home__role'>{role}.</h2>}
          </div>
        </div>

        {social && (
          <ul className='home__social'>
            {social.github && (
              <li>
                <a
                  href={social.github}
                  aria-label='github'
                  className='link link--icon home__social-link'
                >
                  <GitHubIcon fontSize='large' />
                </a>
              </li>
            )}

            {social.linkedin && (
              <li>
                <a
                  href={social.linkedin}
                  aria-label='linkedin'
                  className='link link--icon home__social-link'
                >
                  <LinkedInIcon fontSize='large' />
                </a>
              </li>
            )}

            {social.email && (
              <li>
                <a
                  href={`mailto:${social.email}`}
                  aria-label='email'
                  className='link link--icon home__social-link'
                >
                  <EmailIcon fontSize='large' />
                </a>
              </li>
            )}
          </ul>
        )}
      </section>

      <Projects />

      <footer className='home__footer'>
        © {new Date().getFullYear()} All rights reserved.
      </footer>
    </>
  )
}

export default Home
