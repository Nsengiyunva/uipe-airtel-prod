import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { AirtelCallbackController } from './airtel-callback.controller.js';
import { AirtelCallbackService } from './airtel-callback.service.js';
import { AirtelCallbackStore } from './airtel-callback.store.js';

@Module({
  imports: [DbModule],
  controllers: [AirtelCallbackController],
  providers: [AirtelCallbackService, AirtelCallbackStore],
})
export class AirtelModule {}
