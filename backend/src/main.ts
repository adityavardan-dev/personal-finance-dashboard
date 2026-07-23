import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Every incoming request should pass through these pipes.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // strips properties that aren't in your DTO
    forbidNonWhitelisted: true, // throws an error if non-whitelisted properties are present
    transform: true, // automatically transforms payloads to be objects typed according to their DTO classes
  })); 
  app.enableCors({
    origin: 'http://localhost:4200',
  });
  await app.listen(process.env.PORT ?? 3000);

}
bootstrap();
