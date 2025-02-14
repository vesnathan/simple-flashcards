# Simple Flashcards

A serverless flashcard application built with Next.js, DynamoDB, and AWS Lambda.

## Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS IAM user with appropriate permissions
- Yarn package manager

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/simple-flashcards.git
cd simple-flashcards
```

2. Install dependencies
```bash
# Install backend dependencies
cd backend
yarn install

# Install frontend dependencies
cd ../frontend
yarn install
```

3. Set up AWS IAM and Credentials
```bash
# Create IAM user (in AWS Console)
1. Go to AWS IAM Console
2. Click "Users" > "Add user"
3. Set username: flashcards-dev
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"
6. Click "Create inline policy"
7. Switch to JSON editor and paste the following policy:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:PutRolePolicy",
        "iam:DeleteRole",
        "iam:DeleteRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::*:role/flashcards-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:DeleteFunction",
        "lambda:ListFunctions",
        "lambda:AddPermission"
      ],
      "Resource": "arn:aws:lambda:*:*:function:flashcards-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:ListTables",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/flashcards-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE"
      ],
      "Resource": "arn:aws:apigateway:*::/apis/flashcards-*"
    }
  ]
}
8. Name the policy "flashcards-dev-policy"
9. Click "Create policy"
10. Click "Next: Tags" > "Next: Review" > "Create user"
11. IMPORTANT: Save the Access key ID and Secret access key

# Configure AWS credentials
mkdir -p ~/.aws
touch ~/.aws/credentials ~/.aws/config

# Add to ~/.aws/credentials
[flashcards-dev]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY

# Add to ~/.aws/config
[profile flashcards-dev]
region = ap-southeast-2
output = json

# Set proper permissions
chmod 600 ~/.aws/credentials

# Verify configuration
aws configure list --profile flashcards-dev
```

4. Set up environment variables
```bash
# Copy example env files
cp .env.example .env
```

## Available Commands

### Backend

```bash
# Build the Lambda functions
yarn build

# Deploy to dev environment
yarn deploy:dev

# Deploy to production
yarn deploy:prod

# Seed the database
yarn seed

# Clean up dev environment
yarn cleanup:dev

# Clean up production environment
yarn cleanup:prod
```

### Frontend

```bash
# Start development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

## Project Structure

```
simple-flashcards/
├── backend/
│   ├── src/
│   │   ├── handlers/     # Lambda function handlers
│   │   ├── services/     # Shared services
│   │   └── scripts/      # Deployment and utility scripts
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/        # Next.js pages
    │   ├── services/     # API services
    │   └── types/        # TypeScript types
    └── package.json
```

## API Endpoints

- `GET /decks` - List all flashcard decks
- `GET /decks/:id` - Get a specific deck
- More endpoints coming soon...

## AWS Resources

The application creates and manages the following AWS resources:

- DynamoDB table for storing decks
- Lambda functions for API handlers
- API Gateway for REST endpoints
- IAM roles and policies

## Development Workflow

1. Make changes to the code
2. Build the Lambda functions: `yarn build`
3. Deploy to dev: `yarn deploy:dev`
4. Test the changes
5. When ready, deploy to prod: `yarn deploy:prod`

## Cleanup

To remove all AWS resources:

```bash
# Development environment
yarn cleanup:dev

# Production environment
yarn cleanup:prod
```

## License

MIT
