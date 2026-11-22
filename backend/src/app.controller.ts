/**
 * Purpose: Defines the root HTTP endpoint for the application.
 */
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
// A controller is responsible for handling incoming requests
// and returning responses to the client.
@Controller()
export class AppController {
  /** Creates this class and receives its required dependencies. */
  constructor(private readonly appService: AppService) {}

  /** Returns get hello. */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
