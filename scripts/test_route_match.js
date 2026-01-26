const express = require("express");
const layoutRoutes = require("../src/routes/layoutRoutes");

// Mock requireAuth to avoid dependencies
const auth = require("../src/middleware/auth");
auth.requireAuth = (req, res, next) => next();

const app = express();

app.use((req, res, next) => {
  console.log(`[TEST] Middleware detected: ${req.method} ${req.url}`);
  next();
});

app.use("/api/layouts", layoutRoutes);

// Mock request
const req = {
  method: "GET",
  url: "/api/layouts/RESUMEN/2025/CIUDAD%20DE%20M%C3%89XICO",
};

console.log(`Testing route matching for: ${req.url}`);

// Since we can't easily perform a real http request without listening,
// we'll start a listener on a random port, make a request, and exit.
const http = require("http");

const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`Test server listening on port ${port}`);

  const options = {
    hostname: "localhost",
    port: port,
    path: "/api/layouts/RESUMEN/2025/CIUDAD%20DE%20M%C3%89XICO",
    method: "GET",
  };

  const request = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      console.log(`BODY: ${chunk}`);
    });
    res.on("end", () => {
      console.log("No more data in response.");
      server.close();
      process.exit(0);
    });
  });

  request.on("error", (e) => {
    console.error(`problem with request: ${e.message}`);
    server.close();
    process.exit(1);
  });

  request.end();
});
