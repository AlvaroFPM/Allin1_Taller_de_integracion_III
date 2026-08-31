import { PrismaClient, RolUsuario, TipoDocumento, EstadoVerificacion } from '@prisma/client-iam';
import * as bcrypt from 'bcrypt';

const prismaIam = new PrismaClient();

export async function seedIam() {
  console.log('🌱 Poblando base de datos de IAM...');
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Limpieza inicial (idempotencia)
  await prismaIam.documentoVerificacion.deleteMany();
  await prismaIam.perfil.deleteMany();
  await prismaIam.usuario.deleteMany();

  // 2. Crear Cliente de prueba
  const cliente = await prismaIam.usuario.create({
    data: {
      rut: '12345678-9',
      nombres: 'Juan Carlos',
      apellidos: 'Pérez Gómez',
      correo: 'juan.perez@example.com',
      passwordHash,
      rol: RolUsuario.CLIENTE,
      estadoActivo: true,
      perfil: {
        create: {
          bioExperiencia: 'Usuario frecuente en búsqueda de servicios técnicos para el hogar.',
          habilidades: 'N/A',
          ciudad: 'Temuco',
          region: 'Araucanía',
          fotoPerfilUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
        },
      },
    },
  });

  // 3. Crear Proveedor de prueba
  const proveedor = await prismaIam.usuario.create({
    data: {
      rut: '98765432-1',
      nombres: 'María Elena',
      apellidos: 'Torres Soto',
      correo: 'maria.torres@example.com',
      passwordHash,
      rol: RolUsuario.PROVEEDOR,
      estadoActivo: true,
      perfil: {
        create: {
          bioExperiencia: 'Técnica certificada en instalaciones eléctricas y mantención con más de 8 años de experiencia.',
          habilidades: 'Electricidad, Gasfitería, Certificación SEC',
          disponibilidad: 'Lunes a Viernes 08:00 - 18:00',
          ciudad: 'Temuco',
          region: 'Araucanía',
          fotoPerfilUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
        },
      },
      documentos: {
        create: [
          {
            tipoDocumento: TipoDocumento.CARNET_FRENTE,
            archivoUrl: 'https://res.cloudinary.com/demo/carnet_frente.png',
            estadoVerificacion: EstadoVerificacion.APROBADO,
          },
          {
            tipoDocumento: TipoDocumento.CERTIFICADO_ANTECEDENTES,
            archivoUrl: 'https://res.cloudinary.com/demo/antecedentes.pdf',
            estadoVerificacion: EstadoVerificacion.APROBADO,
          },
        ],
      },
    },
  });

  console.log(`✅ IAM listo: Cliente ID ${cliente.idUsuario}, Proveedor ID ${proveedor.idUsuario}`);
  await prismaIam.$disconnect();
  return { idCliente: cliente.idUsuario, idProveedor: proveedor.idUsuario };
}