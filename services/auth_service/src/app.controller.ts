import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Service information' })
  @ApiResponse({ status: 200, description: 'Service information' })
  getServiceInfo() {
    return this.appService.getServiceInfo();
  }
}

