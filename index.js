const express = require("express");
const cors = require("cors");
const hana = require("@sap/hana-client");

const app = express();
const port = 3001; // You can use any available port

// Middleware to parse JSON request bodies
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

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
      console.log("Connected to SAP HANA");

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
