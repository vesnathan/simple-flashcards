import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "../config/aws";

const ddb = DynamoDBDocument.from(new DynamoDBClient({ 
  region: "ap-southeast-2",
  profile: "flashcards-dev"
}));

const sampleDecks = [
  {
    id: uuidv4(),
    userId: "public",
    title: "Common English Phrases",
    isPublic: "true",
    createdAt: new Date().toISOString(),
    cards: [
      { id: 0, question: "How are you?", answer: "I'm fine, thank you." },
      { id: 1, question: "Nice to meet you", answer: "Nice to meet you too" }
    ]
  },
  {
    id: uuidv4(),
    userId: "public",
    title: "Basic Math",
    isPublic: "true",
    createdAt: new Date().toISOString(),
    cards: [
      { id: 0, question: "2 + 2", answer: "4" },
      { id: 1, question: "5 x 5", answer: "25" }
    ]
  }
];

async function seedDatabase() {
  try {
    for (const deck of sampleDecks) {
      try {
        await ddb.put({
          TableName: CONFIG.DECKS_TABLE,
          Item: {
            ...deck,
            id: deck.id.toString() // Ensure ID is a string
          }
        });
        console.log(`Added deck: ${deck.title}`);
      } catch (err: any) {
        console.error('Detailed error:', JSON.stringify(err, null, 2));
        throw err;
      }
    }
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
