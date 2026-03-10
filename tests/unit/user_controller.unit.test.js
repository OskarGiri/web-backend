jest.mock("../../models/user", () => {
  const User = jest.fn();
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

const User = require("../../models/user");
const Swipe = require("../../models/swipe");
const Match = require("../../models/match");
const Message = require("../../models/message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getUserStats } = require("../../services/user.service");

const {
  signup,
  login,
  findAllUsers,
  changePassword,
  getStats,
  deleteAccount,
  adminListUsers,
  adminGetUserById,
  adminUpdateUser,
  adminDeleteUser,
} = require("../../controller/user_controller");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function mockFindQueryResult(value) {
  const sort = jest.fn().mockResolvedValue(value);
  const select = jest.fn().mockReturnValue({ sort });
  User.find.mockReturnValue({ select });
  return { select, sort };
}

describe("user_controller unit tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    bcrypt.genSalt.mockResolvedValue("salt");
    bcrypt.hash.mockResolvedValue("hashed-password");
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed-token");
    getUserStats.mockResolvedValue({ totalMatches: 2, likesReceived: 4 });

    Swipe.deleteMany.mockResolvedValue({ acknowledged: true });
    Match.deleteMany.mockResolvedValue({ acknowledged: true });
    Message.deleteMany.mockResolvedValue({ acknowledged: true });
  });

  it("1. signup returns 201 on success", async () => {
    User.findOne.mockResolvedValue(null);
    const save = jest.fn().mockResolvedValue(undefined);
    User.mockImplementation((payload) => ({
      _id: "u1",
      role: "user",
      status: "active",
      ...payload,
      save,
    }));

    const req = { body: { username: "john", email: "john@test.com", password: "pw123" } };
    const res = createRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "User registered successfully", token: "signed-token" })
    );
  });

  it("2. signup returns 400 when user already exists", async () => {
    User.findOne.mockResolvedValue({ _id: "u1" });
    const req = { body: { username: "john", email: "john@test.com", password: "pw123" } };
    const res = createRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "User already exists" });
  });

  it("3. signup returns 500 on query failure", async () => {
    User.findOne.mockRejectedValue(new Error("db fail"));
    const req = { body: { username: "john", email: "john@test.com", password: "pw123" } };
    const res = createRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Unable to signup" });
  });

  it("4. signup returns 500 when save fails", async () => {
    User.findOne.mockResolvedValue(null);
    const save = jest.fn().mockRejectedValue(new Error("save fail"));
    User.mockImplementation((payload) => ({
      _id: "u1",
      role: "user",
      status: "active",
      ...payload,
      save,
    }));

    const req = { body: { username: "john", email: "john@test.com", password: "pw123" } };
    const res = createRes();

    await signup(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Unable to signup" });
  });

  it("5. login returns 400 when email is not found", async () => {
    User.findOne.mockResolvedValue(null);
    const req = { body: { email: "missing@test.com", password: "pw" } };
    const res = createRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password" });
  });

  it("6. login returns 400 on password mismatch", async () => {
    User.findOne.mockResolvedValue({ _id: "u1", password: "hashed", role: "user", status: "active" });
    bcrypt.compare.mockResolvedValue(false);

    const req = { body: { email: "john@test.com", password: "bad" } };
    const res = createRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password" });
  });

  it("7. login returns 403 for banned user", async () => {
    User.findOne.mockResolvedValue({ _id: "u1", password: "hashed", role: "user", status: "banned" });
    bcrypt.compare.mockResolvedValue(true);

    const req = { body: { email: "john@test.com", password: "pw" } };
    const res = createRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Account is banned" });
  });

  it("8. login returns 200 on success", async () => {
    User.findOne.mockResolvedValue({
      _id: "u1",
      username: "john",
      email: "john@test.com",
      password: "hashed",
      role: "admin",
      status: "active",
    });

    const req = { body: { email: "john@test.com", password: "pw" } };
    const res = createRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Login successful", token: "signed-token" })
    );
  });

  it("9. login returns 500 on unexpected error", async () => {
    User.findOne.mockRejectedValue(new Error("db fail"));
    const req = { body: { email: "john@test.com", password: "pw" } };
    const res = createRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Unable to login" });
  });

  it("10. findAllUsers returns 200 with users", async () => {
    const users = [{ username: "john" }];
    mockFindQueryResult(users);

    const req = {};
    const res = createRes();

    await findAllUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(users);
  });

  it("11. findAllUsers returns 500 when query fails", async () => {
    const sort = jest.fn().mockRejectedValue(new Error("query fail"));
    const select = jest.fn().mockReturnValue({ sort });
    User.find.mockReturnValue({ select });

    const req = {};
    const res = createRes();

    await findAllUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Unable to fetch users" });
  });

  it("12. changePassword returns 400 when fields are missing", async () => {
    const req = { body: { currentPassword: "" }, userId: "u1" };
    const res = createRes();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("13. changePassword returns 400 for short new password", async () => {
    const req = { body: { currentPassword: "old", newPassword: "123" }, userId: "u1" };
    const res = createRes();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("14. changePassword returns 404 when user is missing", async () => {
    User.findById.mockResolvedValue(null);

    const req = { body: { currentPassword: "old", newPassword: "newpass" }, userId: "u1" };
    const res = createRes();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("15. changePassword returns 401 when current password is invalid", async () => {
    User.findById.mockResolvedValue({ _id: "u1", password: "hashed" });
    bcrypt.compare.mockResolvedValue(false);

    const req = { body: { currentPassword: "bad", newPassword: "newpass" }, userId: "u1" };
    const res = createRes();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("16. changePassword returns success message", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    User.findById.mockResolvedValue({ _id: "u1", password: "old-hash", save });
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue("new-hash");

    const req = { body: { currentPassword: "old", newPassword: "new-password" }, userId: "u1" };
    const res = createRes();

    await changePassword(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Password changed successfully" });
    expect(save).toHaveBeenCalled();
  });

  it("17. changePassword returns 500 on exception", async () => {
    User.findById.mockRejectedValue(new Error("db fail"));

    const req = { body: { currentPassword: "old", newPassword: "new-password" }, userId: "u1" };
    const res = createRes();

    await changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("18. getStats returns 401 when userId is missing", async () => {
    const req = { userId: null };
    const res = createRes();

    await getStats(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("19. getStats returns 200 with stats", async () => {
    getUserStats.mockResolvedValue({ totalMatches: 10, likesReceived: 12 });
    const req = { userId: "u1" };
    const res = createRes();

    await getStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ totalMatches: 10, likesReceived: 12 });
  });

  it("20. getStats returns 500 when service fails", async () => {
    getUserStats.mockRejectedValue(new Error("service fail"));
    const req = { userId: "u1" };
    const res = createRes();

    await getStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("21. deleteAccount returns 401 when userId is missing", async () => {
    const req = { userId: null };
    const res = createRes();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("22. deleteAccount returns 404 when user does not exist", async () => {
    User.findById.mockResolvedValue(null);

    const req = { userId: "u1" };
    const res = createRes();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("23. deleteAccount returns 200 on success", async () => {
    User.findById.mockResolvedValue({ _id: "u1" });
    User.findByIdAndDelete.mockResolvedValue({ acknowledged: true });

    const req = { userId: "u1" };
    const res = createRes();

    await deleteAccount(req, res);

    expect(Swipe.deleteMany).toHaveBeenCalled();
    expect(Match.deleteMany).toHaveBeenCalled();
    expect(Message.deleteMany).toHaveBeenCalled();
    expect(User.findByIdAndDelete).toHaveBeenCalledWith("u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("24. deleteAccount returns 500 on exception", async () => {
    User.findById.mockRejectedValue(new Error("db fail"));

    const req = { userId: "u1" };
    const res = createRes();

    await deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("25. adminListUsers returns 200 with user list", async () => {
    const users = [{ username: "alice" }, { username: "bob" }];
    mockFindQueryResult(users);

    const req = {};
    const res = createRes();

    await adminListUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(users);
  });

  it("26. adminListUsers returns 500 when query fails", async () => {
    const sort = jest.fn().mockRejectedValue(new Error("query fail"));
    const select = jest.fn().mockReturnValue({ sort });
    User.find.mockReturnValue({ select });

    const req = {};
    const res = createRes();

    await adminListUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("27. adminGetUserById returns 404 when user is missing", async () => {
    const select = jest.fn().mockResolvedValue(null);
    User.findById.mockReturnValue({ select });

    const req = { params: { userId: "missing" } };
    const res = createRes();

    await adminGetUserById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("28. adminGetUserById returns 200 with user details", async () => {
    const user = { _id: "u2", username: "alice" };
    const select = jest.fn().mockResolvedValue(user);
    User.findById.mockReturnValue({ select });

    const req = { params: { userId: "u2" } };
    const res = createRes();

    await adminGetUserById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(user);
  });

  it("29. adminUpdateUser returns 400 for invalid role", async () => {
    const req = { params: { userId: "u2" }, body: { role: "superadmin" } };
    const res = createRes();

    await adminUpdateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid role" });
  });

  it("30. adminDeleteUser blocks self-delete", async () => {
    const req = { params: { userId: "admin-1" }, userId: "admin-1" };
    const res = createRes();

    await adminDeleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Admin cannot delete their own account here" });
  });
});
