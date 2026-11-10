import { Module } from '@nestjs/common';
import { AirtelCallbackController } from './airtel-callback.controller.js';
import { AirtelCallbackService } from './airtel-callback.service.js';
import { AirtelCallbackStore } from './airtel-callback.store.js';

@Module({
  controllers: [AirtelCallbackController],
  providers: [AirtelCallbackService, AirtelCallbackStore],
})
export class AirtelModule {}
