import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes/index.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
});

await registerRoutes(app);

try {
  await app.listen({ port, host });
  console.log(`API ready at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
