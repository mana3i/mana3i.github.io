import markdown from '!raw-loader!./project1/README.md'
import architectureImage from './project1/Scalable Web Application with ALB and Auto Scaling.png'
import serverlessMarkdown from '!raw-loader!./project2/serverless-image-pipeline.md'
import serverlessImage from './project2/Serverless Image Processing Pipeline.png'

const projectContent = {
  'aws-scalable-web-app': {
    markdown,
    assets: {
      'Scalable Web Application with ALB and Auto Scaling.png': architectureImage,
    },
  },
  'serverless-image-pipeline': {
    markdown: serverlessMarkdown,
    assets: {
      'Serverless Image Processing Pipeline.png': serverlessImage,
    },
  },
}

export default projectContent
