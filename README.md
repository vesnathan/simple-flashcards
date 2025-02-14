# Simple Flashcards

Internal flashcard application for creating and managing study materials.

## Setup

```bash
yarn install
```

## Development

```bash
# Start the development server
yarn dev

# Deploy backend
cd backend
yarn deploy
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
# AWS Configuration
AWS_REGION=ap-southeast-2            # Your AWS region
AWS_ACCESS_KEY_ID=your-access-key    # Your AWS access key
AWS_SECRET_ACCESS_KEY=your-secret-key # Your AWS secret key

# API Configuration
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.ap-southeast-2.amazonaws.com/dev

# Stage
STAGE=dev                            # Environment stage (dev, prod, etc.)
```

## Private Repository

This is a private repository. Do not share or distribute the code without permission.
