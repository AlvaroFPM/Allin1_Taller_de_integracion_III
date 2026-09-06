import type { Express } from 'express';
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from '@app/shared';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadImage(
      file,
      'marketplace/catalog',
    );

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleImages(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await this.uploadService.uploadMultipleImages(
      files,
      'marketplace/catalog',
    );

    return {
      success: true,
      images: results.map((r) => ({
        url: r.secure_url,
        publicId: r.public_id,
        format: r.format,
        bytes: r.bytes,
      })),
    };
  }
}