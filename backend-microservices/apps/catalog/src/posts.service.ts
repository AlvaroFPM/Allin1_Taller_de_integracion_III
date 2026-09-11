import { Injectable } from '@nestjs/common';
import { CatalogPrismaService } from './prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: CatalogPrismaService) {}

  async create(dto: CreatePostDto) {
    return await this.prisma.publicacion.create({
      data: {
        idUsuarioVendedor: dto.idUsuarioVendedor,
        idCategoria: dto.idCategoria,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        precioBase: dto.precioBase,
        ciudad: dto.ciudad,
        region: dto.region,
        tipoServicio: dto.tipoServicio ?? 'OFERTA',
      },
    });
  }
}