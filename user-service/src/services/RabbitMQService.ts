import amqp, { Channel, Connection } from "amqplib";
import config from "../config/config";
import { User } from "../database";
import { ApiError } from "../utils";

class RabbitMQService {
  private requestQueue = "USER_DETAILS_REQUEST";
  private responseQueue = "USER_DETAILS_RESPONSE";
  private connection!: Connection;
  private channel!: Channel;

  constructor() {
    this.init().catch((error) => {
      console.error("Failed to initialize RabbitMQ:", error);
      // Attempt to reconnect
      setTimeout(() => this.init(), 5000);
    });
  }

  async init() {
    try {
      // Establish connection to RabbitMQ server
      this.connection = await amqp.connect(config.msgBrokerURL!);

      // Handle connection errors and closure
      this.connection.on("error", (error) => {
        console.error("RabbitMQ connection error:", error);
      });

      this.connection.on("close", () => {
        console.log("RabbitMQ connection closed, attempting to reconnect...");
        setTimeout(() => this.init(), 5000);
      });

      // Create channel
      this.channel = await this.connection.createChannel();

      // Handle channel errors
      this.channel.on("error", (error) => {
        console.error("RabbitMQ channel error:", error);
      });

      this.channel.on("close", () => {
        console.log("RabbitMQ channel closed");
      });

      // Assert queues with proper options
      await this.channel.assertQueue(this.requestQueue, {
        durable: true, // survive broker restarts
      });

      await this.channel.assertQueue(this.responseQueue, {
        durable: true,
      });

      // Set prefetch to 1 to handle one message at a time
      await this.channel.prefetch(1);

      // Start listening for messages
      await this.listenForRequests();

      console.log("RabbitMQ initialized successfully");
    } catch (error) {
      console.error("RabbitMQ initialization error:", error);
      // If initialization fails, attempt to cleanup and throw
      await this.cleanup();
      throw error;
    }
  }

  private async listenForRequests() {
    try {
      this.channel.consume(
        this.requestQueue,
        async (msg) => {
          if (!msg) return;

          try {
            const { userId } = JSON.parse(msg.content.toString());
            console.log(`Processing request for user: ${userId}`);

            const userDetails = await getUserDetails(userId);

            // Send response
            await this.channel.sendToQueue(
              this.responseQueue,
              Buffer.from(JSON.stringify(userDetails)),
              {
                correlationId: msg.properties.correlationId,
                persistent: true, // Message survives broker restart
              }
            );

            // Acknowledge successful processing
            this.channel.ack(msg);
            console.log(`Successfully processed request for user: ${userId}`);
          } catch (error) {
            console.error("Error processing message:", error);

            // If it's a user not found error, we still ack as retrying won't help
            if (error instanceof ApiError && error.statusCode === 404) {
              this.channel.ack(msg);

              // Send error response
              await this.channel.sendToQueue(
                this.responseQueue,
                Buffer.from(JSON.stringify({ error: "User not found" })),
                {
                  correlationId: msg.properties.correlationId,
                  persistent: true,
                }
              );
            } else {
              // For other errors, reject the message and requeue
              this.channel.nack(msg, false, true);
            }
          }
        },
        {
          noAck: false, // Enable manual acknowledgment
        }
      );

      console.log(`Listening for messages on queue: ${this.requestQueue}`);
    } catch (error) {
      console.error("Error in message consumer:", error);
      // Attempt to reconnect
      setTimeout(() => this.listenForRequests(), 5000);
    }
  }

  private async cleanup() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  // Method to gracefully shutdown
  async shutdown() {
    console.log("Shutting down RabbitMQ service...");
    await this.cleanup();
  }
}

const getUserDetails = async (userId: string) => {
  const userDetails = await User.findById(userId).select("-password");
  if (!userDetails) {
    throw new ApiError(404, "User not found");
  }
  return userDetails;
};

// Export as singleton
export const rabbitMQService = new RabbitMQService();

// Handle process termination
process.on("SIGINT", async () => {
  await rabbitMQService.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await rabbitMQService.shutdown();
  process.exit(0);
});
