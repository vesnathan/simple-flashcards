/* eslint-disable no-console */
import {
  CloudWatchLogsClient,
  DeleteLogGroupCommand,
  DescribeLogGroupsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  APIGatewayClient,
  DeleteRestApiCommand,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";
import {
  LambdaClient,
  DeleteFunctionCommand,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import {
  IAMClient,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  ListRolePoliciesCommand,
  ListRolesCommand,
} from "@aws-sdk/client-iam";

import { CONFIG } from "../config/aws";

const cloudWatchLogs = new CloudWatchLogsClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

const apiGateway = new APIGatewayClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

const lambda = new LambdaClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

const iam = new IAMClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

export const cleanupService = {
  async deleteLogGroups() {
    try {
      // List all log groups for this stage
      const { logGroups } = await cloudWatchLogs.send(
        new DescribeLogGroupsCommand({
          logGroupNamePrefix: `/aws/flashcards-${CONFIG.STAGE}`,
        }),
      );

      for (const group of logGroups || []) {
        if (group.logGroupName) {
          await cloudWatchLogs.send(
            new DeleteLogGroupCommand({ logGroupName: group.logGroupName }),
          );
          console.log(`Deleted log group: ${group.logGroupName}`);
        }
      }

      // Also cleanup API Gateway logs
      const apiLogGroupName = `/aws/apigateway/flashcards-${CONFIG.STAGE}`;

      await cloudWatchLogs.send(
        new DeleteLogGroupCommand({ logGroupName: apiLogGroupName }),
      );
      console.log(`Deleted API Gateway log group: ${apiLogGroupName}`);
    } catch (error: any) {
      if (error.name !== "ResourceNotFoundException") {
        console.error("Failed to delete log groups:", error);
      }
    }
  },

  async deleteApiGateway() {
    try {
      const apis = await apiGateway.send(new GetRestApisCommand({}));
      const api = apis.items?.find(
        (api) => api.name === `flashcards-${CONFIG.STAGE}-api`,
      );

      if (api?.id) {
        await apiGateway.send(new DeleteRestApiCommand({ restApiId: api.id }));
        console.log("Deleted API Gateway");
      }
    } catch (error) {
      console.error("Failed to delete API Gateway:", error);
    }
  },

  async deleteLambdaFunctions() {
    try {
      const { Functions } = await lambda.send(new ListFunctionsCommand({}));
      const stageFunctions = Functions?.filter((fn) =>
        fn.FunctionName?.startsWith(`flashcards-${CONFIG.STAGE}-`),
      );

      for (const fn of stageFunctions || []) {
        if (fn.FunctionName) {
          await lambda.send(
            new DeleteFunctionCommand({ FunctionName: fn.FunctionName }),
          );
          console.log(`Deleted Lambda function: ${fn.FunctionName}`);
        }
      }
    } catch (error) {
      console.error("Failed to delete Lambda functions:", error);
    }
  },

  async deleteIamRoles() {
    try {
      const { Roles } = await iam.send(new ListRolesCommand({}));
      const stageRoles = Roles?.filter((role) =>
        role.RoleName?.startsWith(`flashcards-${CONFIG.STAGE}-`),
      );

      for (const role of stageRoles || []) {
        if (role.RoleName) {
          // First delete all inline policies
          const { PolicyNames } = await iam.send(
            new ListRolePoliciesCommand({ RoleName: role.RoleName }),
          );

          for (const policyName of PolicyNames || []) {
            await iam.send(
              new DeleteRolePolicyCommand({
                RoleName: role.RoleName,
                PolicyName: policyName,
              }),
            );
            console.log(
              `Deleted policy ${policyName} from role ${role.RoleName}`,
            );
          }

          // Then delete the role
          await iam.send(new DeleteRoleCommand({ RoleName: role.RoleName }));
          console.log(`Deleted IAM role: ${role.RoleName}`);
        }
      }
    } catch (error) {
      console.error("Failed to delete IAM roles:", error);
    }
  },
};
