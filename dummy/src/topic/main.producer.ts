// Example usage of producer
import RabbitMQProducer from "./producer";
import { RABBITMQ_CONFIG } from "../config";

async function main() {
  const producer = new RabbitMQProducer();

  try {
    await producer.connect();

    // Publish different types of logs
    await producer.publishMessage(
      RABBITMQ_CONFIG.routingKeys.info,
      "Normal operation message"
    );
    console.log("Published info message");

    await producer.publishMessage(
      RABBITMQ_CONFIG.routingKeys.error,
      "System error occurred"
    );
    console.log("Published error message");

    await producer.publishMessage(
      RABBITMQ_CONFIG.routingKeys.warning,
      "Warning: High memory usage"
    );
    console.log("Published warning message");
  } catch (error) {
    console.error("Producer error:", error);
  } finally {
    await producer.close();
  }
}

main();
