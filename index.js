const express = require("express");
const cors = require("cors");
const hana = require("@sap/hana-client");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config(); // Load .env variables

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());
const allowedOrigins = [
  "http://localhost:3000",
  "https://neomir.app",
  "https://neomir.dev",
  "https://*.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Check if the origin is in the list of allowed origins or matches a pattern
      if (
        allowedOrigins.includes(origin) ||
        /https:\/\/.*\.vercel\.app/.test(origin)
      ) {
        callback(null, true);
      } else {
        if (!origin) {
          // For requests without an origin (like Postman), allow them
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
  })
);

app.get("/", (req, res) => {
  res.send("Neomir HANA Gateway Server");
});

// Route to handle database queries
app.post("/", (req, res) => {
  const connection = hana.createConnection();
  try {
    const { query, mode, ...connParams } = req.body;
    if (mode === "TEST") {
      return res.json({ message: "Connection to proxy established" });
    }

    connection.connect(connParams, (err) => {
      if (err) {
        console.error("Connection error", err);
        return res.status(500).json({
          error: {
            type: "Connect Error",
            message: err.message,
            details: err,
          },
        });
      }

      // Execute the query
      connection.exec(query, (err, result) => {
        if (err) {
          console.error("Query error", err);
          connection.disconnect(); // Ensure connection is closed on error
          return res.status(500).json({
            error: {
              type: "Query Error",
              message: err.message,
              details: err,
            },
          });
        }

        res.json({ data: result });
        connection.disconnect(); // Ensure connection is closed after response
      });
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      error: {
        type: "Internal server error",
        message: err.message,
        details: err,
      },
    });
    connection.disconnect(); // Ensure connection is closed on catch block error
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
