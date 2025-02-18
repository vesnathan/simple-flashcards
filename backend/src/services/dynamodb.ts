/* eslint-disable no-console */
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

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
      // First check if table exists
      try {
        await client.send(
          new DescribeTableCommand({ TableName: CONFIG.DECKS_TABLE }),
        );
        console.log(`Table ${CONFIG.DECKS_TABLE} already exists`);

        return false;
      } catch (error: any) {
        if (error.name !== "ResourceNotFoundException") throw error;
      }

      // Table doesn't exist, create it
      await client.send(
        new CreateTableCommand({
          TableName: CONFIG.DECKS_TABLE,
          AttributeDefinitions: [
            { AttributeName: "userId", AttributeType: "S" },
            { AttributeName: "id", AttributeType: "S" },
          ],
          KeySchema: [
            { AttributeName: "userId", KeyType: "HASH" },
            { AttributeName: "id", KeyType: "RANGE" },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        }),
      );

      console.log(`Table ${CONFIG.DECKS_TABLE} created successfully`);
      await this.waitForTable();

      return true; // Indicate new table was created
    } catch (error: any) {
      console.error("Failed to create table:", error);
      throw error;
    }
  },

  async deleteTable(): Promise<void> {
    try {
      await ddb.send(
        new DeleteTableCommand({
          TableName: CONFIG.DECKS_TABLE,
        }),
      );
      console.log(`Table ${CONFIG.DECKS_TABLE} deleted successfully`);
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.log(`Table ${CONFIG.DECKS_TABLE} does not exist`);

        return;
      }
      throw error;
    }
  },

  async seedTable(): Promise<void> {
    const sampleDecks = [
      {
        id: uuidv4(),
        userId: "system",
        title: "Common English Phrases",
        isPublic: true,
        createdAt: Date.now(),
        lastModified: Date.now(),
        cards: [
          { id: 0, question: "How are you?", answer: "I'm fine, thank you." },
          {
            id: 1,
            question: "Nice to meet you",
            answer: "Nice to meet you too",
          },
        ],
      },
      {
        id: uuidv4(),
        userId: "system",
        title: "Basic Math",
        isPublic: true,
        createdAt: Date.now(),
        lastModified: Date.now(),
        cards: [
          { id: 0, question: "2 + 2", answer: "4" },
          { id: 1, question: "5 x 5", answer: "25" },
        ],
      },
    ];

    for (const deck of sampleDecks) {
      try {
        await ddb.put({
          TableName: CONFIG.DECKS_TABLE,
          Item: deck,
        });
        console.log(`Added deck: ${deck.title}`);
      } catch (error) {
        console.error(`Failed to add deck ${deck.title}:`, error);
        throw error;
      }
    }
  },
};
