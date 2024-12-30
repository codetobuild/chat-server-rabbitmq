// Example usage of producer
import RabbitConsumer, { BindingConfig } from "./consumer";
import { RABBITMQ_CONFIG } from "../config";

async function main() {
  // Set up bindings for different log levels
  const bindings: BindingConfig[] = [
    { routingKey: "logs.error", queueName: "error_queue" },
    { routingKey: "logs.info", queueName: "info_queue" },
    { routingKey: "logs.warning", queueName: "warning_queue" },
  ];

  const consumer = new RabbitConsumer(
    RABBITMQ_CONFIG.exchange.name,
    RABBITMQ_CONFIG.exchange.type,
    RABBITMQ_CONFIG.url,
    bindings
  );

  try {
    await consumer.connect();

    // Define message processing logic
    const processMessage = async (msg: string, routingKey: string) => {
      console.log(`Received message with routing key ${routingKey}: ${msg}`);
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`Processed message from ${routingKey}`);
    };

    await consumer.consume(processMessage);

    // Keep the process running
    process.on("SIGINT", async () => {
      await consumer.close();
      process.exit(1);
    });
    process.on("uncaughtException", async () => {
      await consumer.close();
      process.exit(1);
    });
  } catch (error) {
    console.error("Consumer error:", error);
    process.exit(1);
  }
}

main();
