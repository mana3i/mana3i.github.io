const home = {
  name: 'Amine Manai',
  role: 'DevOps/Cloud Engineer',
  picture: 'amine.jpg',
  description:
    'Adipisicing sit fugit ullam unde aliquid sequi Facilis soluta facilis perspiciatis corporis nulla aspernatur. Autem eligendi rerum delectus modi quisquam? Illo ut quasi nemo ipsa cumque perspiciatis! Maiores minima consectetur.',
}

const projects = [
  {
    id: 'aws-scalable-web-app',
    name: 'Scalable Web Application with ALB and Auto Scaling',
    description:
      'Highly available three-tier AWS architecture with an Application Load Balancer, Auto Scaling, CloudFront, WAF and a Multi-AZ database spread across two Availability Zones.',
    stack: ['AWS', 'EC2', 'ALB', 'Auto Scaling', 'RDS', 'CloudFront', 'WAF'],
  },
]

const certifications = [
  {
    name: 'AWS Certified Solutions Architect – Associate',
    issuedBy: 'Amazon Web Services (AWS)',
    issuedDate: '2026-08-14',
    validUntil: '2029-08-14',
    url: 'https://www.credly.com/badges/7e93e7ce-1af2-4c8e-9c64-43a278e023d9/linked_in_profile',
    imagePath: '/certifications/certifs/AWS-SAA.png',
  },
  {
    name: 'HashiCorp Certified: Terraform Associate (004)',
    issuedBy: 'IBM Professional Certification',
    issuedDate: '2026-09-26',
    validUntil: '2028-09-26',
    url: 'https://www.credly.com/badges/c8518210-f8c0-4ad5-8f45-98f2f4708d86/linked_in_profile',
    imagePath: '/certifications/certifs/hashicorp-terraform.png',
  },
]

const about = {
  social: {
    github: 'https://github.com/mana3i',
    linkedin: 'https://www.linkedin.com/in/amine-manai',
    email: 'amine.manai@supcom.tn',
  },
}

export { home, projects, certifications, about }
