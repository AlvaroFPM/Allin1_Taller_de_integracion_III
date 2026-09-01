import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@app/shared';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { UploadController } from './upload/upload.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SharedModule],
  controllers: [CatalogController, UploadController],
  providers: [CatalogService],
})
export class CatalogModule {}