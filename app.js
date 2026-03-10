// backedNodeBlik/app.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/DB");

const userroutes = require("./routes/user_routes");
const authRoutes = require("./routes/auth.routes");
const discoveryRoutes = require("./routes/discovery_routes");
const swipeRoutes = require("./routes/swipe_routes");
const matchRoutes = require("./routes/match_routes");

const app = express();
connectDB();

app.use(express.json());
app.use(cors());

// serve uploaded images publicly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/users", userroutes);
app.use("/auth", authRoutes);
app.use("/discovery", discoveryRoutes);
app.use("/swipes", swipeRoutes);
app.use("/matches", matchRoutes);

const port = 3000;

// ✅ Socket.IO setup
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ JWT auth for sockets (MUST MATCH middleware/auth.js)
// middleware/auth.js sets: req.userId = decoded.userId;
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");

    const userId = decoded.userId; // ✅ IMPORTANT
    if (!userId) return next(new Error("Invalid token payload: missing userId"));

    socket.userId = userId.toString();
    return next();
  } catch (e) {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  console.log("✅ SOCKET CONNECT user:", socket.userId);
  socket.join(`user:${socket.userId}`);
});

// ✅ make io accessible from controllers via req.app.get("io")
app.set("io", io);

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${port}`);
});

module.exports = app;