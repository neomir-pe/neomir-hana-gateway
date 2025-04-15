const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");
const hana = require("@sap/hana-client");
const crypto = require("crypto");
const dotenv = require("dotenv");
const os = require("os");

// Load environment variables from .env.local file.
dotenv.config({ path: ".env.local" });

//#region SSL / HTTPS Configuration

// Attempt to read SSL certificate and key for HTTPS.
// If the certificates are not found, the server will continue in HTTP-only mode.
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

//#endregion

//#region Express App & Middleware Setup

const app = express();
const httpPort = process.env.HTTP_PORT || 80;
const httpsPort = process.env.HTTPS_PORT || 443;

// Middleware: Parse JSON request bodies.
app.use(express.json());

// Configure allowed origins for CORS requests.
const allowedOrigins = [
  "http://localhost:3000",
  "https://neomir.app",
  "https://neomir.dev",
];
const vercelOriginRegex = /^https:\/\/.*\.vercel\.app$/;

// Middleware: Configure CORS with a function to dynamically allow origins.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman) or if origin is in the allowed list.
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        vercelOriginRegex.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

// Simple GET route to confirm the server is running.
app.get("/", (req, res) => {
  res.send("Neomir HANA Gateway Server!");
});

//#endregion

//#region Credential Encryption & Decryption

/**
 * Encrypts a given text using AES-256-CBC.
 * Uses environment variables DECRYPTION_KEY (32-byte hex) and DECRYPTION_IV (16-byte hex).
 *
 * @param {string} text - The plaintext to encrypt.
 * @returns {string} - The encrypted text in base64 format.
 * @throws Will throw an error if the key or IV is not properly configured.
 */
function encrypt(text) {
  const keyHex = process.env.DECRYPTION_KEY;
  const ivHex = process.env.DECRYPTION_IV;
  if (!keyHex || !ivHex) {
    throw new Error("Decryption key or IV not configured in .env.local file");
  }
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

/**
 * Decrypts a given text using AES-256-CBC.
 * Assumes the encrypted text is provided in base64 format.
 *
 * @param {string} encryptedText - The encrypted text in base64 format.
 * @returns {string} - The decrypted plaintext.
 * @throws Will throw an error if the key or IV is not properly configured.
 */
function decrypt(encryptedText) {
  const keyHex = process.env.DECRYPTION_KEY;
  const ivHex = process.env.DECRYPTION_IV;
  if (!keyHex || !ivHex) {
    throw new Error("Decryption key or IV not configured in .env.local file");
  }
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Endpoint to encrypt provided user and password credentials.
// To generate appropriate keys and IVs, visit the provided random.org links.
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

//#region HANA Database Query Execution

/**
 * Creates and returns a promise for connecting to the HANA database.
 *
 * @param {object} connParams - The connection parameters (user, password, etc.).
 * @returns {Promise<object>} - Resolves with the HANA connection or rejects with an error.
 */
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

/**
 * Executes a SQL query on the provided HANA connection.
 *
 * @param {object} connection - The active HANA connection.
 * @param {string} query - The SQL query string.
 * @returns {Promise<any>} - Resolves with the query result or rejects with an error.
 */
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

/**
 * Route handler for executing database queries.
 *
 * The request body should contain:
 * - query: The SQL query to execute.
 * - encrypted_user (optional): Encrypted database username.
 * - encrypted_password (optional): Encrypted database password.
 * - ...other connection parameters if needed.
 */
app.post("/", async (req, res) => {
  const { query, ...params } = req.body;

  // Prepare connection parameters (credentials will be decrypted if provided).
  let connectionParams = {
    user: "",
    password: "",
    ...params,
  };

  // Decrypt credentials if available.
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
    console.error("Database error:", error);
    res.status(500).json({
      error: {
        type: error.name || "Internal Server Error",
        message: error.message,
        details: error,
      },
    });
  } finally {
    // Ensure the HANA connection is closed if it was opened.
    if (connection) {
      connection.disconnect();
    }
  }
});

//#endregion

//#region Global Error Handling

// Global error-handling middleware for catching uncaught errors.
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

//#region Server Startup & Utility Functions

/**
 * Retrieves the first non-internal IPv4 address of the host machine.
 *
 * @returns {string} - Local IP address or "localhost" if not found.
 */
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === "IPv4" && !config.internal) {
        return config.address;
      }
    }
  }
  return "localhost";
}

const localIp = getLocalIp();
const hostname = os.hostname();

// Start the HTTP server.
app.listen(httpPort, "0.0.0.0", () => {
  console.log(`HTTP server running at http://${localIp}:${httpPort}`);
});

// Start the HTTPS server only if SSL options are available.
if (sslOptions) {
  https.createServer(sslOptions, app).listen(httpsPort, () => {
    console.log(`HTTPS server running at https://${hostname}:${httpsPort}`);
  });
}

//#endregion
