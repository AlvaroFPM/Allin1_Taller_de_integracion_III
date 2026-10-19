export type OrderRole = 'COMPRA' | 'VENTA';

export type OrderStatus = 'EN_PROCESO' | 'PAGO_CUSTODIADO' | 'COMPLETADA' | 'CANCELADA';

export type OrderItemType = 'SERVICIO' | 'ARTICULO' | 'FLETE' | 'TRABAJO';

export interface DashboardOrder {
  id: string;
  orderNumber: string;
  role: OrderRole;
  title: string;
  type: OrderItemType;
  category: string;
  status: OrderStatus;
  createdAt: string;
  price: number;
  currency?: string;
  escrowSecured: boolean;
  counterpartName: string;
  counterpartRole: 'Vendedor' | 'Comprador';
  counterpartAvatarUrl?: string;
  counterpartInitials: string;
  counterpartVerified?: boolean;
  location?: string;
  notes?: string;
}

export interface OrdersSummaryStats {
  activeOrdersCount: number;
  completedOrdersCount: number;
  totalSpentPurchases: number;
  totalEarnedSales: number;
  escrowSecuredAmount: number;
}

export const MOCK_ORDERS: DashboardOrder[] = [
  // --- Mis Compras ---
  {
    id: 'ord-101',
    orderNumber: 'ORD-2026-001',
    role: 'COMPRA',
    title: 'Reparación de Cañería Filtrada en Cocina',
    type: 'SERVICIO',
    category: 'Gasfitería & Hogar',
    status: 'PAGO_CUSTODIADO',
    createdAt: '18 Oct 2026',
    price: 35000,
    currency: 'CLP',
    escrowSecured: true,
    counterpartName: 'Juan Andrés Pérez',
    counterpartRole: 'Vendedor',
    counterpartInitials: 'JP',
    counterpartVerified: true,
    location: 'Providencia, RM',
    notes: 'Coordinado para el sábado a las 10:00 AM.',
  },
  {
    id: 'ord-102',
    orderNumber: 'ORD-2026-002',
    role: 'COMPRA',
    title: 'Flete: Traslado de Sillón y 4 Cajas',
    type: 'FLETE',
    category: 'Transporte & Mudanzas',
    status: 'EN_PROCESO',
    createdAt: '17 Oct 2026',
    price: 28000,
    currency: 'CLP',
    escrowSecured: true,
    counterpartName: 'Carlos Muñoz Rivas',
    counterpartRole: 'Vendedor',
    counterpartInitials: 'CM',
    counterpartVerified: true,
    location: 'Ruta: Ñuñoa a La Florida',
  },
  {
    id: 'ord-103',
    orderNumber: 'ORD-2026-003',
    role: 'COMPRA',
    title: 'Set de Herramientas Multiuso 48 Piezas',
    type: 'ARTICULO',
    category: 'Herramientas',
    status: 'COMPLETADA',
    createdAt: '12 Oct 2026',
    price: 18990,
    currency: 'CLP',
    escrowSecured: true,
    counterpartName: 'Mariana Gómez Torres',
    counterpartRole: 'Vendedor',
    counterpartInitials: 'MG',
    counterpartVerified: true,
    location: 'Santiago Centro, RM',
  },
  {
    id: 'ord-104',
    orderNumber: 'ORD-2026-004',
    role: 'COMPRA',
    title: 'Mantenimiento Eléctrico Tablero Domiciliario',
    type: 'SERVICIO',
    category: 'Electricidad',
    status: 'CANCELADA',
    createdAt: '05 Oct 2026',
    price: 42000,
    currency: 'CLP',
    escrowSecured: false,
    counterpartName: 'Roberto Díaz Silva',
    counterpartRole: 'Vendedor',
    counterpartInitials: 'RD',
    counterpartVerified: false,
    location: 'Las Condes, RM',
  },

  // --- Mis Ventas ---
  {
    id: 'ord-201',
    orderNumber: 'ORD-2026-005',
    role: 'VENTA',
    title: 'Instalación de Grifería y Lavaplatos',
    type: 'SERVICIO',
    category: 'Gasfitería & Hogar',
    status: 'EN_PROCESO',
    createdAt: '19 Oct 2026',
    price: 25000,
    currency: 'CLP',
    escrowSecured: true,
    counterpartName: 'Valentina Carrasco',
    counterpartRole: 'Comprador',
    counterpartInitials: 'VC',
    counterpartVerified: true,
    location: 'Santiago Centro, RM',
    notes: 'Cliente solicita llevar sellador extra.',
  },
  {
    id: 'ord-202',
    orderNumber: 'ORD-2026-006',
    role: 'VENTA',
    title: 'Flete Express: Retiro y Entrega de Refrigerador',
    type: 'FLETE',
    category: 'Transporte & Mudanzas',
    status: 'PAGO_CUSTODIADO',
    createdAt: '16 Oct 2026',
    price: 32000,
    currency: 'CLP',
    escrowSecured: true,
    counterpartName: 'Felipe Soto Alarcón',
    counterpartRole: 'Comprador',
    counterpartInitials: 'FS',
    counterpartVerified: true,
    location: 'Ruta: Maipú a San Miguel',
  },
  {
    id: 'ord-203',
    orderNumber: 'ORD-2026-007',
    role: 'VENTA',
    title: 'Caja de Herramientas Metálica 3 Niveles',
    type: 'ARTICULO',
    category: 'Herramientas',
    status: 'COMPLETADA',
    createdAt: '10 Oct 2026',
    price: 24990,
    currency: 'CLP',
    escrowSecured: true,
    counterpartName: 'Daniela Morales Peña',
    counterpartRole: 'Comprador',
    counterpartInitials: 'DM',
    counterpartVerified: true,
    location: 'Providencia, RM',
  },
];
