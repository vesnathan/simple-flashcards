# Backend Deployment Instructions

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure AWS credentials:
```bash
# Configure AWS CLI
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="ap-southeast-2"
```

3. Build and deploy:
```bash
npm run build
npm run deploy
```

## AWS Setup

1. Create an IAM user with the following permissions:
   - AmazonDynamoDBFullAccess
   - AWSLambda_FullAccess
   - AmazonAPIGatewayAdministrator

2. Create your AWS credentials file:
```bash
mkdir -p ~/.aws
cp .aws/credentials.example ~/.aws/credentials
```

3. Edit ~/.aws/credentials with your AWS credentials:
```ini
[flashcards-dev]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key
region = ap-southeast-2
```

4. Verify configuration:
```bash
aws sts get-caller-identity --profile flashcards-dev
```

## Infrastructure Components

- DynamoDB table for storing decks and cards
- Lambda functions for API handlers
- API Gateway for REST API
- CloudFront distribution for content delivery

## Development

- Build Lambda functions: `npm run build`
- Deploy infrastructure: `npm run deploy`
- Start local development: `npm start`
