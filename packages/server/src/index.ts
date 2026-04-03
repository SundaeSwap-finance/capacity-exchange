import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';
import { registerRoutes } from './app';

export async function generateSchema(): Promise<object> {
  const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
  await registerRoutes(app);
  await app.ready();
  const schema = app.swagger();
  await app.close();
  return schema;
}