import { seedIam } from './seed-iam';
import { seedCatalog } from './seed-catalog';

async function main() {
  console.log('🚀 Iniciando proceso de Seed Global...');
  try {
    const { idProveedor } = await seedIam();
    await seedCatalog(idProveedor);
    console.log('🎉 Todos los datos de prueba han sido inyectados exitosamente.');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
    process.exit(1);
  }
}

main();