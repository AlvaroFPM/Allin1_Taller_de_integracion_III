import { Injectable } from '@nestjs/common';
import { CatalogPrismaService } from './prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PaginationDto } from './dto/pagination.dto';
import { EstadoPublicacion } from '@prisma/client-catalog';

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

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where = {
      estado: EstadoPublicacion.ACTIVO,
    };

    const [total, publicaciones] = await Promise.all([
      this.prisma.publicacion.count({ where }),
      this.prisma.publicacion.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          fechaCreacion: 'desc',
        },
        include: {
          categoria: true,
          multimedia: true,
        },
      }),
    ]);

    return {
      data: publicaciones,
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    };
  }
}