import GitHubIcon from '@material-ui/icons/GitHub'
import LinkedInIcon from '@material-ui/icons/LinkedIn'
import EmailIcon from '@material-ui/icons/Email'
import { about } from '../../portfolio'
import './About.css'

const About = () => {
  const { social } = about

  if (!social) return null

  return (
    <section className='section about'>
      <h2 className='section__title'>About</h2>

      <ul className='about__list'>
        {social.github && (
          <li className='about__list-item'>
            <a
              href={social.github}
              aria-label='github'
              className='link about__link'
            >
              <GitHubIcon />
              GitHub
            </a>
          </li>
        )}

        {social.linkedin && (
          <li className='about__list-item'>
            <a
              href={social.linkedin}
              aria-label='linkedin'
              className='link about__link'
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          </li>
        )}

        {social.email && (
          <li className='about__list-item'>
            <a
              href={`mailto:${social.email}`}
              aria-label='email'
              className='link about__link'
            >
              <EmailIcon />
              Email
            </a>
          </li>
        )}
      </ul>
    </section>
  )
}

export default About
