import { 
  CreateTableCommand, 
  KeyType, 
  ProjectionType, 
  ScalarAttributeType,
  BillingMode
} from "@aws-sdk/client-dynamodb";
import { dynamoDB, CONFIG } from "./config/aws";

async function createDynamoDBTable() {
  const params = {
    TableName: CONFIG.DECKS_TABLE,
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: ScalarAttributeType.S },
      { AttributeName: "userId", AttributeType: ScalarAttributeType.S },
      { AttributeName: "isPublic", AttributeType: ScalarAttributeType.S },
      { AttributeName: "createdAt", AttributeType: ScalarAttributeType.S }
    ],
    KeySchema: [
      { AttributeName: "id", KeyType: KeyType.HASH },
      { AttributeName: "userId", KeyType: KeyType.RANGE }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "PublicDecksIndex",
        KeySchema: [
          { AttributeName: "isPublic", KeyType: KeyType.HASH },
          { AttributeName: "createdAt", KeyType: KeyType.RANGE }
        ],
        Projection: { ProjectionType: ProjectionType.ALL }
      }
    ],
    BillingMode: BillingMode.PAY_PER_REQUEST
  };

  try {
    await dynamoDB.send(new CreateTableCommand(params));
    console.log("DynamoDB table created successfully");
  } catch (error) {
    console.error("Error creating DynamoDB table:", error);
  }
}

async function deploy() {
  await createDynamoDBTable();
  // Add other deployment steps here (Lambda, API Gateway, etc.)
}

deploy().catch(console.error);
