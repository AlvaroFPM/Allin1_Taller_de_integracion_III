export type PurchaseItemType = 'SERVICIO' | 'ARTICULO' | 'FLETE' | 'TRABAJO' | 'PUBLICACION';

export interface PurchaseSellerSummary {
  id: string | number;
  name: string;
  avatarUrl?: string;
  avatarInitials?: string;
  isVerified?: boolean;
  rating?: number;
  city?: string;
}

export interface PurchaseConfirmationItem {
  id: string | number;
  title: string;
  type: PurchaseItemType;
  category?: string;
  price: number;
  currency?: string;
  serviceFee?: number;
  seller: PurchaseSellerSummary;
  location?: string;
  deliveryEstimate?: string;
}

export interface PurchaseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (notes?: string) => void | Promise<void>;
  item: PurchaseConfirmationItem;
  isLoading?: boolean;
  errorMessage?: string | null;
}
