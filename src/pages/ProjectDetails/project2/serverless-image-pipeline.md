# Building a Serverless Image Processing Pipeline with S3, SQS, Lambda & Step Functions

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Component Deep Dive](#3-component-deep-dive)
   - [3.1 Amazon S3: source and destination buckets](#31-amazon-s3-source-and-destination-buckets)
   - [3.2 API Gateway + Lambda: pre-signed URL endpoint](#32-api-gateway--lambda-pre-signed-url-endpoint)
   - [3.3 Amazon SQS and the dead-letter queue](#33-amazon-sqs-and-the-dead-letter-queue)
   - [3.4 Lambda: dispatcher](#34-lambda-dispatcher)
   - [3.5 AWS Step Functions: the workflow](#35-aws-step-functions-the-workflow)
   - [3.6 Lambda functions and Lambda Layers](#36-lambda-functions-and-lambda-layers)
   - [3.7 Amazon DynamoDB: metadata store](#37-amazon-dynamodb-metadata-store)
   - [3.8 Amazon CloudFront: global delivery](#38-amazon-cloudfront-global-delivery)
   - [3.9 Amazon SNS: notifications](#39-amazon-sns-notifications)
4. [Security](#4-security)
5. [Reliability and Error Handling](#5-reliability-and-error-handling)
6. [Observability](#6-observability)
7. [S3 Lifecycle Policies and Cost Control](#7-s3-lifecycle-policies-and-cost-control)
8. [Testing](#8-testing-the-pipeline)
9. [Possible Extensions](#9-possible-extensions)

---

## 1. Overview

Every product that accepts user images (e-commerce, social apps, CMS platforms, marketplaces) eventually needs the same thing: take whatever the user uploaded, validate it, produce several optimized variants, protect it with a watermark, store it, and serve it fast anywhere in the world.

The traditional answer is a fleet of EC2 instances running a worker process. That means patching, scaling policies, idle capacity and on-call pain. In this project we build the same capability **serverless**: we pay only when images are processed, and the platform scales from zero to thousands of concurrent uploads automatically.

**What we will build**

1. A client requests a **pre-signed URL** from API Gateway and uploads straight to S3.
2. The S3 upload publishes an event to **SQS**.
3. A Lambda function consumes the queue and starts a **Step Functions** workflow.
4. The workflow runs **validate → resize → watermark → store** using Lambda functions with an image library packaged in a **Lambda Layer**.
5. Results land in a **destination S3 bucket**; metadata lands in **DynamoDB**.
6. **CloudFront** serves processed images globally.
7. **SNS** notifies on success or failure.

---

## 2. Architecture Overview

![Solution Architecture](Serverless%20Image%20Processing%20Pipeline.png)

### 2.1 End-to-end flow

| #   | Step           | Service                     | What happens                                                                                 |
| --- | -------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Request upload | API Gateway + Lambda        | Client calls `POST /uploads`: Lambda returns a pre-signed S3 `PUT` URL                       |
| 2   | Upload         | S3 (source)                 | Client uploads directly to S3 with the pre-signed URL                                        |
| 3   | Event          | S3 → SQS                    | `s3:ObjectCreated:*` notification is delivered to the processing queue                       |
| 4   | Buffer         | SQS (+ DLQ)                 | Messages wait in the queue: failed messages are retried, then moved to the dead-letter queue |
| 5   | Dispatch       | Lambda (dispatcher)         | Event source mapping polls SQS in batches and starts one Step Functions execution per image  |
| 6   | Orchestrate    | Step Functions (Standard)   | Validate → Resize (thumbnail, full-resolution) → Watermark → Store                           |
| 7   | Persist        | S3 (destination) + DynamoDB | Variants saved to destination bucket: metadata and status updated                            |
| 8   | Notify         | SNS                         | Success or failure message published to subscribers                                          |
| 9   | Deliver        | CloudFront                  | Processed images served from edge locations through Origin Access Control                    |

### 2.2 Why this shape?

- **Direct-to-S3 uploads** keep large payloads out of API Gateway (10 MB payload limit) and Lambda, and make uploads cheap and fast.
- **SQS between S3 and compute** absorbs traffic spikes and gives us retries and a dead-letter queue for failed queues.
- **Step Functions instead of a monolithic Lambda** makes each step independently retryable, observable and replaceable, and avoids the 15-minute Lambda limit becoming a design constraint.
- **Separate source and destination buckets** prevent the classic infinite loop where a processed output re-triggers the pipeline.

---

## 3. Component Deep Dive

### 3.1 Amazon S3: source and destination buckets

**Source bucket** (`img-pipeline-source-<account>-<region>`)

- Private, with **Block Public Access** enabled
- Default encryption (SSE-S3 or SSE-KMS)
- CORS configured so browsers can `PUT` with pre-signed URLs
- Event notification: `s3:ObjectCreated:*` on prefix `uploads/` → SQS queue
- Lifecycle rule: expire raw uploads after 30 days (they are only needed until processing succeeds)

**Destination bucket** (`img-pipeline-dest-<account>-<region>`)

- Private: the only reader is CloudFront (via Origin Access Control)
- Key layout: `processed/{imageId}/thumbnail.webp`, `processed/{imageId}/image.webp`
- Lifecycle rules (see section 7)

**Bucket policy for the destination bucket (CloudFront OAC only):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAC",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::img-pipeline-dest-ACCOUNT-REGION/processed/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

### 3.2 API Gateway + Lambda: pre-signed URL endpoint

A small HTTP API exposes `POST /uploads`. The Lambda behind it:

1. Validates the requested content type (`image/jpeg`, `image/png`, `image/webp`) and declared size
2. Generates an `imageId` (UUID)
3. Creates a pre-signed `PUT` URL (5-minute expiry) for `uploads/{imageId}`
4. Writes a `PENDING` item to DynamoDB
5. Returns `{ imageId, uploadUrl }`

```python
import json, os, uuid, time, boto3

s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb").Table(os.environ["TABLE"])
BUCKET = os.environ["SOURCE_BUCKET"]
ALLOWED = {"image/jpeg", "image/png", "image/webp"}

def handler(event, _ctx):
    body = json.loads(event.get("body") or "{}")
    content_type = body.get("contentType")
    if content_type not in ALLOWED:
        return {"statusCode": 400, "body": json.dumps({"error": "unsupported type"})}

    image_id = str(uuid.uuid4())
    key = f"uploads/{image_id}"

    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    ddb.put_item(Item={
        "imageId": image_id,
        "status": "PENDING",
        "sourceKey": key,
        "createdAt": int(time.time()),
    })
    return {"statusCode": 200,
            "body": json.dumps({"imageId": image_id, "uploadUrl": url})}
```

Consider adding a JWT authorizer (Cognito or any OIDC provider) and throttling on the API stage.

### 3.3 Amazon SQS and the dead-letter queue

| Setting            | Value                            | Why                                                                           |
| ------------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| Queue type         | Standard                         | High throughput: the processing is idempotent                                 |
| Visibility timeout | 6× the dispatcher Lambda timeout | AWS recommendation, so messages are not redelivered while still being handled |
| Message retention  | 4 days                           | Time to recover from an outage                                                |
| Redrive policy     | `maxReceiveCount = 3` → DLQ      | Poison messages stop blocking the queue                                       |
| DLQ retention      | 14 days                          | Time to investigate and redrive                                               |
| Encryption         | SSE-SQS                          | Encryption at rest                                                            |

### 3.4 Lambda: dispatcher

The dispatcher is deliberately tiny. It parses S3 event records from the SQS batch and starts a Step Functions execution for each one.

```python
import json, os, boto3
from urllib.parse import unquote_plus

sfn = boto3.client("stepfunctions")
STATE_MACHINE = os.environ["STATE_MACHINE_ARN"]

def handler(event, _ctx):
    failures = []
    for record in event["Records"]:
        try:
            s3_event = json.loads(record["body"])
            for r in s3_event.get("Records", []):
                key = unquote_plus(r["s3"]["object"]["key"])
                image_id = key.split("/")[-1]
                sfn.start_execution(
                    stateMachineArn=STATE_MACHINE,
                    name=image_id,
                    input=json.dumps({
                        "imageId": image_id,
                        "bucket": r["s3"]["bucket"]["name"],
                        "key": key,
                    }),
                )
        except sfn.exceptions.ExecutionAlreadyExists:
            continue
        except Exception:
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
```

Enable **`ReportBatchItemFailures`** on the event source mapping so only the failing messages return to the queue, not the whole batch.

### 3.5 AWS Step Functions: the workflow

We use a **Standard** workflow (auditable, up to one year duration, exactly-once execution semantics) rather than Express, since each image is a discrete business job that we want to inspect in the execution history.

```
Validate ──► Resize (Parallel: thumbnail and full-resolution) ──► Watermark ──► Store & Update Metadata ──► NotifySuccess
   │                    │                                    │                    │
   └────────────────────┴──────────── Catch ─────────────────┴────────────────────┴──► MarkFailed ──► NotifyFailure
```

Amazon States Language (abridged):

```json
{
  "Comment": "Image processing workflow",
  "StartAt": "Validate",
  "States": {
    "Validate": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName": "${ValidateFn}", "Payload.$": "$" },
      "ResultSelector": { "validation.$": "$.Payload" },
      "ResultPath": "$.validate",
      "Retry": [
        {
          "ErrorEquals": [
            "Lambda.ServiceException",
            "Lambda.TooManyRequestsException"
          ],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "MarkFailed"
        }
      ],
      "Next": "Resize"
    },
    "Resize": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "Thumbnail",
          "States": {
            "Thumbnail": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${ResizeFn}",
                "Payload": { "variant": "thumb", "width": 300, "input.$": "$" }
              },
              "End": true
            }
          }
        },
        {
          "StartAt": "FullResolution",
          "States": {
            "FullResolution": {
              "Type": "Task",
              "Resource": "arn:aws:states:::lambda:invoke",
              "Parameters": {
                "FunctionName": "${ResizeFn}",
                "Payload": { "variant": "full", "width": 1920, "input.$": "$" }
              },
              "End": true
            }
          }
        }
      ],
      "ResultPath": "$.resize",
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "MarkFailed"
        }
      ],
      "Next": "Watermark"
    },
    "Watermark": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "...": "...",
      "Next": "Store"
    },
    "Store": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "...": "...",
      "Next": "NotifySuccess"
    },
    "NotifySuccess": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sns:publish",
      "...": "...",
      "End": true
    },
    "MarkFailed": {
      "Type": "Task",
      "Resource": "arn:aws:states:::dynamodb:updateItem",
      "...": "...",
      "Next": "NotifyFailure"
    },
    "NotifyFailure": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sns:publish",
      "...": "...",
      "End": true
    }
  }
}
```

Key design points:

- **Retry** handles transient Lambda errors with exponential backoff; **Catch** routes permanent errors to a single failure path.
- **Parallel** state creates the thumbnail and full-resolution variants concurrently, cutting latency.
- **Direct service integrations** (DynamoDB, SNS) remove the need for glue Lambdas.
- An optional **metadata-extraction** branch (EXIF, dimensions, dominant colors) can be added to the Parallel state with no change to the rest of the flow.

### 3.6 Lambda functions and Lambda Layers

| Function    | Responsibility                                                    |
| ----------- | ----------------------------------------------------------------- |
| `validate`  | Check bytes, max dimensions, max file size, reject corrupt images |
| `resize`    | Resize to requested width keeping aspect ratio, convert to WebP   |
| `watermark` | Overlay a semi-transparent logo or text                           |
| `store`     | Final copy and tagging if not done in prior steps                 |

**Why a Layer?** Pillow (Python) or Sharp (Node.js) include native binaries that are far larger than your own code. Packaging them as a **Lambda Layer**:

- keeps function deployment packages small and deploys fast,
- lets several functions (`validate`, `resize`, `watermark`) share the exact same library version.
- lets you update the library independently of business logic.

### 3.7 Amazon DynamoDB: metadata store

| Attribute                  | Type           | Example                                           |
| -------------------------- | -------------- | ------------------------------------------------- |
| `imageId` (PK)             | String         | `7c1f…`                                           |
| `status`                   | String         | `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` |
| `createdAt`                | Number         | epoch seconds                                     |
| `sourceKey`                | String         | `uploads/7c1f…`                                   |
| `variants`                 | Map            | `{ thumb: {key, width, height}, full: {...} }`    |
| `sizeBytes`, `contentType` | Number, String |                                                   |
| `errorMessage`             | String         | only on failure                                   |
| `ttl`                      | Number         | optional expiry for failed/stale records          |

### 3.8 Amazon CloudFront: global delivery

- **Origin**: destination S3 bucket via **Origin Access Control (OAC)**; the bucket stays private
- **Cache behavior** for `/processed/*`:
  - Viewer protocol: redirect HTTP → HTTPS
  - Allowed methods: `GET`, `HEAD`
  - Cache policy: `CachingOptimized` (or custom with long TTL (1 year) since keys contain the unique `imageId` and never change)
  - Compression enabled (Brotli/Gzip)
  - Response headers policy: `Cache-Control: public, max-age=31536000, immutable`
- **Origin Shield** (optional) in the region of the bucket to cut origin requests
- **Price class**: choose `PriceClass_100` or `200` if your audience is regional

### 3.9 Amazon SNS: notifications

One topic `image-pipeline-events` with message attributes `eventType = completed | failed`.

Subscriptions can include:

- Email for ops (filtered on `eventType = failed`)
- An HTTPS webhook or another SQS queue for the application backend (filtered on `completed`)
- A Lambda that posts to Slack

---

## 4. Security

| Area         | Practice                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| IAM          | One role per function, least privilege (`resize` can `GetObject` on source/`uploads/*` and `PutObject` on destination/`work/*` only) |
| Buckets      | Block Public Access on, destination readable only by CloudFront OAC, enforce TLS with a `aws:SecureTransport` deny statement         |
| Encryption   | SSE-S3 or SSE-KMS on buckets, SSE on SQS, encryption at rest on DynamoDB                                                             |
| Uploads      | Short-lived pre-signed URLs, content-type and size conditions, optional `PresignedPost` with `content-length-range`                  |
| Validation   | Verify file signature server-side                                                                                                    |
| Queue policy | Allow `sqs:SendMessage` only from the source bucket ARN and account (`aws:SourceArn`, `aws:SourceAccount`)                           |
| API          | Authorizer, throttling, add WAF on the API stage and on CloudFront                                                                   |
| Logging      | CloudTrail data events for sensitive buckets, S3 server access or CloudFront logs                                                    |

---

## 5. Reliability and Error Handling

1. **Transient failures**: Step Functions `Retry` with exponential backoff.
2. **Dispatch failures**: SQS redelivers after the visibility timeout; after 3 receives the message goes to the DLQ.
3. **Permanent failures** (corrupt image): `Catch` → `MarkFailed` → SNS failure notification; the raw file stays available for investigation until its lifecycle expiry.
4. **Idempotency**: execution `name = imageId` makes duplicate SQS deliveries harmless; S3 writes use deterministic keys.
5. **Back-pressure**: set **reserved concurrency** or the event source mapping's **maximum concurrency** on the dispatcher to protect downstream limits.
6. **Monitoring**: CloudWatch alarms on DLQ depth, Step Functions `ExecutionsFailed`, Lambda `Errors` and `Throttles`, and queue age (`ApproximateAgeOfOldestMessage`).

---

## 6. Observability

- **Structured JSON logs** (include `imageId` in every line) using Powertools for AWS Lambda
- **X-Ray tracing** enabled on API Gateway, Lambda and Step Functions for end-to-end latency breakdown
- **Step Functions execution history** gives a visual, step-by-step replay of every image
- A **CloudWatch dashboard**: uploads per minute, queue depth, execution success rate, p95 processing time, CloudFront cache hit ratio

---

## 7. S3 Lifecycle Policies and Cost Control

**Source bucket**

```json
{
  "Rules": [
    {
      "ID": "expire-raw-uploads",
      "Filter": { "Prefix": "uploads/" },
      "Status": "Enabled",
      "Expiration": { "Days": 30 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 2 }
    }
  ]
}
```

**Destination bucket**

```json
{
  "Rules": [
    {
      "ID": "tier-processed-images",
      "Filter": { "Prefix": "processed/" },
      "Status": "Enabled",
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 180, "StorageClass": "GLACIER_IR" }
      ]
    },
    {
      "ID": "clean-work-area",
      "Filter": { "Prefix": "work/" },
      "Status": "Enabled",
      "Expiration": { "Days": 1 }
    }
  ]
}
```

Notes:

- Standard-IA has a 30-day minimum and 128 KB minimum billable object size
- If access patterns are unknown, **S3 Intelligent-Tiering** avoids guessing.

---

## 8. Testing the Pipeline

1. **Unit tests** for `validate`, `resize`, `watermark` using small fixture images.
2. **Local invocation** with `sam local invoke` and sample S3/SQS event JSON.
3. **Integration test**: call `POST /uploads`, `PUT` a test image to the returned URL, poll DynamoDB until `COMPLETED`, then `GET` the CloudFront URL and assert dimensions.
4. **Failure tests**: upload a text file renamed to `.jpg` and confirm it ends in `FAILED` with an SNS message; temporarily break the dispatcher and confirm messages reach the DLQ after three attempts.
5. **Load test** with a few thousand uploads to observe queue buffering and Lambda concurrency scaling.

---

## 9. Possible Extensions

- Content moderation with **Amazon Rekognition** as an extra Parallel branch
- Multi-region replication of the destination bucket for disaster recovery
- Event-driven webhooks to notify your application when `COMPLETED`

---
