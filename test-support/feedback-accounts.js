const { hashPassword } = require("../src/profiles/passwords");

const TEST_PASSWORD = "FeedbackFixture:123!";
const usernames = { "user-1": "reader_one", "user-2": "reader_two" };
let passwordHash;

function createTestAccounts() {
  return {
    async findCredentials(username) {
      const id = Object.keys(usernames).find((key) => usernames[key] === username);
      if (!id) return null;
      passwordHash ??= hashPassword(TEST_PASSWORD);
      return { id, username, passwordHash: await passwordHash };
    },
  };
}

function basicHeader(userId = "user-1", password = TEST_PASSWORD) {
  const credentials = usernames[userId] + ":" + password;
  return "Basic " + Buffer.from(credentials, "utf8").toString("base64");
}

module.exports = { createTestAccounts, basicHeader };
