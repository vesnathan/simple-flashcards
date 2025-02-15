/* eslint-disable no-console */
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";

import { CONFIG } from "../config/aws";

const ddb = DynamoDBDocument.from(
  new DynamoDBClient({
    region: "ap-southeast-2",
    profile: "flashcards-dev",
  }),
);

export const dynamodbService = {
  async getAllDecks() {
    const result = await ddb.scan({
      TableName: CONFIG.DECKS_TABLE,
    });

    return result.Items || [];
  },

  async getDeckById(id: string) {
    const result = await ddb.get({
      TableName: CONFIG.DECKS_TABLE,
      Key: { id },
    });

    return result.Item;
  },

  async waitForTable() {
    const client = new DynamoDBClient({
      region: "ap-southeast-2",
      profile: "flashcards-dev",
    });

    console.log(`Waiting for table ${CONFIG.DECKS_TABLE} to be active...`);

    while (true) {
      const { Table } = await client.send(
        new DescribeTableCommand({ TableName: CONFIG.DECKS_TABLE }),
      );

      if (Table?.TableStatus === "ACTIVE") {
        console.log("Table is now active");

        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
  },

  async createTable(): Promise<boolean> {
    const client = new DynamoDBClient({
      region: "ap-southeast-2",
      profile: "flashcards-dev",
    });

    try {
      // Check if table exists
      await client.send(
        new DescribeTableCommand({ TableName: CONFIG.DECKS_TABLE }),
      );
      console.log(`Table ${CONFIG.DECKS_TABLE} already exists`);

      return false;
    } catch (error: any) {
      if (error.name !== "ResourceNotFoundException") {
        throw error;
      }
    }

    // Create table if it doesn't exist
    await client.send(
      new CreateTableCommand({
        TableName: CONFIG.DECKS_TABLE,
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    console.log(`Table ${CONFIG.DECKS_TABLE} created successfully`);
    await this.waitForTable();

    return true;
  },
};
