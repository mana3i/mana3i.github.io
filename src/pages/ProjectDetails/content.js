import markdown from '!raw-loader!./project1/README.md'
import architectureImage from './project1/Scalable Web Application with ALB and Auto Scaling.png'
import serverlessMarkdown from '!raw-loader!./project2/serverless-image-pipeline.md'
import serverlessImage from './project2/Serverless Image Processing Pipeline.png'
import restApiMarkdown from '!raw-loader!./project3/blog.md'
import restApiImage from './project3/Serverless REST API.png'

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
  'serverless-rest-api': {
    markdown: restApiMarkdown,
    assets: {
      'Serverless REST API.png': restApiImage,
    },
  },
}

export default projectContent
