# AWS architecture review — Cloud Finance Platform

## Verdict on the original diagram

The original picture is visually organized, but it mixes the current implementation with a future-state wishlist. It therefore cannot be used as a deployment blueprint without correction.

### Keep
- CloudFront + WAF + private S3 for the React/Vite SPA.
- ECS/Fargate for the Python microservices.
- RDS PostgreSQL, Redis, ECR, CloudWatch, Secrets Manager/KMS, and CI/CD.
- Two-AZ deployment and database-per-service boundaries.

### Replace or remove
- Replace API Gateway with an internet-facing Application Load Balancer. The repository already has a FastAPI gateway and Socket.IO mounted at `/ws`; ALB and CloudFront can forward both HTTP and WebSocket traffic to that gateway.
- Remove Cognito from the current-state diagram. Authentication, OTP, JWT, and user persistence are implemented by `Auth Service`.
- Remove Bedrock from the current-state diagram. The AI service currently calls Gemini and can optionally interact with Dify. Bedrock is a migration option, not a deployed dependency.
- Remove Lambda OCR, Lambda connection manager, and the generic Lambda event block. OCR is a Tesseract container service and uploads are currently stored on a shared local path.
- Replace the drawn SQS dependency with ElastiCache for Redis because the notification worker uses Redis/RQ today. SQS is a valid future refactor, not a code-aligned component.
- Do not show EventBridge, SNS, or SES as active dependencies unless their integration is implemented. Email currently uses SMTP; SES is the recommended AWS replacement.
- Do not connect clients directly to service APIs. All `/api/v1/*` requests route through the FastAPI gateway.

## Deployable target

1. The demo uses the generated CloudFront domain directly. Route 53 is optional when a custom domain is added.
2. AWS WAF protects CloudFront.
3. CloudFront uses two origins:
   - private S3 bucket through Origin Access Control for the SPA;
   - public ALB for `/api/*` and `/ws/*` behaviors.
4. ALB forwards only to the ECS Gateway service. Other ECS services remain private and are resolved by Cloud Map.
5. ECS tasks run in private application subnets across at least two Availability Zones. NAT gateways or VPC endpoints provide ECR, Secrets Manager, CloudWatch, and external LLM access.
6. PostgreSQL and Redis run in private data subnets. The demo currently uses Single-AZ RDS and a single Redis primary; production should enable Multi-AZ and automatic failover. Security groups allow access only from ECS.
7. A private S3 receipts/exports bucket is provisioned, but the current OCR code still uses local file handling. S3 application integration through an ECS task role remains pending.
8. GitHub Actions authenticates to AWS with OIDC, pushes images to ECR, and deploys ECS services.

## Database decision

The current demo uses one Single-AZ RDS PostgreSQL instance with separate logical databases and credentials per service. For production, upgrade the shared instance to Multi-AZ. The existing environment already exposes separate `*_DB_URL` values, so services remain logically isolated. For strict blast-radius, scaling, or compliance requirements, split high-value domains into separate RDS deployments later.

## Kafka decision

Kafka is present in Compose and Finance/Planning contain producer/consumer hooks. Do not place Amazon MSK on the baseline diagram until the event contracts are enabled and required in production. If activated, add Amazon MSK in private data subnets and connect only the producing/consuming services.

## Required code/deployment work before AWS

- Integrate the provisioned private S3 receipts bucket and replace local filesystem uploads.
- Add ECS task definitions, health checks, Cloud Map names, IAM task roles, and autoscaling policies.
- Add infrastructure as code for VPC, subnets, ALB, ECS, RDS, Redis, CloudFront, WAF, S3, ECR, CloudWatch, KMS, and Secrets Manager.
- Replace static service URLs with Cloud Map DNS names.
- The application currently reaches Amazon SES through its SMTP endpoint over TLS; keep the credentials in Secrets Manager and complete SES production-access requirements.
- Configure CloudFront behaviors to disable caching for API and WebSocket paths.
- Store secrets outside `.env`; rotate the exposed AI API credential.
- Add database migrations as a controlled deployment step.

## Diagram conventions used

- Official AWS4 resource icons in Draw.io.
- AWS Cloud, Region/VPC, Availability Zone, and subnet boundaries are explicit.
- Directional connectors represent request or dependency direction.
- Solid blue: internet HTTPS; solid black: internal synchronous/database traffic; dashed orange: async/deployment; dashed green: external integration.
- Only components that exist in code or are explicitly required to make the current code deployable are included.