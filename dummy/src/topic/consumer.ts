import amqp, { Connection, Channel, ConsumeMessage } from "amqplib";
import { RABBITMQ_CONFIG } from "../config";

export interface BindingConfig {
  routingKey: string;
  queueName: string;
}

export default class RabbitConsumer {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchangeName: string;
  private readonly exchangeType: string;
  private readonly rabbitUrl: string;
  private readonly bindings: BindingConfig[];

  constructor(
    exchangeName: string = RABBITMQ_CONFIG.exchange.name,
    exchangeType: string = RABBITMQ_CONFIG.exchange.type,
    rabbitUrl: string = RABBITMQ_CONFIG.url,
    bindings: BindingConfig[]
  ) {
    this.exchangeName = exchangeName;
    this.exchangeType = exchangeType;
    this.rabbitUrl = rabbitUrl;
    this.bindings = bindings;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.rabbitUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
        durable: true,
      });
      for (const binding of this.bindings) {
        await this.channel.assertQueue(binding.queueName, { durable: true });
        await this.channel.bindQueue(
          binding.queueName,
          this.exchangeName,
          binding.routingKey
        );
      }
      await this.channel.prefetch(1);
      console.log("Consumer connected to RabbitMQ");
    } catch (err) {}
  }

  async consume(
    processMessage: (msg: string, routingKey: string) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("Channel not initialized");
    }
    try {
      for (const binding of this.bindings) {
        await this.channel.consume(
          binding.queueName,
          async (msg: ConsumeMessage | null) => {
            if (!msg) {
              return;
            }
            console.log({ msg });
            const content = msg.content.toString();
            const routingKey = msg.fields.routingKey;
            try {
              await processMessage(content, routingKey);
              this.channel?.ack(msg);
            } catch (error) {
              console.error("Error processing message:", error);
              // Reject and requeue the message on processing error
              this.channel?.nack(msg, false, true);
            }
          },
          { noAck: true }
        );
      }
    } catch (error) {
      console.error("Error setting up consumer:", error);
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
