/**
 * Purpose: Starts the NestJS application and configures its global request handling.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { isAllowedOrigin } from './cors-origin';

for (const envPath of [
  join(process.cwd(), '.env'),
  join(process.cwd(), '.env.local'),
  join(__dirname, '..', '..', '.env'),
  join(__dirname, '..', '..', '.env.local'),
]) {
  try {
    loadEnvFile(envPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Handles bootstrap. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Every incoming request should pass through these pipes.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties that aren't in your DTO
      forbidNonWhitelisted: true, // throws an error if non-whitelisted properties are present
      transform: true, // automatically transforms payloads to be objects typed according to their DTO classes
    }),
  );
  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
