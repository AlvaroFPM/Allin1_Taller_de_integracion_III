import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@app/shared';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { UploadController } from './upload/upload.controller';
import { CatalogPrismaService } from './prisma.service';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SharedModule],
  controllers: [CatalogController, UploadController, PostsController],
  providers: [CatalogService, CatalogPrismaService, PostsService],
  exports: [PostsService],
})
export class CatalogModule {}