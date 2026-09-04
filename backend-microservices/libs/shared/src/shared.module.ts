import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedService } from './shared.service';
import { UploadService } from './upload/upload.service';

@Module({
  imports: [ConfigModule],
  providers: [SharedService, UploadService],
  exports: [SharedService, UploadService],
})
export class SharedModule {}
