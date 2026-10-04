import markdown from '!raw-loader!./project1/README.md'
import architectureImage from './project1/Scalable Web Application with ALB and Auto Scaling.png'

const projectContent = {
  'aws-scalable-web-app': {
    markdown,
    assets: {
      'Scalable Web Application with ALB and Auto Scaling.png': architectureImage,
    },
  },
}

export default projectContent
