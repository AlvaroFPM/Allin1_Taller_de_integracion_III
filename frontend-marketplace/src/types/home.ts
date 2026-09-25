export interface CategoryPill {
  id: string;
  label: string;
  icon: string;
  href: string;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
  offset?: 'top' | 'bottom' | 'none';
}

export type PublicationBadgeVariant = 'serv' | 'trans' | 'item';

export interface RecentPublication {
  id: string;
  badgeLabel: string;
  badgeVariant: PublicationBadgeVariant;
  title: string;
  location: string;
  price: string;
  href: string;
}

export interface CustomerReview {
  id: string;
  reviewerName: string;
  reviewerInitials: string;
  serviceTag: string;
  rating: number;
  comment: string;
  completedDate: string;
}

export interface StepItem {
  number: string;
  title: string;
  description: string;
  icon: string;
  tag: string;
}
