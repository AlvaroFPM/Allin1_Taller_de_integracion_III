import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-catalog';
import { createPrismaService } from '@app/shared';

@Injectable()
export class CatalogPrismaService extends createPrismaService(PrismaClient) {}