import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateUsuarioTestDto } from './dto/create-usuario-test.dto';
import { RolUsuario } from '@prisma/client-iam';
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

  async createUsuarioTest(dto: CreateUsuarioTestDto) {
    const existe = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ correo: dto.correo }, { rut: dto.rut }],
      },
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

    return {
      status: 'success',
      data: nuevoUsuario,
    };
  }

  async getUsuariosTest() {
    const usuarios = await this.prisma.usuario.findMany({
      take: 10,
      orderBy: { fechaCreacion: 'desc' },
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

    return {
      status: 'success',
      total: usuarios.length,
      data: usuarios,
    };
  }
}