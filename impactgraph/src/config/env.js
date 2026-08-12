import "dotenv/config";

const required = ["COGNODB_URI", "COGNODB_USERNAME", "COGNODB_PASSWORD"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not set.`);
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  uri: process.env.COGNODB_URI,
  username: process.env.COGNODB_USERNAME || "cognodb",
  password: process.env.COGNODB_PASSWORD
};
