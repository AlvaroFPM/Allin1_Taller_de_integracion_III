import type { Express } from 'express';
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadService {
  private readonly maxFileSizeBytes = 10 * 1024 * 1024;
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
  ];

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Formato no soportado: ${file.mimetype}. Usa JPEG, PNG, WEBP o AVIF.`,
      );
    }
    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `El archivo supera el límite de ${this.maxFileSizeBytes / (1024 * 1024)}MB.`,
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'marketplace',
  ): Promise<UploadApiResponse> {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            console.error('Cloudinary upload_stream error:', error);
            return reject(
              new InternalServerErrorException(
                'Error al subir imagen a Cloudinary.',
              ),
            );
          }
          resolve(result);
        },
      );
      stream.end(file.buffer);
    });
  }

  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder = 'marketplace',
  ): Promise<UploadApiResponse[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se recibió ningún archivo.');
    }
    return Promise.all(files.map((file) => this.uploadImage(file, folder)));
  }
}