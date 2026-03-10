const express = require("express");
const request = require("supertest");

jest.mock("../../models/user", () => {
  const User: any = jest.fn();
  User.findOne = jest.fn();
  User.find = jest.fn();
  User.findById = jest.fn();
  User.findByIdAndDelete = jest.fn();
  User.findByIdAndUpdate = jest.fn();
  return User;
});

jest.mock("../../models/swipe", () => ({
  deleteMany: jest.fn(),
}));

jest.mock("../../models/match", () => ({
  deleteMany: jest.fn(),
}));

jest.mock("../../models/message", () => ({
  deleteMany: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

jest.mock("../../services/user.service", () => ({
  getUserStats: jest.fn(),
}));

jest.mock("../../middleware/auth", () => {
  return (req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.userId = req.headers["x-user-id"] || "admin-1";
      return next();
    }
    return res.status(401).json({ message: "No token provided" });
  };
});

jest.mock("../../middleware/admin", () => {
  return (req: any, res: any, next: any) => {
    if (req.headers["x-admin"] === "true") {
      return next();
    }
    return res.status(403).json({ message: "Admin access required" });
  };
});

jest.mock("../../controller/profile_controller", () => ({
  getMe: (req: any, res: any) => res.status(200).json({ id: req.userId }),
  updateMe: (req: any, res: any) => res.status(200).json({ id: req.userId, ...req.body }),
}));

jest.mock("../../controller/photo_controller", () => ({
  uploadPhoto: (req: any, res: any) => res.status(200).json({ photos: [] }),
  deletePhoto: (req: any, res: any) => res.status(200).json({ photos: [] }),
}));

const User = require("../../models/user");
const Swipe = require("../../models/swipe");
const Match = require("../../models/match");
const Message = require("../../models/message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getUserStats } = require("../../services/user.service");

const userRoutes = require("../../routes/user_routes");

const app = express();
app.use(express.json());
app.use("/users", userRoutes);

function mockFindUsers(users: unknown[]) {
  const sort = jest.fn().mockResolvedValue(users);
  const select = jest.fn().mockReturnValue({ sort });
  User.find.mockReturnValue({ select });
}

describe("user routes integration tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    User.mockImplementation((payload: Record<string, unknown>) => ({
      _id: "new-user-id",
      role: "user",
      status: "active",
      ...payload,
      save: jest.fn().mockResolvedValue(undefined),
    }));

    bcrypt.genSalt.mockResolvedValue("salt");
    bcrypt.hash.mockResolvedValue("hashed-password");
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("jwt-token");

    Swipe.deleteMany.mockResolvedValue({ acknowledged: true });
    Match.deleteMany.mockResolvedValue({ acknowledged: true });
    Message.deleteMany.mockResolvedValue({ acknowledged: true });

    getUserStats.mockResolvedValue({ totalMatches: 1, likesReceived: 3 });
  });

  it("1. POST /users/signup returns 201 on success", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await request(app).post("/users/signup").send({
      username: "john",
      email: "john@test.com",
      password: "secret",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({ token: "jwt-token" }));
  });

  it("2. POST /users/signup returns 400 for duplicate email", async () => {
    User.findOne.mockResolvedValue({ _id: "u1" });

    const response = await request(app).post("/users/signup").send({
      username: "john",
      email: "john@test.com",
      password: "secret",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "User already exists" });
  });

  it("3. POST /users/signup returns 500 on failure", async () => {
    User.findOne.mockRejectedValue(new Error("db fail"));

    const response = await request(app).post("/users/signup").send({
      username: "john",
      email: "john@test.com",
      password: "secret",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Unable to signup" });
  });

  it("4. POST /users/login returns 400 when user does not exist", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await request(app).post("/users/login").send({
      email: "missing@test.com",
      password: "x",
    });

    expect(response.status).toBe(400);
  });

  it("5. POST /users/login returns 400 on wrong password", async () => {
    User.findOne.mockResolvedValue({ _id: "u1", password: "hashed", status: "active", role: "user" });
    bcrypt.compare.mockResolvedValue(false);

    const response = await request(app).post("/users/login").send({
      email: "john@test.com",
      password: "bad",
    });

    expect(response.status).toBe(400);
  });

  it("6. POST /users/login returns 403 for banned user", async () => {
    User.findOne.mockResolvedValue({ _id: "u1", password: "hashed", status: "banned", role: "user" });

    const response = await request(app).post("/users/login").send({
      email: "john@test.com",
      password: "secret",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Account is banned" });
  });

  it("7. POST /users/login returns 200 on success", async () => {
    User.findOne.mockResolvedValue({
      _id: "u1",
      username: "john",
      email: "john@test.com",
      password: "hashed",
      status: "active",
      role: "admin",
    });

    const response = await request(app).post("/users/login").send({
      email: "john@test.com",
      password: "secret",
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBe("jwt-token");
  });

  it("8. POST /users/login returns 500 on exception", async () => {
    User.findOne.mockRejectedValue(new Error("query fail"));

    const response = await request(app).post("/users/login").send({
      email: "john@test.com",
      password: "secret",
    });

    expect(response.status).toBe(500);
  });

  it("9. GET /users returns all users", async () => {
    mockFindUsers([{ username: "john" }]);

    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ username: "john" }]);
  });

  it("10. GET /users returns 500 on query failure", async () => {
    const sort = jest.fn().mockRejectedValue(new Error("query fail"));
    const select = jest.fn().mockReturnValue({ sort });
    User.find.mockReturnValue({ select });

    const response = await request(app).get("/users");

    expect(response.status).toBe(500);
  });

  it("11. POST /users/change-password requires auth", async () => {
    const response = await request(app).post("/users/change-password").send({
      currentPassword: "old",
      newPassword: "new-password",
    });

    expect(response.status).toBe(401);
  });

  it("12. POST /users/change-password validates required fields", async () => {
    const response = await request(app)
      .post("/users/change-password")
      .set("Authorization", "Bearer valid-token")
      .send({ currentPassword: "" });

    expect(response.status).toBe(400);
  });

  it("13. POST /users/change-password validates min length", async () => {
    const response = await request(app)
      .post("/users/change-password")
      .set("Authorization", "Bearer valid-token")
      .send({ currentPassword: "old", newPassword: "123" });

    expect(response.status).toBe(400);
  });

  it("14. POST /users/change-password returns 404 when user missing", async () => {
    User.findById.mockResolvedValue(null);

    const response = await request(app)
      .post("/users/change-password")
      .set("Authorization", "Bearer valid-token")
      .send({ currentPassword: "old", newPassword: "new-password" });

    expect(response.status).toBe(404);
  });

  it("15. POST /users/change-password returns 401 on invalid current password", async () => {
    User.findById.mockResolvedValue({ _id: "u1", password: "hash" });
    bcrypt.compare.mockResolvedValue(false);

    const response = await request(app)
      .post("/users/change-password")
      .set("Authorization", "Bearer valid-token")
      .send({ currentPassword: "bad", newPassword: "new-password" });

    expect(response.status).toBe(401);
  });

  it("16. POST /users/change-password returns 200 on success", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    User.findById.mockResolvedValue({ _id: "u1", password: "hash", save });

    const response = await request(app)
      .post("/users/change-password")
      .set("Authorization", "Bearer valid-token")
      .send({ currentPassword: "old", newPassword: "new-password" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Password changed successfully" });
  });

  it("17. GET /users/stats requires auth", async () => {
    const response = await request(app).get("/users/stats");

    expect(response.status).toBe(401);
  });

  it("18. GET /users/stats returns computed stats", async () => {
    getUserStats.mockResolvedValue({ totalMatches: 5, likesReceived: 9 });

    const response = await request(app)
      .get("/users/stats")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalMatches: 5, likesReceived: 9 });
  });

  it("19. GET /users/stats returns 500 when service fails", async () => {
    getUserStats.mockRejectedValue(new Error("stats fail"));

    const response = await request(app)
      .get("/users/stats")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(500);
  });

  it("20. DELETE /users/me requires auth", async () => {
    const response = await request(app).delete("/users/me");

    expect(response.status).toBe(401);
  });

  it("21. DELETE /users/me returns 404 when user missing", async () => {
    User.findById.mockResolvedValue(null);

    const response = await request(app)
      .delete("/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(404);
  });

  it("22. DELETE /users/me deletes account successfully", async () => {
    User.findById.mockResolvedValue({ _id: "u1" });
    User.findByIdAndDelete.mockResolvedValue({ acknowledged: true });

    const response = await request(app)
      .delete("/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("23. GET /users/admin requires auth", async () => {
    const response = await request(app).get("/users/admin");

    expect(response.status).toBe(401);
  });

  it("24. GET /users/admin requires admin role", async () => {
    const response = await request(app)
      .get("/users/admin")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
  });

  it("25. GET /users/admin returns list for admin", async () => {
    mockFindUsers([{ username: "admin-view" }]);

    const response = await request(app)
      .get("/users/admin")
      .set("Authorization", "Bearer valid-token")
      .set("x-admin", "true");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ username: "admin-view" }]);
  });

  it("26. GET /users/admin/:userId returns 404 when missing", async () => {
    const select = jest.fn().mockResolvedValue(null);
    User.findById.mockReturnValue({ select });

    const response = await request(app)
      .get("/users/admin/u999")
      .set("Authorization", "Bearer valid-token")
      .set("x-admin", "true");

    expect(response.status).toBe(404);
  });

  it("27. GET /users/admin/:userId returns user details", async () => {
    const select = jest.fn().mockResolvedValue({ _id: "u2", username: "alice" });
    User.findById.mockReturnValue({ select });

    const response = await request(app)
      .get("/users/admin/u2")
      .set("Authorization", "Bearer valid-token")
      .set("x-admin", "true");

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("alice");
  });

  it("28. PUT /users/admin/:userId validates role", async () => {
    const response = await request(app)
      .put("/users/admin/u2")
      .set("Authorization", "Bearer valid-token")
      .set("x-admin", "true")
      .send({ role: "owner" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Invalid role" });
  });

  it("29. PUT /users/admin/:userId updates user successfully", async () => {
    const select = jest.fn().mockResolvedValue({ _id: "u2", username: "alice", role: "user" });
    User.findByIdAndUpdate.mockReturnValue({ select });

    const response = await request(app)
      .put("/users/admin/u2")
      .set("Authorization", "Bearer valid-token")
      .set("x-admin", "true")
      .send({ username: "alice", role: "user", status: "active" });

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("alice");
  });

  it("30. DELETE /users/admin/:userId blocks self delete", async () => {
    const response = await request(app)
      .delete("/users/admin/admin-1")
      .set("Authorization", "Bearer valid-token")
      .set("x-admin", "true")
      .set("x-user-id", "admin-1");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Admin cannot delete their own account here" });
  });
});
