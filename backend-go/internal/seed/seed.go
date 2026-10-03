package seed

import (
	"log"

	"github.com/AlvaroFPM/Allin1_Taller_de_integracion_III/backend-go/internal/models"
	"gorm.io/gorm"
)

// Seed de datos de demo para el microservicio Catálogo.
// - Idempotente: no hace nada si ya hay categorías o publicaciones.
// - Sin imágenes: la tabla publicaciones no tiene columna para ellas.
// - IDUsuarioVendedor es un entero sin FK (catalog_db no tiene tabla usuarios).

const seedVendedores = 3 // IDs de vendedor 1..3 repartidos entre las publicaciones

type seedCategoria struct {
	Nombre string
	Slug   string
	Icono  string
}

type seedPub struct {
	Slug string
	Pub  models.Publicacion
}

var seedCategorias = []seedCategoria{
	{"Gasfitería", "gasfiteria", "https://placehold.co/64x64/png?text=Gas"},
	{"Electricidad", "electricidad", "https://placehold.co/64x64/png?text=Elec"},
	{"Limpieza del hogar", "limpieza-del-hogar", "https://placehold.co/64x64/png?text=Limp"},
	{"Delivery", "delivery", "https://placehold.co/64x64/png?text=Deli"},
	{"Transporte y fletes", "transporte-y-fletes", "https://placehold.co/64x64/png?text=Flete"},
	{"Mascotas", "mascotas", "https://placehold.co/64x64/png?text=Pets"},
	{"Tecnología y electrónica", "tecnologia-y-electronica", "https://placehold.co/64x64/png?text=Tec"},
	{"Hogar y muebles", "hogar-y-muebles", "https://placehold.co/64x64/png?text=Hogar"},
	{"Ropa y accesorios", "ropa-y-accesorios", "https://placehold.co/64x64/png?text=Ropa"},
	{"Clases y reparaciones", "clases-y-reparaciones", "https://placehold.co/64x64/png?text=Clases"},
}

var seedPublicaciones = []seedPub{
	// 1. Gasfitería
	{"gasfiteria", models.Publicacion{Titulo: "Reparación de fugas de agua en cañerías y llaves", Descripcion: "Detecto y reparo filtraciones en cañerías, llaves y flexibles. Atención el mismo día, materiales incluidos y garantía de 3 meses.", PrecioBase: 25000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"gasfiteria", models.Publicacion{Titulo: "Instalación de calefón y termo eléctrico", Descripcion: "Instalación segura de calefones a gas y termos eléctricos, con revisión de ventilación y pruebas de funcionamiento.", PrecioBase: 45000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"gasfiteria", models.Publicacion{Titulo: "Destape de cañerías y alcantarillado", Descripcion: "Destape de lavaplatos, baños y desagües con máquina rotativa. Llego en menos de 2 horas y trabajo sin romper pisos ni muros.", PrecioBase: 30000, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"gasfiteria", models.Publicacion{Titulo: "Necesito gásfiter para cambiar un calefón", Descripcion: "Busco gásfiter para retirar mi calefón antiguo e instalar uno nuevo que ya compré. Departamento en segundo piso, disponible el fin de semana.", PrecioBase: 60000, Ciudad: "Valparaíso", Region: "Valparaíso", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},
	{"gasfiteria", models.Publicacion{Titulo: "Busco gásfiter por filtración en baño", Descripcion: "Tengo una filtración bajo el lavamanos que moja el mueble. Necesito alguien que revise y repare esta semana, idealmente en la tarde.", PrecioBase: 35000, Ciudad: "Puerto Montt", Region: "Los Lagos", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 2. Electricidad
	{"electricidad", models.Publicacion{Titulo: "Instalación de enchufes, interruptores y tableros", Descripcion: "Instalo y reemplazo enchufes, interruptores y automáticos en casas y departamentos. Trabajo ordenado y con materiales de calidad.", PrecioBase: 35000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"electricidad", models.Publicacion{Titulo: "Electricista autorizado SEC para tu hogar", Descripcion: "Electricista con licencia SEC. Reviso instalaciones, corrijo fallas y entrego informe del trabajo realizado. Cotización sin costo.", PrecioBase: 28000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"electricidad", models.Publicacion{Titulo: "Instalación de luminarias y focos LED", Descripcion: "Cambio tu iluminación a LED e instalo lámparas, focos embutidos y cintas decorativas. Ahorra en la cuenta de luz.", PrecioBase: 50000, Ciudad: "Viña del Mar", Region: "Valparaíso", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"electricidad", models.Publicacion{Titulo: "Urgencias eléctricas 24 horas", Descripcion: "Atiendo cortocircuitos, cortes de luz y olor a quemado a cualquier hora. Diagnóstico rápido y reparación segura en tu domicilio.", PrecioBase: 40000, Ciudad: "La Serena", Region: "Coquimbo", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"electricidad", models.Publicacion{Titulo: "Busco electricista para instalar cargador de auto eléctrico", Descripcion: "Necesito un electricista que instale un punto de carga en mi estacionamiento, con su protección y canalización. Tengo el cargador comprado.", PrecioBase: 120000, Ciudad: "Antofagasta", Region: "Antofagasta", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 3. Limpieza del hogar
	{"limpieza-del-hogar", models.Publicacion{Titulo: "Aseo profundo para departamentos y casas", Descripcion: "Limpieza completa de cocina, baños, ventanas y pisos. Llevo mis propios productos e implementos. Ideal antes de una visita o cambio de casa.", PrecioBase: 30000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"limpieza-del-hogar", models.Publicacion{Titulo: "Limpieza de alfombras, tapices y colchones", Descripcion: "Lavado con máquina extractora que elimina manchas, olores y ácaros. Secado rápido y atención a domicilio.", PrecioBase: 20000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"limpieza-del-hogar", models.Publicacion{Titulo: "Limpieza post-construcción y post-remodelación", Descripcion: "Retiro de polvo, restos de pintura y cemento. Dejo tu casa lista para habitar. Equipo de dos personas.", PrecioBase: 80000, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"limpieza-del-hogar", models.Publicacion{Titulo: "Busco persona para aseo semanal de casa", Descripcion: "Necesito alguien responsable para aseo una vez por semana en casa de 3 dormitorios. Prefiero jueves o viernes, con referencias.", PrecioBase: 25000, Ciudad: "Rancagua", Region: "O'Higgins", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},
	{"limpieza-del-hogar", models.Publicacion{Titulo: "Necesito limpieza de fin de arriendo", Descripcion: "Debo entregar mi departamento y necesito una limpieza profunda para recuperar la garantía. Incluye cocina, baño y ventanas.", PrecioBase: 40000, Ciudad: "Valdivia", Region: "Los Ríos", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 4. Delivery
	{"delivery", models.Publicacion{Titulo: "Delivery express en moto dentro de la ciudad", Descripcion: "Entrego documentos, comida y paquetes pequeños en menos de 1 hora. Aviso por mensaje en cada etapa del recorrido.", PrecioBase: 3500, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"delivery", models.Publicacion{Titulo: "Retiro y entrega de encomiendas", Descripcion: "Retiro tus paquetes en la sucursal de courier y los llevo a tu puerta. También despacho a tus clientes si tienes un emprendimiento.", PrecioBase: 3000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"delivery", models.Publicacion{Titulo: "Compras de supermercado a domicilio", Descripcion: "Hago tus compras del supermercado según tu lista y las dejo en tu casa. Ideal para adultos mayores o personas con poco tiempo.", PrecioBase: 4000, Ciudad: "Valparaíso", Region: "Valparaíso", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"delivery", models.Publicacion{Titulo: "Reparto de pedidos para emprendedores", Descripcion: "Reparto diario para pastelerías, tiendas online y almacenes. Tarifas por tramo y descuento por volumen mensual.", PrecioBase: 2500, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"delivery", models.Publicacion{Titulo: "Busco repartidor para entrega diaria de tortas", Descripcion: "Mi pastelería necesita un repartidor con moto o auto para entregas por la tarde, de lunes a sábado. Se paga por viaje.", PrecioBase: 5000, Ciudad: "Viña del Mar", Region: "Valparaíso", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 5. Transporte y fletes
	{"transporte-y-fletes", models.Publicacion{Titulo: "Flete en camioneta para mudanzas pequeñas", Descripcion: "Traslado de muebles, electrodomésticos y cajas dentro de la ciudad. Incluye un ayudante para cargar y descargar.", PrecioBase: 40000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"transporte-y-fletes", models.Publicacion{Titulo: "Mudanzas completas con camión y ayudantes", Descripcion: "Camión de 3/4 con dos ayudantes, mantas y cuerdas de seguridad. Cuidamos tus muebles como si fueran nuestros.", PrecioBase: 90000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"transporte-y-fletes", models.Publicacion{Titulo: "Traslado de muebles entre ciudades del sur", Descripcion: "Viajes programados entre Puerto Montt, Osorno, Valdivia y Temuco. Carga asegurada y entrega en la puerta del destino.", PrecioBase: 150000, Ciudad: "Puerto Montt", Region: "Los Lagos", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"transporte-y-fletes", models.Publicacion{Titulo: "Necesito flete para trasladar refrigerador y lavadora", Descripcion: "Compré dos electrodomésticos usados y necesito que alguien los retire y los lleve a mi casa. Tercer piso con escalera.", PrecioBase: 45000, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},
	{"transporte-y-fletes", models.Publicacion{Titulo: "Busco transporte para mudanza de Osorno a Temuco", Descripcion: "Me cambio de ciudad el próximo mes y necesito camión para el contenido de un departamento de 2 dormitorios. Fecha flexible.", PrecioBase: 180000, Ciudad: "Osorno", Region: "Los Lagos", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 6. Mascotas
	{"mascotas", models.Publicacion{Titulo: "Paseo de perros con reporte y fotos", Descripcion: "Paseos de 1 hora en parques cercanos, en grupos pequeños. Te envío fotos y un breve reporte después de cada salida.", PrecioBase: 8000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"mascotas", models.Publicacion{Titulo: "Peluquería canina a domicilio", Descripcion: "Baño, corte de pelo y de uñas en tu casa, sin estrés para tu mascota. Trabajo con razas pequeñas y medianas.", PrecioBase: 18000, Ciudad: "Viña del Mar", Region: "Valparaíso", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"mascotas", models.Publicacion{Titulo: "Cuidado de mascotas en tu hogar por día", Descripcion: "Voy a tu casa a alimentar, jugar y sacar a pasear a tu perro o gato mientras viajas. Envío fotos todos los días.", PrecioBase: 12000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"mascotas", models.Publicacion{Titulo: "Adiestramiento básico para perros", Descripcion: "Clases personalizadas de obediencia, correa y convivencia con refuerzo positivo. Paquete de 4 sesiones a domicilio.", PrecioBase: 25000, Ciudad: "Talca", Region: "Maule", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"mascotas", models.Publicacion{Titulo: "Busco cuidador para mi gato durante vacaciones", Descripcion: "Viajo dos semanas en febrero y necesito alguien de confianza que pase a alimentar a mi gato y limpiar su arenero.", PrecioBase: 10000, Ciudad: "La Serena", Region: "Coquimbo", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 7. Tecnología y electrónica
	{"tecnologia-y-electronica", models.Publicacion{Titulo: "Notebook Lenovo ThinkPad usado, i5 con 8 GB de RAM", Descripcion: "Equipo en excelente estado, con SSD de 256 GB, batería de unas 4 horas y cargador original. Ideal para estudio y trabajo.", PrecioBase: 380000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"tecnologia-y-electronica", models.Publicacion{Titulo: "iPhone 11 de 128 GB con batería al 85%", Descripcion: "Liberado para todas las compañías, sin detalles en la pantalla y con carcasa incluida. Entrega en persona, se puede probar.", PrecioBase: 220000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"tecnologia-y-electronica", models.Publicacion{Titulo: "Monitor de 24 pulgadas Full HD", Descripcion: "Monitor con entrada HDMI y panel IPS, usado un año. Funciona perfecto y viene con sus cables.", PrecioBase: 95000, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"tecnologia-y-electronica", models.Publicacion{Titulo: "Busco comprar una tablet para estudiar", Descripcion: "Necesito una tablet de 10 pulgadas o más, de buen rendimiento, para tomar apuntes en la universidad. Acepto equipos usados en buen estado.", PrecioBase: 150000, Ciudad: "Valparaíso", Region: "Valparaíso", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},
	{"tecnologia-y-electronica", models.Publicacion{Titulo: "Busco consola de videojuegos con controles", Descripcion: "Quiero comprar una consola de la generación actual, usada y con al menos dos controles. Pago por transferencia y retiro en persona.", PrecioBase: 250000, Ciudad: "Antofagasta", Region: "Antofagasta", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 8. Hogar y muebles
	{"hogar-y-muebles", models.Publicacion{Titulo: "Sofá de 3 cuerpos en tela gris", Descripcion: "Sofá cómodo y firme, sin manchas ni roturas, de una casa sin mascotas. Retiro por el comprador.", PrecioBase: 120000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"hogar-y-muebles", models.Publicacion{Titulo: "Comedor de madera con 6 sillas", Descripcion: "Mesa de madera maciza de 1,60 metros con seis sillas tapizadas. Detalles leves de uso, muy resistente.", PrecioBase: 180000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"hogar-y-muebles", models.Publicacion{Titulo: "Escritorio con cajonera para home office", Descripcion: "Escritorio amplio con tres cajones y espacio para el computador. Muy buen estado, se entrega desarmado.", PrecioBase: 60000, Ciudad: "Rancagua", Region: "O'Higgins", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"hogar-y-muebles", models.Publicacion{Titulo: "Cama de 2 plazas con base cama y colchón", Descripcion: "Colchón de espuma de alta densidad con poco uso y base cama con cajones. Se vende en conjunto, con protector incluido.", PrecioBase: 140000, Ciudad: "Valdivia", Region: "Los Ríos", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"hogar-y-muebles", models.Publicacion{Titulo: "Busco refrigerador usado en buen estado", Descripcion: "Necesito un refrigerador de unos 250 a 300 litros que enfríe bien. Puedo ir a buscarlo con flete propio.", PrecioBase: 100000, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 9. Ropa y accesorios
	{"ropa-y-accesorios", models.Publicacion{Titulo: "Chaqueta de cuero negra, talla M", Descripcion: "Chaqueta de cuero sintético de corte clásico, usada solo un invierno. Forro en buen estado y cierres que funcionan perfecto.", PrecioBase: 45000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"ropa-y-accesorios", models.Publicacion{Titulo: "Zapatillas deportivas talla 42, poco uso", Descripcion: "Zapatillas usadas un par de veces, limpias y sin desgaste en la suela. Se entregan con su caja original.", PrecioBase: 35000, Ciudad: "Viña del Mar", Region: "Valparaíso", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"ropa-y-accesorios", models.Publicacion{Titulo: "Mochila de trekking de 50 litros", Descripcion: "Mochila con respaldo ventilado, cubre lluvia y múltiples compartimentos. Usada en dos viajes, en excelente estado.", PrecioBase: 60000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"ropa-y-accesorios", models.Publicacion{Titulo: "Busco chaqueta impermeable talla M", Descripcion: "Necesito una chaqueta impermeable para el invierno del sur, nueva o usada en buen estado. Prefiero colores oscuros.", PrecioBase: 40000, Ciudad: "Puerto Montt", Region: "Los Lagos", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},
	{"ropa-y-accesorios", models.Publicacion{Titulo: "Busco vestido de fiesta talla S", Descripcion: "Busco un vestido de fiesta largo, talla S, para un matrimonio en noviembre. Acepto usado si está bien cuidado.", PrecioBase: 30000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},

	// 10. Clases y reparaciones
	{"clases-y-reparaciones", models.Publicacion{Titulo: "Clases particulares de matemáticas para enseñanza media", Descripcion: "Profesor con experiencia en preparación para la PAES. Clases de una hora, presenciales u online, con material de ejercicios incluido.", PrecioBase: 15000, Ciudad: "Santiago", Region: "Metropolitana", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"clases-y-reparaciones", models.Publicacion{Titulo: "Clases de inglés conversacional", Descripcion: "Mejora tu fluidez con clases dinámicas centradas en conversación. Para adultos y jóvenes, todos los niveles, con horarios flexibles.", PrecioBase: 12000, Ciudad: "Temuco", Region: "La Araucanía", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"clases-y-reparaciones", models.Publicacion{Titulo: "Reparación de computadores y notebooks", Descripcion: "Formateo, limpieza interna, cambio de disco y eliminación de virus. Diagnóstico gratuito y entrega en 48 horas.", PrecioBase: 25000, Ciudad: "Valparaíso", Region: "Valparaíso", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"clases-y-reparaciones", models.Publicacion{Titulo: "Cambio de pantalla y batería de celulares", Descripcion: "Reparación en el día de pantallas quebradas y baterías agotadas, con repuestos de calidad y 3 meses de garantía.", PrecioBase: 30000, Ciudad: "Concepción", Region: "Biobío", TipoServicio: models.TipoOferta, Estado: models.EstadoActivo}},
	{"clases-y-reparaciones", models.Publicacion{Titulo: "Busco profesor de guitarra para principiante", Descripcion: "Quiero aprender guitarra desde cero y busco un profesor paciente para clases presenciales una vez por semana. Tengo guitarra acústica propia.", PrecioBase: 20000, Ciudad: "Iquique", Region: "Tarapacá", TipoServicio: models.TipoDemanda, Estado: models.EstadoActivo}},
}

// SeedIfEmpty inserta categorías y publicaciones de demo solo si ambas tablas están vacías.
// Llamar una vez al arrancar, después del AutoMigrate.
func SeedIfEmpty(db *gorm.DB) error {
	var nCats, nPubs int64
	if err := db.Model(&models.Categoria{}).Count(&nCats).Error; err != nil {
		return err
	}
	if err := db.Model(&models.Publicacion{}).Count(&nPubs).Error; err != nil {
		return err
	}
	if nCats > 0 || nPubs > 0 {
		log.Println("Seed: la base ya tiene datos, se omite")
		return nil
	}

	return db.Transaction(func(tx *gorm.DB) error {
		// 1. Categorías (primero, porque las publicaciones dependen de ellas)
		cats := make([]models.Categoria, 0, len(seedCategorias))
		for _, c := range seedCategorias {
			icono := c.Icono
			cats = append(cats, models.Categoria{Nombre: c.Nombre, Slug: c.Slug, IconoURL: &icono})
		}
		if err := tx.Create(&cats).Error; err != nil {
			return err
		}

		idPorSlug := make(map[string]uint, len(cats))
		for _, c := range cats {
			idPorSlug[c.Slug] = c.IDCategoria
		}

		// 2. Publicaciones
		pubs := make([]models.Publicacion, 0, len(seedPublicaciones))
		for i, s := range seedPublicaciones {
			p := s.Pub
			p.CategoriaID = idPorSlug[s.Slug]
			p.IDUsuarioVendedor = uint(i%seedVendedores + 1)
			pubs = append(pubs, p)
		}
		if err := tx.CreateInBatches(&pubs, 25).Error; err != nil {
			return err
		}

		log.Printf("Seed: %d categorías y %d publicaciones insertadas", len(cats), len(pubs))
		return nil
	})
}
