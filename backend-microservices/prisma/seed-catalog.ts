import { PrismaClient, TipoServicio, EstadoPublicacion, TipoMultimedia } from '@prisma/client-catalog';
import { Prisma } from '@prisma/client-catalog';

const prismaCatalog = new PrismaClient();

export async function seedCatalog(idProveedorIam: number) {
  console.log('🌱 Poblando base de datos de Catalog...');

  // 1. Limpieza inicial
  await prismaCatalog.guardadoFavorito.deleteMany();
  await prismaCatalog.publicacionEtiqueta.deleteMany();
  await prismaCatalog.multimediaPublicacion.deleteMany();
  await prismaCatalog.publicacion.deleteMany();
  await prismaCatalog.etiqueta.deleteMany();
  await prismaCatalog.categoria.deleteMany();

  // 2. Crear Categorías base
  const categoriaHogar = await prismaCatalog.categoria.create({
    data: {
      nombre: 'Mantenimiento del Hogar',
      slug: 'mantenimiento-hogar',
      iconoUrl: 'https://cdn-icons-png.flaticon.com/512/619/619034.png',
    },
  });

  const categoriaInformatica = await prismaCatalog.categoria.create({
    data: {
      nombre: 'Tecnología y Soporte TI',
      slug: 'tecnologia-soporte-ti',
      iconoUrl: 'https://cdn-icons-png.flaticon.com/512/2933/2933245.png',
    },
  });

  // 3. Crear Etiquetas
  const etiquetaElec = await prismaCatalog.etiqueta.create({ data: { nombre: 'Electricidad' } });
  const etiquetaUrg = await prismaCatalog.etiqueta.create({ data: { nombre: 'Urgencias 24/7' } });

  // 4. Crear Publicación vinculada al ID lógico del proveedor
  const publicacion = await prismaCatalog.publicacion.create({
    data: {
      idUsuarioVendedor: idProveedorIam,
      idCategoria: categoriaHogar.idCategoria,
      titulo: 'Instalación y Reparación de Circuitos Eléctricos Domiciliarios',
      descripcion: 'Servicio técnico integral de tableros eléctricos, certificación de redes y resolución de cortocircuitos.',
      tipoServicio: TipoServicio.OFERTA,
      precioBase: new Prisma.Decimal(25000.00),
      ciudad: 'Temuco',
      region: 'Araucanía',
      estado: EstadoPublicacion.ACTIVO,
      multimedia: {
        create: [
          {
            archivoUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e',
            tipoArchivo: TipoMultimedia.IMAGEN,
          },
        ],
      },
      etiquetas: {
        create: [
          { idEtiqueta: etiquetaElec.idEtiqueta },
          { idEtiqueta: etiquetaUrg.idEtiqueta },
        ],
      },
    },
  });

  console.log(`✅ Catalog listo: Publicación ID ${publicacion.idPublicacion} creada.`);
  await prismaCatalog.$disconnect();
}