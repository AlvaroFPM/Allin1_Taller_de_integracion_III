import { Injectable, ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateUsuarioTestDto } from './dto/create-usuario-test.dto';
import { FilterUsuarioDto } from './dto/filter-usuario.dto';
import { RolUsuario, Prisma } from '@prisma/client-iam';
import * as bcrypt from 'bcrypt';

@Injectable()
export class IamService {
  private readonly logger = new Logger(IamService.name);

  constructor(private readonly prisma: PrismaService) {}

  async testDatabaseConnection() {
    const totalUsuarios = await this.prisma.usuario.count();
    return {
      status: 'success',
      registrosEnBaseDeDatos: totalUsuarios,
      timestamp: new Date().toISOString(),
    };
  }

  async createUsuario(dto: CreateUsuarioTestDto) {
    try {
      const existe = await this.prisma.usuario.findFirst({
        where: { OR: [{ correo: dto.correo }, { rut: dto.rut }] },
      });

      if (existe) {
        throw new ConflictException('El correo o RUT ya se encuentra registrado.');
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);

      const nuevoUsuario = await this.prisma.usuario.create({
        data: {
          rut: dto.rut,
          nombres: dto.nombres,
          apellidos: dto.apellidos,
          correo: dto.correo,
          passwordHash,
          rol: dto.rol as RolUsuario,
          estadoActivo: true,
        },
        select: {
          idUsuario: true,
          rut: true,
          nombres: true,
          apellidos: true,
          correo: true,
          rol: true,
          estadoActivo: true,
          fechaCreacion: true,
        },
      });

      return { status: 'success', data: nuevoUsuario };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error('Error al registrar usuario:', error);
      throw new InternalServerErrorException('Error interno al persistir el usuario.');
    }
  }

  async findUsuarios(filtros: FilterUsuarioDto) {
    try {
      const {
        search,
        rol,
        estadoActivo,
        fechaDesde,
        fechaHasta,
        page = 1,
        limit = 10,
        ordenarPor = 'fechaCreacion',
        ordenDireccion = 'desc',
      } = filtros;

      const condicionesWhere: Prisma.UsuarioWhereInput[] = [];

      // 1. Búsqueda por texto insensible a mayúsculas/minúsculas
      if (search) {
        condicionesWhere.push({
          OR: [
            { nombres: { contains: search, mode: 'insensitive' } },
            { apellidos: { contains: search, mode: 'insensitive' } },
            { correo: { contains: search, mode: 'insensitive' } },
          ],
        });
      }

      // 2. Filtros por rol y estado
      if (rol) condicionesWhere.push({ rol });
      if (estadoActivo !== undefined) condicionesWhere.push({ estadoActivo });

      // 3. Rango de fechas
      if (fechaDesde || fechaHasta) {
        const filtroFecha: Prisma.DateTimeFilter = {};
        if (fechaDesde) filtroFecha.gte = new Date(`${fechaDesde}T00:00:00.000Z`);
        if (fechaHasta) filtroFecha.lte = new Date(`${fechaHasta}T23:59:59.999Z`);
        condicionesWhere.push({ fechaCreacion: filtroFecha });
      }

      const where: Prisma.UsuarioWhereInput = condicionesWhere.length > 0 ? { AND: condicionesWhere } : {};
      const skip = (page - 1) * limit;

      // Diccionario de ordenamiento: vincula parámetros permitidos con objetos de Prisma
      const mapeoOrden: Record<string, Prisma.UsuarioOrderByWithRelationInput> = {
        fechaCreacion: { fechaCreacion: ordenDireccion },
        nombres: { nombres: ordenDireccion },
        apellidos: { apellidos: ordenDireccion },
      };

      // Si el parámetro no coincide exactamente con el mapa, usa fechaCreacion por defecto
      const orderBy = mapeoOrden[ordenarPor] ?? { fechaCreacion: 'desc' };

      const [total, data] = await Promise.all([
        this.prisma.usuario.count({ where }),
        this.prisma.usuario.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            idUsuario: true,
            rut: true,
            nombres: true,
            apellidos: true,
            correo: true,
            rol: true,
            estadoActivo: true,
            fechaCreacion: true,
          },
        }),
      ]);

      return {
        status: 'success',
        meta: {
          total,
          paginaActual: page,
          totalPaginas: Math.ceil(total / limit),
          limitePorPagina: limit,
        },
        data,
      };
    } catch (error) {
      this.logger.error('Error al consultar usuarios con filtros:', error);
      throw new InternalServerErrorException('Error al ejecutar la consulta en base de datos.');
    }
  }
}