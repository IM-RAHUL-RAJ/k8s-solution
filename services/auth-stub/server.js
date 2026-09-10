const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const secret = process.env.JWT_SECRET || "change-this-to-a-long-random-secret-at-least-32-bytes"; //process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET must be set");
}

const issuer = process.env.JWT_ISSUER || "auth-service";

const users = {
  "priya.menon": {
    id: "8f14e45f-ceea-4c1b-9d3b-1a2b3c4d5e6f",
    password: "correct horse battery staple",
    accountId: 1,
    accountIds: [1, 2, 3],
    roles: ["CUSTOMER"]
  },
  "ops.admin": {
    id: "7ddfdd63-ec56-49fc-8ecf-e4127ff3f784",
    password: "admin passphrase 123",
    accountId: 2,
    accountIds: [1, 2, 3, 4, 5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    roles: ["ADMIN"]
  }
};

function issueAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      accountId: user.accountId,
      accountIds: user.accountIds,
      roles: user.roles,
      iss: issuer
    },
    secret,
    { algorithm: "HS256", expiresIn: 900 }
  );
}

app.post("/auth/login", (req, res) => {
  const username = req.body && req.body.username;
  const password = req.body && req.body.password;
  const user = users[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ errorCode: "AUTH-401", message: "Unauthorised" });
  }

  return res.status(200).json({
    accessToken: issueAccessToken(user),
    refreshToken: crypto.randomBytes(24).toString("hex"),
    tokenType: "Bearer",
    expiresIn: 900
  });
});

app.get("/auth/me", (req, res) => {
  const authHeader = req.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ errorCode: "AUTH-401", message: "Unauthorised" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer
    });
    const user = Object.values(users).find((u) => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({ errorCode: "AUTH-401", message: "Unauthorised" });
    }
    return res.status(200).json({
      id: user.id,
      username: Object.keys(users).find((name) => users[name].id === user.id),
      accountId: user.accountId,
      roles: user.roles,
      createdOn: "2026-10-05T08:00:00Z"
    });
  } catch (e) {
    return res.status(401).json({ errorCode: "AUTH-401", message: "Unauthorised" });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "up" });
});

const port = Number(process.env.PORT || "3000");
app.listen(port, () => {
  console.log(`auth-stub listening on ${port}`);
});

