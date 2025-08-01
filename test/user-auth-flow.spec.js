const request = require("supertest");
const { expect } = require("chai");

// We'll test against the actual running server
// This assumes the server is running on localhost:3001
const serverUrl = "http://localhost:3001";

describe("User Authentication Flow", () => {
  let userToken;
  let userId;

  after(async () => {
    // Clean up test data if needed
    // You might want to add cleanup logic here
  });

  describe("Scenario 1: Guest clicks Join Table", () => {
    it("should allow guest to pick avatar/name and save to DB", async () => {
      const response = await request(serverUrl)
        .post("/api/auth/guest")
        .send({
          name: "TestGuest",
          avatarId: "Monk",
        })
        .expect(200);

      expect(response.body).to.have.property("userId");
      expect(response.body).to.have.property("token");
      expect(response.body.user).to.have.property("name", "TestGuest");
      expect(response.body.user).to.have.property("avatar", "Monk");

      // Store for next tests
      userToken = response.body.token;
      userId = response.body.userId;
    });

    it("should require both name and avatarId", async () => {
      await request(serverUrl)
        .post("/api/auth/guest")
        .send({ name: "TestUser" }) // Missing avatarId
        .expect(400);

      await request(serverUrl)
        .post("/api/auth/guest")
        .send({ avatarId: "Monk" }) // Missing name
        .expect(400);
    });
  });

  describe("Scenario 2 & 3: Profile check for navigation", () => {
    it("should return complete profile for authenticated user (skip avatar selection)", async () => {
      const response = await request(serverUrl)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property("isGuest", false);
      expect(response.body).to.have.property("name", "TestGuest");
      expect(response.body).to.have.property("avatarId", "Monk");

      // Client should navigate to homepage, not avatar selection
      const shouldGoToHomepage =
        !response.body.isGuest &&
        !!response.body.name &&
        !!response.body.avatarId;
      expect(shouldGoToHomepage).to.be.true;
    });

    it("should return guest status for unauthenticated users (show avatar selection)", async () => {
      const response = await request(serverUrl)
        .get("/api/auth/profile")
        .expect(200);

      expect(response.body).to.have.property("isGuest", true);
      expect(response.body).to.have.property("user", null);

      // Client should show avatar selection for guests
      const shouldShowAvatarSelection = response.body.isGuest;
      expect(shouldShowAvatarSelection).to.be.true;
    });

    it("should handle invalid tokens gracefully", async () => {
      const response = await request(serverUrl)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid-token")
        .expect(200);

      expect(response.body).to.have.property("isGuest", true);
      expect(response.body).to.have.property("user", null);
    });
  });
});
