import express, { Request, Response, NextFunction } from "express";
import proxy from "express-http-proxy";
import rateLimit from "express-rate-limit";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const auth = proxy("http://localhost:8081");
const messages = proxy("http://localhost:8082");
const notifications = proxy("http://localhost:8083");

// Define rate limiter
const limiter = rateLimit({
  windowMs: 15 * 1000, // 15 minutes
  max: 2, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  statusCode: 429, // HTTP status code for rate-limited requests
  keyGenerator: (req: Request) => req.ip!, // Use IP as the rate-limiting key
  handler: (req: Request, res: Response) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: "Rate limit exceeded. Try again later.",
    });
  },
});

// Apply rate limiter to all requests
app.use(limiter);

app.use("/api/auth", auth);
app.use("/api/messages", messages);
app.use("/api/notifications", notifications);

// Custom error handler (catching errors that were not handled by any other middleware)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AggregateError) {
    console.error("Multiple errors occurred:", err.errors); // Log all individual errors
    res.status(500).json({
      error: "Multiple errors occurred.",
      details: err.errors, // Optionally send the details of each individual error
    });
  } else {
    console.error(err.stack); // Log the error stack for debugging
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message || "An unexpected error occurred.",
    });
  }
});

const server = app.listen(8080, () => {
  console.log("Gateway is Listening to Port 8080");
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      console.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: unknown) => {
  console.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);
