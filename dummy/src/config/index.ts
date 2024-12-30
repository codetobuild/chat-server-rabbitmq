export const RABBITMQ_CONFIG = {
  url: "amqp://localhost",
  exchange: {
    name: "logs_exchange",
    type: "topic", // Other types: 'direct', 'fanout', 'headers'
  },
  routingKeys: {
    error: "logs.error",
    info: "logs.info",
    warning: "logs.warning",
  },
};
