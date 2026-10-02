export interface UserProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  rut: string;
  phone: string;
  city: string;
  region: string;
  bio: string;
  role: 'CLIENTE' | 'PROVEEDOR' | 'ADMIN';
  isVerified: boolean;
  avatarUrl?: string;
}

export type ProfileActivityFilter = 'ALL' | 'SOLICITUD' | 'TRABAJO' | 'ARTICULO';

export interface ProfileActivityItem {
  id: string;
  type: 'SOLICITUD' | 'TRABAJO' | 'ARTICULO';
  typeLabel: string;
  category: string;
  title: string;
  statusBadge: string;
  location: string;
  dateRelative: string;
  priceLabel: string;
  price: number;
  assignedToOrClient?: string;
}

export interface EditProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  bio: string;
}

export interface ProfileEditModalProps {
  isOpen: boolean;
  initialData: EditProfileFormData;
  onClose: () => void;
  onSave: (data: EditProfileFormData) => void;
}

export const DEFAULT_ACTIVITIES: ProfileActivityItem[] = [
  {
    id: 'act-1',
    type: 'SOLICITUD',
    typeLabel: 'SOLICITUD CREADA',
    category: 'Mantenimiento del Hogar',
    title: 'Reparación de Cañería Filtrada en Cocina',
    statusBadge: 'Buscando Proveedor',
    location: 'Providencia, RM',
    dateRelative: 'Publicado: Hace 2 días',
    priceLabel: 'PRESUPUESTO A PAGAR',
    price: 35000,
  },
  {
    id: 'act-2',
    type: 'TRABAJO',
    typeLabel: 'TRABAJO ACEPTADO',
    category: 'Transporte & Fletes',
    title: 'Flete: Traslado de Sillón y 4 Cajas',
    statusBadge: 'En Curso (Asignado a ti)',
    location: 'Ruta: Ñuñoa a La Florida',
    dateRelative: 'Cliente: Mariana Gómez',
    priceLabel: 'GANANCIA A COBRAR',
    price: 28000,
  },
  {
    id: 'act-3',
    type: 'ARTICULO',
    typeLabel: 'ARTÍCULO EN VENTA',
    category: 'Herramientas',
    title: 'Set de Herramientas Multiuso 48 Piezas',
    statusBadge: 'Disponible',
    location: 'Santiago Centro, RM',
    dateRelative: 'Stock: 1 unidad',
    priceLabel: 'PRECIO DE VENTA',
    price: 18990,
  },
];
