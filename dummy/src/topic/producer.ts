import amqp, { Connection, Channel } from "amqplib";
import { RABBITMQ_CONFIG } from "../config";

export default class RabbitMQProducer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchangeName: string;
  private readonly exchangeType: string;
  private readonly rabbitUrl: string;

  constructor(
    exchangeName: string = RABBITMQ_CONFIG.exchange.name,
    exchangeType: string = RABBITMQ_CONFIG.exchange.type,
    rabbitUrl: string = RABBITMQ_CONFIG.url
  ) {
    this.exchangeName = exchangeName;
    this.exchangeType = exchangeType;
    this.rabbitUrl = rabbitUrl;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.rabbitUrl);
      this.channel = await this.connection.createChannel();

      // assert exchange
      await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
        durable: true,
      });
      console.log("Producer connected to RabbitMQ");
    } catch (err) {
      console.error("Failed to connect to RabbitMQ:", err);
      throw err;
    }
  }

  async publishMessage(routingKey: string, message: string) {
    if (!this.channel) {
      throw new Error("Channel not initialized");
    }
    try {
      return this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(message),
        {
          persistent: true,
          expiration: 15 * 60 * 1000,
          timestamp: new Date().getTime(),
        }
      );
    } catch (error) {
      console.error("Error publishing message:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      console.error("Error closing connections:", error);
      throw error;
    }
  }
}
