# Serverless REST API on AWS: Cognito, API Gateway, Lambda, DynamoDB, WAF and X-Ray

## Table of Contents

- [1. Overview](#1-overview)
- [2. Architecture Overview](#2-architecture-overview)
- [3. Component Deep Dive](#3-component-deep-dive)
- [4. Security](#4-security)
- [5. Reliability and Error Handling](#5-reliability-and-error-handling)
- [6. Observability](#6-observability)
- [7. Caching and Cost Control](#7-caching-and-cost-control)
- [8. Testing the API](#8-testing-the-api)

---

## 1. Overview

"Production-ready serverless" isn't about Lambda. It starts with everything around it: who is allowed in, what gets blocked before it costs money, how fast repeat reads are, and how I find the slow hop when something breaks at 2 a.m.

To solve this, we are going to build a production-ready serverless backend for a to-do application using token-based authentication to control access, a firewall to rate-limit and filter injection attempts before they cost money, a response cache for fast repeat reads, distributed tracing to find the slow hop when something breaks at 2 a.m., an event-driven stream of changes, and a static frontend with no server to patch.

### 1.1 Goals

By the end of the project I want to have implemented and demonstrated:

- Token-based authentication with Amazon Cognito and an API Gateway authorizer
- DynamoDB table and GSI design driven by access patterns
- WAF rules that protect the API from abuse and injection attacks
- X-Ray tracing to debug latency across API Gateway, Lambda and DynamoDB
- API Gateway caching to reduce Lambda invocations and cost
- DynamoDB Streams to trigger downstream event processing
- A React (or Vue) frontend hosted on S3 and delivered through CloudFront

### 1.2 Requirements

**Functional**

- Users can sign up, sign in and sign out.
- A signed-in user can create, read, update and delete their own to-dos, and list their open to-dos by due date.
- A user can never see or modify another user's data.

**Non-functional**

- No servers to manage: everything scales with traffic and costs close to nothing when idle.
- Abusive traffic is blocked before it reaches the application.
- Every request can be traced end to end.
- The whole stack is reproducible from code.

### 1.3 Services

CloudFront, S3, WAF, Cognito, API Gateway, Lambda, DynamoDB, X-Ray, CloudWatch.

---

## 2. Architecture Overview

![Architecture diagram](Serverless%20REST%20API.png)

This is the path a request will take, following the numbers in the diagram:

1. The single-page app is served from a **private S3 bucket** through **CloudFront**.
2. The user signs in on the **Cognito hosted UI** and receives JWTs.
3. The app calls `/api/*` with the token. **AWS WAF**, attached to CloudFront, filters the request first.
4. CloudFront forwards the request to **API Gateway** with a secret header.
5. API Gateway's **Cognito authorizer** validates the token. Cached GETs are answered right here.
6. On a cache miss, API Gateway invokes a **Lambda** CRUD handler.
7. Lambda reads and writes **DynamoDB**, always scoped to the caller's own partition.
8. Changes flow through **DynamoDB Streams** to a second Lambda for asynchronous work.

**X-Ray** follows the API Gateway, Lambda and DynamoDB hops and stitches them into one trace.

### 2.1 Design principles

- **One front door.** A single CloudFront distribution serves both the frontend and the API: one domain, one certificate, no CORS configuration and one place to attach the firewall.
- **Identity is part of the data model.** The Cognito user id becomes the DynamoDB partition key, so isolation is structural, not a filter I might forget.
- **Keep the synchronous path thin.** Anything that does not have to finish before the user gets a response (notifications, audit records) moves off the request path through Streams.
- **Defense in depth.** WAF, throttling, authentication and least-privilege IAM each catch something the others miss.
- **Observable from day one.** Tracing and alarms are part of the first deployment, not an afterthought.

---

## 3. Component Deep Dive

### 3.1 CloudFront and S3

The distribution will have two origins:

| Path pattern   | Origin                              | Caching                                       |
| -------------- | ----------------------------------- | --------------------------------------------- |
| `/api/*`       | API Gateway (Regional endpoint)     | Disabled at the CDN, forwards `Authorization` |
| `/*` (default) | S3 bucket via Origin Access Control | Aggressive, with hashed asset filenames       |

The S3 bucket stays fully private: only CloudFront can read it. For `/api/*`, CloudFront provides TLS termination near the user, HTTP/3 and a trip over the AWS backbone. I deliberately will **not** cache API responses at the CDN: every request carries a per-user token, and a wrong cache key there would be risky. Response caching happens one layer deeper, in API Gateway, where I control the key precisely.

The API will be a **Regional** endpoint rather than edge-optimized. An edge-optimized API already hides its own CloudFront distribution, and stacking two CDNs adds nothing.

### 3.2 Amazon Cognito

A User Pool provides sign-up, sign-in, password policy, email verification and a hosted UI without any custom authentication code. The frontend will use the **authorization code flow with PKCE**, the right choice for browser apps because no client secret ships to the browser.

Every API method will use a **Cognito User Pool authorizer**:

```yaml
Auth:
  DefaultAuthorizer: CognitoAuthorizer
  Authorizers:
    CognitoAuthorizer:
      UserPoolArn: !GetAtt UserPool.Arn
      Identity:
        Header: Authorization
```

API Gateway verifies the signature, issuer, audience and expiry before the code runs, so unauthenticated calls never cost a Lambda invocation.

### 3.3 API Gateway and the API contract

API Gateway will do three jobs beyond routing:

- **Throttling and usage plans:** steady-state and burst limits per stage and method, a second line of defense behind WAF.
- **Request validation:** JSON schema models reject malformed bodies at the gateway.
- **Response caching:** covered in [section 7](#7-caching-and-cost-control).

The API contract:

| Method   | Path              | Purpose        | Success | Cached |
| -------- | ----------------- | -------------- | ------- | ------ |
| `POST`   | `/api/todos`      | Create a to-do | `201`   | No     |
| `GET`    | `/api/todos`      | List my to-dos | `200`   | Yes    |
| `GET`    | `/api/todos/{id}` | Get one to-do  | `200`   | Yes    |
| `PUT`    | `/api/todos/{id}` | Update a to-do | `200`   | No     |
| `DELETE` | `/api/todos/{id}` | Delete a to-do | `204`   | No     |

A to-do looks like this:

```json
{
  "id": "01J9ZQ3K8X5V7N2M4P6R8T0W1Y",
  "title": "Write the architecture blog",
  "status": "open",
  "dueDate": "2026-10-20",
  "version": 3
}
```

### 3.4 AWS Lambda

I plan to write the handlers in Python, one function per operation family (create, read, update, delete). Each function gets:

- its own **least-privilege IAM role** (the read function gets `dynamodb:GetItem` and `dynamodb:Query`, not `DeleteItem`)
- the table name through an **environment variable**
- **active X-Ray tracing** with the AWS SDK instrumented, so each DynamoDB call is its own subsegment

The user id will always come from the verified token claims, never from the request body:

```python
def handler(event, context):
    claims = event["requestContext"]["authorizer"]["claims"]
    user_id = claims["sub"]
    ...
```

### 3.5 DynamoDB

Before designing the table, some questions have to be answered:

1. List all of the to-dos.
2. Get one to-do by id.
3. List _open_ to-dos, ordered by due date.

That leads to this design:

| Attribute | Value                        | Purpose                                 |
| --------- | ---------------------------- | --------------------------------------- |
| `PK`      | `USER#<cognito sub>`         | Partition by owner                      |
| `SK`      | `TODO#<ulid>`                | Unique id: ULIDs sort by creation time  |
| `GSI1PK`  | `USER#<sub>#STATUS#<status>` | Partition for status lookups            |
| `GSI1SK`  | `<dueDate>#<ulid>`           | Sort by due date                        |
| `version` | number                       | Optimistic concurrency                  |
| `ttl`     | epoch seconds                | Automatic expiry of old completed items |

Patterns 1 and 2 are served by the base table (`Query` on `PK` with `begins_with(SK, "TODO#")`, or `GetItem`). Pattern 3 is a `Query` on GSI1. There will be no scans anywhere. When `status` changes from `open` to `done`, the update rewrites `GSI1PK`, so the item leaves the "open" view automatically.

Capacity will be **on-demand**: for a new application with unpredictable traffic, Paying per request is preferable rather than guessing provisioned numbers.

### 3.6 DynamoDB Streams and the consumer

With Streams enabled (`NEW_AND_OLD_IMAGES`), every create, update and delete lands in an ordered per-item change log. A second Lambda will consume it and publish through SQS, for example a notification when a to-do is completed, or an audit record. New consumers can be added later through EventBridge without touching the API code.

---

## 4. Security

Security is layered, and each layer is cheap and catches something the others don't.

### 4.1 WAF at the edge

The web ACL will be attached to CloudFront. A CloudFront-scoped ACL must be created in **us-east-1**, which catches people out every time. The rules, in priority order:

1. **Rate-based rule:** block an IP exceeding 2,000 requests in a 5-minute window. This blunts brute force against sign-in and DDOS attacks.
2. **Geo match:** block countries where I have no users.
3. **AWS managed Common Rule Set**: cross-site scripting patterns, oversized bodies, malformed requests.
4. **AWS managed SQL Injection and Known Bad Inputs rule sets.**

### 4.2 Authentication and authorization

- Cognito authenticates: the API Gateway authorizer rejects bad tokens before Lambda runs.
- Authorization is structural: every DynamoDB key is built from the token's `sub`, so a handler can only reach the caller's own partition.
- Lambda roles are scoped per function and per table (and per index where needed).

### 4.3 Closing the back door

If someone discovers the raw API Gateway URL, they can bypass CloudFront and WAF entirely. The plan:

- CloudFront adds a secret custom header (for example `x-origin-verify`) to every origin request.
- A small **regional WAF ACL** on the API Gateway stage blocks any request without the right header.

The header value will be stored in Secrets Manager and rotated periodically. A firewall in front of a publicly reachable origin is only a suggestion until this is done.

### 4.4 Data protection

DynamoDB and S3 are encrypted at rest by default, CloudFront will enforce HTTPS and redirect HTTP, and the S3 bucket blocks all public access. Frontend tokens are kept in memory rather than local storage, and a strict Content-Security-Policy header is added through a CloudFront response headers policy.

---

## 5. Reliability and Error Handling

- **Throttling returns 429, not outages.** Usage plans and WAF rate limits shed load before it reaches Lambda: clients retry with exponential backoff.
- **Idempotent writes.** Retries are a fact of life, so `POST /todos` accepts a client-supplied idempotency key, and the handler uses a DynamoDB **conditional write** (`attribute_not_exists(PK)`) so a retried request cannot create a duplicate.
- **Optimistic concurrency on updates.** `PUT` includes the `version` in a condition expression: a stale update fails with a clear `409` instead of silently overwriting.
- **Stream failures must not stall the pipeline.** The consumer's event source mapping will use **bisect-on-error**, a **maximum retry count**, and an **on-failure destination** (an SQS queue). Without these, one poison record blocks its shard and everything behind it waits.
- **Clean error contracts.** Handlers catch known failures (validation, conditional check failed, not found) and map them to 4xx responses. Anything unexpected is logged with the trace id and returned as a generic 500, with no stack traces leaking to clients.
- **Protect the data.** Point-in-time recovery is enabled on the table, and deletion protection prevents an accidental stack deletion from wiping it.
- **Contain the blast radius.** Reserved concurrency on the write functions stops a runaway client from starving the rest of the account.

---

## 6. Observability

### 6.1 Distributed tracing with X-Ray

Tracing is enabled on the API Gateway stage and active tracing on both Lambda functions. X-Ray builds a service map, and each trace shows where the time went:

- API Gateway integration latency
- Lambda **initialization** (cold start) versus execution
- each individual DynamoDB call

The user's `sub` is also added as a trace _annotation_, so I can search for the traces behind a specific user's bug report.

### 6.2 Metrics and alarms

| Signal                                         | Why it will be watch it               |
| ---------------------------------------------- | ------------------------------------- |
| API Gateway `5XXError`, `4XXError`, `Latency`  | Overall health and client mistakes    |
| API Gateway `CacheHitCount` / `CacheMissCount` | Is the cache earning its keep?        |
| WAF `BlockedRequests` per rule                 | Attack patterns, false positives      |
| Lambda `Errors`, `Throttles`, `Duration`       | Handler health                        |
| DynamoDB `ThrottledRequests`                   | Capacity or hot-partition problems    |
| Stream consumer `IteratorAge`                  | Is the async pipeline falling behind? |
| Dead-letter queue depth                        | Anything above zero needs a human     |

### 6.3 Logs

Lambda will write **structured JSON logs** that include the request id and trace id, so a CloudWatch Logs Insights query can follow a request across functions. WAF logging is enabled with sensitive headers redacted.

---

## 7. Caching and Cost Control

### 7.1 API Gateway response caching

This is the biggest lever for cutting Lambda invocations. The stage cache will be enabled only for the read-heavy `GET` methods:

- TTL of 60 seconds (the default is 300 and the maximum is 3,600)
- cache size starting at 0.5 GB
- cache key including the `Authorization` header and path parameters

That last point is the dangerous one. If the cache key does not distinguish users, user A can be served user B's cached list. Including the token in the key makes the cache effectively per-session, so the hit rate is lower, but it is safe. Writes are never cached, and TTLs stay short enough that a user who edits a to-do sees the change quickly.

### 7.2 What costs money and what doesn't

Almost everything here is pay-per-use, so an idle environment costs close to nothing. The line items that do **not** scale to zero:

- the **API Gateway cache** (billed hourly by size)
- **WAF** (per web ACL, per rule, plus request volume)
- **Bot Control**, if enabled

That is a deliberate trade: a small fixed amount for protection and performance. I will enable the cache only after a load test shows a real hit rate: for a tiny workload it can cost more than the Lambda invocations it saves.

### 7.3 Keeping the bill flat over time

- **DynamoDB TTL** on completed to-dos older than a retention period (for example 90 days), so storage and stream traffic do not grow forever.
- **S3 lifecycle rules** on the WAF and CloudFront log bucket: transition to Infrequent Access after 30 days and expire after 90.
- **CloudWatch log retention** of 14 to 30 days.
- **A budget alarm**, so a denial-of-wallet attempt is noticed by email rather than by the invoice.

---

## 8. Testing the API

I will test in layers, from fast and local to realistic and end to end.

### 8.1 Unit tests

Handlers are tested with mocked DynamoDB (for example with `moto`). The tests check that the user id is read from claims, that conditional-write failures map to `409`, and that malformed input is rejected.

### 8.2 Authentication

I will create a test user, sign in, and call the API with and without a token. For command-line testing I enable the `USER_PASSWORD_AUTH` flow on a **test-only** app client:

```bash
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id "$CLIENT_ID" \
  --auth-parameters USERNAME="$USER",PASSWORD="$PASS" \
  --query 'AuthenticationResult.IdToken' --output text)

# No token: expect 401
curl -i https://api.example.com/api/todos

# With token: expect 200
curl -i -H "Authorization: $TOKEN" https://api.example.com/api/todos
```

Then I confirm isolation: a second user must get an empty list, and a `GET` on the first user's item id must return `404`.

### 8.3 WAF

- **Rate limit:** fire a burst from one IP (`hey` or a simple loop) and expect `403` responses once the threshold is crossed.
- **Injection:** send a request with a query string like `?q=' OR 1=1--` and confirm the managed rule blocks it, checking the WAF sampled requests to see which rule matched.
- **Origin bypass:** call the raw API Gateway URL directly and confirm it is rejected.

### 8.4 Caching

Call the same `GET` twice within the TTL and compare. In CloudWatch, `CacheHitCount` should increase, and in X-Ray the second request should show no Lambda segment at all, the clearest proof that the cache worked.

---
