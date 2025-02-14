export const env = {
  // ...existing code...
  api: {
    baseUrl:
      process.env.NEXT_PUBLIC_API_URL ||
      "https://[your-api-id].execute-api.[region].amazonaws.com/prod",
  },
  // ...existing code...
};
