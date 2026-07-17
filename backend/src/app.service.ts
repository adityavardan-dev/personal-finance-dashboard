import { Injectable } from '@nestjs/common';
// Services are typically used to encapsulate business logic and data access, 
// and can be shared across multiple controllers or other services.
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
