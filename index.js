const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const hana = require("@sap/hana-client");
const crypto = require("crypto");
const dotenv = require("dotenv");

let sslOptions;
try {
  sslOptions = {
    key: fs.readFileSync("./ssl/server.key"),
    cert: fs.readFileSync("./ssl/server.cert"),
  };
} catch (err) {
  console.warn("⚠️  SSL certificates not found, running in HTTP-only mode.");
  sslOptions = null;
}

dotenv.config({ path: ".env.local" }); // Load .env variables

const app = express();
const http_port = process.env.HTTP_PORT || 80;
const https_port = process.env.HTTPS_PORT || 443;
// Middleware to parse JSON request bodies
app.use(express.json());

// Define allowed origins and regex for pattern-based origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://neomir.app",
  "https://neomir.dev",
];
const vercelOriginRegex = /^https:\/\/.*\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        vercelOriginRegex.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);

app.get("/", (req, res) => {
  res.send("Neomir HANA Gateway Server!");
});

//#region Credentials Encryption
// Your credentials will be encrypted using AES-256-CBC, which requires a 32-byte key and a 16-byte IV.
// To generate the DECRYPTION_KEY, visit https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h
// To generate a random DECRYPTION_IV, visit https://www.random.org/cgi-bin/randbyte?nbytes=16&format=h
//#region Helper Functions
function encrypt(text) {
  const keyHex = process.env.DECRYPTION_KEY;
  const ivHex = process.env.DECRYPTION_IV;
  if (!keyHex || !ivHex) {
    throw new Error("Decryption key or IV not configured in .local.env file");
  }
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}
//#endregion

//#region Route Handler
app.post("/encrypt", (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({
      error: "Missing user or password in request body.",
    });
  }

  try {
    const encryptedUser = encrypt(user);
    const encryptedPassword = encrypt(password);
    res.json({ encryptedUser, encryptedPassword });
  } catch (error) {
    console.error("Encryption error:", error);
    res.status(500).json({ error: error.message });
  }
});
//#endregion
//#endregion

//#region Query Execution
//#region Helper Functions
// Helper function to decrypt text using AES-256-CBC.
// Assumes the encrypted text is base64 encoded.
function decrypt(encryptedText) {
  const keyHex = process.env.DECRYPTION_KEY;
  const ivHex = process.env.DECRYPTION_IV;
  if (!keyHex || !ivHex) {
    throw new Error("Decryption key or IV not configured in .env");
  }
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Promisified function for connecting to HANA
function connectAsync(connParams) {
  const connection = hana.createConnection();
  return new Promise((resolve, reject) => {
    connection.connect(connParams, (err) => {
      if (err) {
        return reject({ error: err, connection });
      }
      resolve(connection);
    });
  });
}

// Promisified function for executing a query
function execQueryAsync(connection, query) {
  return new Promise((resolve, reject) => {
    connection.exec(query, (err, result) => {
      if (err) {
        return reject({ error: err, connection });
      }
      resolve(result);
    });
  });
}
//#endregion
//#region Route Handler
// Route to handle database queries, with decryption of credentials.
app.post("/", async (req, res) => {
  // Extract query, mode, and encrypted credentials from request body.
  const { query, ...params } = req.body;

  let connectionParams = {
    user: "",
    password: "",
    ...params,
  };

  // Decrypt credentials if provided.
  try {
    if (params.encrypted_user) {
      connectionParams.user = decrypt(params.encrypted_user);
    }
    if (params.encrypted_password) {
      connectionParams.password = decrypt(params.encrypted_password);
    }
  } catch (error) {
    console.error("Decryption error:", error);
    return res.status(400).json({
      error: {
        type: "Decryption Error",
        message: error.message,
        details: error,
      },
    });
  }

  let connection;
  try {
    connection = await connectAsync(connectionParams);
    const result = await execQueryAsync(connection, query);
    res.json({ data: result });
  } catch (errObj) {
    const { error } = errObj;
    console.error("Error:", error);
    res.status(500).json({
      error: {
        type: error.name || "Internal Server Error",
        message: error.message,
        details: error,
      },
    });
  } finally {
    // Ensure that the connection is closed if it was opened.
    if (connection) {
      connection.disconnect();
    }
  }
});
//#endregion
//#endregion

//#region Error Handling
// Global error-handling middleware for uncaught errors.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      type: "Unhandled Error",
      message: err.message,
      details: err,
    },
  });
});
//#endregion

// Start the server
const os = require("os");

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === "IPv4" && !config.internal) {
        return config.address;
      }
    }
  }
}

const localIp = getLocalIp() || "localhost";
const hostname = os.hostname();
app.listen(http_port, "0.0.0.0", () => {
  console.log(`HTTP server running at http://${localIp}:${http_port}`);
});

// Start HTTPS server only if SSL options are available
if (sslOptions) {
  https.createServer(sslOptions, app).listen(https_port, () => {
    console.log(`HTTPS server running at https://${hostname}:${https_port}`);
  });
}
