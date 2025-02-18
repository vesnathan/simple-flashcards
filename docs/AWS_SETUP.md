# AWS Credentials Setup

Before deploying, you need to configure your AWS credentials:

1. Install AWS CLI:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

2. Configure AWS credentials:
```bash
aws configure --profile flashcards-dev
```

Enter the following:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: ap-southeast-2
- Default output format: json

3. Verify configuration:
```bash
aws sts get-caller-identity --profile flashcards-dev
```

4. Create a .env file in the backend directory:
```bash
cp .env.example .env
```

5. Update environment variables as needed.

Now you can run:
```bash
yarn be:deploy:dev
```
