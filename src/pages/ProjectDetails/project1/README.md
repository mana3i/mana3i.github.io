# Scalable Web Application with ALB and Auto Scaling

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [AWS Services Used](#aws-services-used)
4. [Network Design (VPC)](#network-design-vpc)
5. [High Availability & Scaling](#high-availability--scaling)
6. [Security Groups](#security-groups)
7. [IAM Roles](#iam-roles)
8. [Project Flow](#project-flow)
9. [Deployment Guide](#deployment-guide)

---

## Overview

The application serves a web workload to users on the internet. Every layer is duplicated across two Availability Zones so that the failure of a single AZ does not take the application down. The setup follows best practices for compute scalability, security, and cost optimization.

**Design goals**

- **High availability:** two AZs, a load balancer spanning both, and a Multi-AZ database with automatic failover.
- **Elastic scalability:** an Auto Scaling Group adds and removes EC2 instances automatically based on live demand.
- **Low latency:** CloudFront caches static assets close to users and offloads the origin.

---

## Architecture Diagram

![Solution Architecture](Scalable%20Web%20Application%20with%20ALB%20and%20Auto%20Scaling.png)

The design is a classic three-tier layout **edge → web/app tier → database tier** spread across two Availability Zones for high availability, with all compute isolated in private subnets and management, monitoring, and identity applied as cross-cutting concerns.

---

## AWS Services Used

| Service                          | Role in the architecture                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Amazon VPC**                   | Isolated network with public and private subnets across 2 AZs, route tables, IGW, NAT Gateways, Security Groups, NACLs. |
| **Amazon EC2**                   | Web and app compute, running in public and private subnets respectively.                                                |
| **EC2 Auto Scaling (ASG)**       | Launch Template + target-tracking scaling to add/remove instances with demand and self-heal failed ones.                |
| **Elastic Load Balancing (ALB)** | Layer 7 load balancing across both AZs with target group health checks.                                                 |
| **AWS WAF**                      | Web ACL on the ALB: AWS managed OWASP rule set and rate-based rules.                                                    |
| **Amazon CloudFront**            | Global CDN caching static assets and reducing origin load and latency.                                                  |
| **Amazon RDS (Multi-AZ)**        | Managed PostgreSQL with a synchronous standby and automated failover.                                                   |
| **Amazon Route 53**              | DNS with an alias record to the front door and health checks.                                                           |
| **AWS Systems Manager**          | Session Manager for bastion-free, auditable shell access to instances.                                                  |
| **Amazon CloudWatch**            | Dashboards, metrics, logs, and alarms (CPU, request count, unhealthy hosts, DB metrics).                                |
| **Amazon SNS**                   | Delivers alarm notifications (email,SMS...) when thresholds are breached.                                               |
| **AWS IAM**                      | Instance profile and least-privilege roles; the SSM role that enables Session Manager.                                  |

---

## Network Design (VPC)

A single VPC (`10.0.0.0/16`) split into six subnets: a public and two private tiers in each of two Availability Zones.

| Subnet        | AZ   | CIDR           | Contents                        | Route to internet          |
| ------------- | ---- | -------------- | ------------------------------- | -------------------------- |
| Public A      | AZ-A | `10.0.1.0/24`  | EC2 web instance, NAT Gateway A | Internet Gateway           |
| Public B      | AZ-B | `10.0.2.0/24`  | EC2 web instance, NAT Gateway B | Internet Gateway           |
| Private App A | AZ-A | `10.0.11.0/24` | EC2 app instance                | Outbound via NAT Gateway A |
| Private App B | AZ-B | `10.0.12.0/24` | EC2 app instance                | Outbound via NAT Gateway B |
| Private DB A  | AZ-A | `10.0.21.0/24` | RDS primary                     | None                       |
| Private DB B  | AZ-B | `10.0.22.0/24` | RDS standby                     | None                       |

**Key networking components**

- **Internet Gateway:** provides internet access for the public subnets (the ALB and NAT Gateways).
- **NAT Gateways:** one per AZ, so private-subnet instances can reach the internet outbound (for OS and package updates) without being reachable inbound. One per AZ avoids a cross-AZ single point of failure.
- **Route tables:** the public route table sends `0.0.0.0/0` to the Internet Gateway, each private app route table sends `0.0.0.0/0` to its own AZ's NAT Gateway, the database subnets have no default route.
- **Security Groups (stateful):** layered so each tier only accepts traffic from the tier in front of it:
  - Public ALB SG: allow `443`/`80` from the internet.
  - Private EC2 SG: allow the app port **only from the public ALB SG**.
  - RDS SG: allow the DB port **only from the EC2 SG**.
- **Network ACLs (stateless):** subnet-level guardrails as a second layer of defense in depth.

---

## High Availability & Scaling

- **Multi-AZ everything.** The ALB spans both AZs, the ASG launches instances into both public web and private app subnets, and RDS keeps a synchronous standby in the second AZ. Losing an entire AZ leaves the application running.
- **Auto Scaling Group** with a **Launch Template** defines the instance blueprint (AMI, type, security group, IAM instance profile, user data). A **target-tracking** policy keeps a metric at a set point, scaling out under load and back in when idle.
- **Self-healing.** The ASG uses ELB health checks: an instance that fails health checks is terminated and replaced automatically, keeping the desired capacity.
- **Automated DB failover.** If the RDS primary fails, RDS promotes the standby and updates the DNS endpoint, with no application change needed.

---

## Security Groups

| Security Group | Direction | Source / Destination | Port    | Purpose                          |
| -------------- | --------- | -------------------- | ------- | -------------------------------- |
| **ALB-SG**     | Inbound   | `0.0.0.0/0`          | 80, 443 | Public web traffic from internet |
|                | Outbound  | App-SG               | 8080    | Forward to app instances         |
| **App-SG**     | Inbound   | ALB-SG               | 8080    | Traffic only from the ALB        |
|                | Outbound  | RDS-SG               | 5432    | Database queries                 |
|                | Outbound  | `0.0.0.0/0`          | 443     | Patching / AWS APIs via NAT      |
| **RDS-SG**     | Inbound   | App-SG               | 5432    | PostgreSQL only from app tier    |
|                | Outbound  | —                    | —       | None required                    |

---

## IAM Roles

1. **Administrator (Session Manager):** `AmazonSSMManagedInstanceCore`, lets the admin open bastion-free shell sessions into the EC2 instances.
2. **EC2 Instance Role:** `CloudWatchAgentServerPolicy`, lets instances publish metrics and logs to CloudWatch.
3. **ALB:** `AWSElasticLoadBalancingServiceRolePolicy`, service-linked role that lets the ALB manage targets and networking.
4. **ASG:** `AWSServiceRoleForAutoScaling`, service-linked role that lets the ASG launch and terminate instances.
5. **CloudWatch:** `CloudWatchReadOnlyAccess`, grants the admin read access to dashboards, metrics, and alarms.

---

## Project Flow

1. A user requests the site and **Route 53** resolves the domain (an alias record).
2. **CloudFront** serves cached static assets from the edge location nearest the user and forwards dynamic requests to the origin.
3. **AWS WAF**, attached to the **Application Load Balancer**, inspects incoming requests and blocks the OWASP Top 10 patterns (SQLi, XSS, etc.) and abusive traffic.
4. The **ALB** performs Layer 7 routing and distributes requests across healthy EC2 targets in both Availability Zones using target group health checks to route around unhealthy instances.
5. The **EC2 instances** (members of the **Auto Scaling Group**) process the request in the private app subnets.
6. Instances read from and write to the **RDS primary** in the private data subnet. RDS synchronously replicates to the **standby** in the other AZ.
7. For outbound needs (package updates, external APIs), instances egress through their AZ's **NAT Gateway** and never inbound.
   Throughout: administrators reach instances via **Systems Manager Session Manager** (no SSH, no bastion, no open port 22),**CloudWatch** collects metrics and logs and triggers **SNS** notifications on alarms and **IAM** roles grant least-privilege permissions.

---

## Deployment Guide

1. **Build the VPC:** two AZs, public + two private subnet tiers, Internet Gateway, one NAT Gateway per AZ, and the associated route tables.
2. **Create Security Groups** for the ALB, EC2, and RDS tiers with the layered rules above.
3. **Provision RDS Multi-AZ** in the database subnets and enable encryption and automated backups.
4. **Create the Launch Template:** AMI, instance type, EC2 security group, the IAM instance profile (with the SSM managed policy), and user data to install/start the app.
5. **Create the Auto Scaling Group** across both public web and private app subnets with a target-tracking policy; attach it to the ALB target group.
6. **Create the ALB** in the public and private subnets, with listeners, the target group, and health checks; attach the **WAF** Web ACL.
7. **Create the CloudFront distribution** with the ALB as origin.
8. **Configure Route 53** with an alias record to CloudFront/ALB.
9. **Set up CloudWatch** dashboards and alarms, and an **SNS** topic with your subscription.
10. **Verify access** to an instance via Session Manager (no SSH key needed).

---
