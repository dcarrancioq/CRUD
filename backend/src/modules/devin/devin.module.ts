import { Module } from '@nestjs/common';
import { DevinService } from './devin.service';
import { DevinController } from './devin.controller';

@Module({
  controllers: [DevinController],
  providers: [DevinService],
  exports: [DevinService],
})
export class DevinModule {}
