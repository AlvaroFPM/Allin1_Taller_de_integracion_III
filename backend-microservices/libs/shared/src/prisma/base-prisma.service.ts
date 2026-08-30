import { Injectable, OnModuleInit, OnModuleDestroy, Type } from '@nestjs/common';

export function createPrismaService<T extends { $connect: () => Promise<void>; $disconnect: () => Promise<void> }>(
  PrismaClientClass: new (...args: any[]) => T,
): Type<T & OnModuleInit & OnModuleDestroy> {
  @Injectable()
  class BasePrismaService extends (PrismaClientClass as any) implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
      await (this as any).$connect();
    }

    async onModuleDestroy() {
      await (this as any).$disconnect();
    }
  }

  return BasePrismaService as any;
}