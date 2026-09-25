export type CatalogPublicationType = 'TRABAJO' | 'SERVICIO' | 'ARTICULO';

export interface CatalogPublication {
  id: string;
  type: CatalogPublicationType;
  title: string;
  description: string;
  price: number;
  currency: 'CLP';
  priceTypeLabel: 'PRESUPUESTO ESCROW' | 'PRECIO UNITARIO' | 'GANANCIA POR RUTA';
  actionButtonText: 'Aceptar Trabajo' | 'Comprar Artículo';
  createdAtRelative: string;
  categorySlug: 'mantenimiento' | 'transporte' | 'logistica' | 'articulos';
  categoryName: string;
  location: string;
  details: {
    label1: string;
    value1: string;
    label2?: string;
    value2?: string;
  };
  escrowProtected?: boolean;
  verifiedUser?: boolean;
}

export interface CatalogFilterState {
  search: string;
  comuna: string;
  activeTab: 'all' | CatalogPublicationType;
  categories: string[];
  minPrice: number | '';
  maxPrice: number | '';
  escrowOnly: boolean;
  verifiedOnly: boolean;
  sortBy: 'recent' | 'price_asc' | 'price_desc';
}

export const MOCK_CATALOG_PUBLICATIONS: CatalogPublication[] = [
  {
    id: 'pub-1',
    type: 'TRABAJO',
    title: 'Reparación de Cañería Filtrada en Cocina',
    description:
      'Se requiere cambio urgente de codo en cañería de cobre bajo lavaplatos. Materiales comprados en el lugar.',
    price: 35000,
    currency: 'CLP',
    priceTypeLabel: 'PRESUPUESTO ESCROW',
    actionButtonText: 'Aceptar Trabajo',
    createdAtRelative: 'Hace 12 min',
    categorySlug: 'mantenimiento',
    categoryName: 'Mantenimiento Hogar',
    location: 'Providencia, RM',
    details: {
      label1: 'Ubicación:',
      value1: 'Providencia, RM',
      label2: 'Publicado por:',
      value2: 'Mariana Gómez (Verificada)',
    },
    escrowProtected: true,
    verifiedUser: true,
  },
  {
    id: 'pub-2',
    type: 'TRABAJO',
    title: 'Flete: Traslado de Sillón y 4 Cajas',
    description:
      'Se necesita furgón o camioneta para mover un sillón de 2 cuerpos y 4 cajas medianas. Carga en primer piso.',
    price: 28000,
    currency: 'CLP',
    priceTypeLabel: 'PRESUPUESTO ESCROW',
    actionButtonText: 'Aceptar Trabajo',
    createdAtRelative: 'Hace 25 min',
    categorySlug: 'transporte',
    categoryName: 'Transporte & Fletes',
    location: 'Ñuñoa a La Florida',
    details: {
      label1: 'Trayecto:',
      value1: 'Ñuñoa a La Florida',
      label2: 'Horario:',
      value2: 'Hoy, 18:00 hrs',
    },
    escrowProtected: true,
    verifiedUser: false,
  },
  {
    id: 'pub-3',
    type: 'ARTICULO',
    title: 'Set de Herramientas Multiuso 48 Piezas',
    description:
      'Kit completo para reparaciones domésticas en maletín rígido. Nuevo y sellado, opción de delivery integrado.',
    price: 18990,
    currency: 'CLP',
    priceTypeLabel: 'PRECIO UNITARIO',
    actionButtonText: 'Comprar Artículo',
    createdAtRelative: 'Hace 1 hora',
    categorySlug: 'articulos',
    categoryName: 'E-Commerce & Artículos',
    location: 'Santiago Centro',
    details: {
      label1: 'Vendedor:',
      value1: 'Juan P. • Santiago',
      label2: 'Stock disponible:',
      value2: '3 unidades',
    },
    escrowProtected: true,
    verifiedUser: true,
  },
  {
    id: 'pub-4',
    type: 'TRABAJO',
    title: 'Reparto Express de 3 Encomiendas',
    description:
      'Retiro en tienda física y despacho en 3 direcciones residenciales cercanas con seguimiento por GPS.',
    price: 16500,
    currency: 'CLP',
    priceTypeLabel: 'GANANCIA POR RUTA',
    actionButtonText: 'Aceptar Trabajo',
    createdAtRelative: 'Hace 2 horas',
    categorySlug: 'logistica',
    categoryName: 'Logística & Delivery',
    location: 'Las Condes a Vitacura',
    details: {
      label1: 'Ruta:',
      value1: 'Las Condes a Vitacura',
      label2: 'Carga:',
      value2: 'Paquetería liviana (< 5kg)',
    },
    escrowProtected: true,
    verifiedUser: true,
  },
  {
    id: 'pub-5',
    type: 'SERVICIO',
    title: 'Instalación y Certificación de Tablero Eléctrico',
    description:
      'Electricista autorizado SEC ofrece regularización de automáticos, diferenciales y cuadro eléctrico.',
    price: 65000,
    currency: 'CLP',
    priceTypeLabel: 'PRESUPUESTO ESCROW',
    actionButtonText: 'Aceptar Trabajo',
    createdAtRelative: 'Hace 3 horas',
    categorySlug: 'mantenimiento',
    categoryName: 'Mantenimiento Hogar',
    location: 'San Miguel, RM',
    details: {
      label1: 'Profesional:',
      value1: 'Carlos R. (SEC Clase B)',
      label2: 'Garantía:',
      value2: '6 meses certificada',
    },
    escrowProtected: true,
    verifiedUser: true,
  },
  {
    id: 'pub-6',
    type: 'ARTICULO',
    title: 'Escalera de Aluminio Tijera 5 Peldaños',
    description:
      'Escalera reforzada de uso profesional liviana. Carga máxima 150 kg. Estado seminuevo.',
    price: 42000,
    currency: 'CLP',
    priceTypeLabel: 'PRECIO UNITARIO',
    actionButtonText: 'Comprar Artículo',
    createdAtRelative: 'Hace 4 horas',
    categorySlug: 'articulos',
    categoryName: 'E-Commerce & Artículos',
    location: 'Ñuñoa, RM',
    details: {
      label1: 'Vendedor:',
      value1: 'Patricio M.',
      label2: 'Stock disponible:',
      value2: '1 unidad',
    },
    escrowProtected: false,
    verifiedUser: true,
  },
];
