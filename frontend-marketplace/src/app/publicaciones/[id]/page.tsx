'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  PublicationDetailHero,
  PublicationDetailGallery,
  PublicationDetailContact,
  PublicationDetailSidebar,
} from '@/components/shared';
import { Modal, Button, toast } from '@/components/ui';
import { MOCK_CATALOG_PUBLICATIONS } from '@/types/catalog';

interface PublicationData {
  id: string;
  type: 'TRABAJO' | 'SERVICIO' | 'ARTICULO';
  title: string;
  description: string;
  price: number;
  currency: string;
  priceLabel: string;
  actionText: string;
  publishedRelative: string;
  categoryName: string;
  subcategoryName: string;
  origin?: string;
  destination?: string;
  images: string[];
  specs: {
    label: string;
    value: string;
  }[];
  seller: {
    id: number;
    name: string;
    avatarInitials: string;
    rating: number;
    reviewsCount: number;
    verifiedKYC: boolean;
    responseTime: string;
    completedJobs: number;
  };
  escrowProtected: boolean;
}

// Datos por defecto alineados al 100% con Boceto_DetallesPublicacion.png
const DEFAULT_PUBLICATION: PublicationData = {
  id: 'pub-2',
  type: 'TRABAJO',
  title: 'Traslado de Sillón y 4 Cajas a La Florida',
  description:
    'Se necesita furgón o camioneta techada para mover un sillón de 2 cuerpos y 4 cajas medianas con ropa. La carga es en un primer piso con estacionamiento habilitado. Necesito ayuda para cargar el sillón, las cajas las muevo yo.',
  price: 28000,
  currency: 'CLP',
  priceLabel: 'PRESUPUESTO DEL CLIENTE',
  actionText: 'Aceptar Trabajo',
  publishedRelative: 'Publicado hace 45 min',
  categoryName: 'Logística & Fletes',
  subcategoryName: 'Flete Urbano',
  origin: 'Ñuñoa',
  destination: 'La Florida',
  images: [],
  specs: [
    { label: 'FECHA Y HORA REQUERIDA', value: 'Hoy, antes de las 18:00 hrs' },
    { label: 'DISTANCIA ESTIMADA', value: '12.4 Kilómetros' },
    { label: 'VOLUMEN / PESO APROX.', value: 'Carga Mediana (Requiere Furgón)' },
    { label: 'AYUDA REQUERIDA', value: 'Sí, 1 persona para cargar' },
  ],
  seller: {
    id: 104,
    name: 'Nicolas',
    avatarInitials: 'EA',
    rating: 4.9,
    reviewsCount: 34,
    verifiedKYC: true,
    responseTime: '< 15 min',
    completedJobs: 18,
  },
  escrowProtected: true,
};

export default function PublicationDetailPage() {
  const params = useParams();
  const rawId = (params?.id as string) || '';

  const publication = React.useMemo<PublicationData>(() => {
    if (!rawId) return DEFAULT_PUBLICATION;

    const found = MOCK_CATALOG_PUBLICATIONS.find(
      (p) => String(p.id).toLowerCase() === rawId.toLowerCase(),
    );

    if (found) {
      return {
        id: found.id,
        type: found.type,
        title: found.title,
        description: found.description,
        price: found.price,
        currency: found.currency,
        priceLabel:
          found.priceTypeLabel === 'PRESUPUESTO ESCROW'
            ? 'PRESUPUESTO DEL CLIENTE'
            : found.priceTypeLabel,
        actionText: found.actionButtonText,
        publishedRelative: found.createdAtRelative,
        categoryName: found.categoryName,
        subcategoryName: found.categoryName,
        origin: found.location.includes(' a ') ? found.location.split(' a ')[0] : found.location,
        destination: found.location.includes(' a ')
          ? found.location.split(' a ')[1]
          : 'Destino acordado',
        images: [],
        specs: [
          {
            label: found.details.label1.replace(':', '').toUpperCase(),
            value: found.details.value1,
          },
          ...(found.details.label2
            ? [
                {
                  label: found.details.label2.replace(':', '').toUpperCase(),
                  value: found.details.value2 || '',
                },
              ]
            : []),
          {
            label: 'GARANTÍA DE PAGO',
            value: found.escrowProtected ? 'Custodia Escrow Activa' : 'Pago Directo',
          },
          {
            label: 'VERIFICACIÓN',
            value: found.verifiedUser ? 'Usuario Verificado KYC' : 'Estándar',
          },
        ],
        seller: {
          id: 104,
          name: found.details.value2?.replace(' (Verificada)', '') || 'Nicolas',
          avatarInitials: (found.details.value2 || 'Nicolas').slice(0, 2).toUpperCase(),
          rating: 4.9,
          reviewsCount: 34,
          verifiedKYC: found.verifiedUser ?? true,
          responseTime: '< 15 min',
          completedJobs: 18,
        },
        escrowProtected: found.escrowProtected ?? true,
      };
    }

    return DEFAULT_PUBLICATION;
  }, [rawId]);

  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = React.useState(false);
  const [applyMessage, setApplyMessage] = React.useState('');
  const [directMessage, setDirectMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirmApplication = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsApplyModalOpen(false);
      setApplyMessage('');
      toast.success(
        `Tu postulación a "${publication.title}" fue enviada con éxito. Te avisaremos cuando el cliente responda.`,
        { title: '¡Postulación Enviada!' },
      );
    }, 600);
  };

  const handleSendMessage = () => {
    if (!directMessage.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsMessageModalOpen(false);
      setDirectMessage('');
      toast.success(
        `Mensaje enviado a ${publication.seller.name}. Podrás continuar la conversación en tu panel de mensajes.`,
        { title: 'Mensaje Enviado' },
      );
    }, 600);
  };

  return (
    <div className="min-h-screen bg-surface-base py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        {/* Cabecera Hero y Trayecto */}
        <PublicationDetailHero
          title={publication.title}
          type={publication.type}
          publishedRelative={publication.publishedRelative}
          categoryName={publication.categoryName}
          subcategoryName={publication.subcategoryName}
          origin={publication.origin}
          destination={publication.destination}
        />

        {/* Layout Principal: Detalle + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Columna Izquierda (8 cols): Galería, Descripción y Specs */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8">
            {/* Galería (si existen imágenes) */}
            {publication.images && publication.images.length > 0 && (
              <section className="bg-surface-main border border-border-base rounded-3xl p-6 sm:p-8 shadow-2xs">
                <PublicationDetailGallery images={publication.images} title={publication.title} />
              </section>
            )}

            {/* Descripción del Servicio */}
            <section className="bg-surface-main border border-border-base rounded-3xl p-6 sm:p-8 shadow-2xs space-y-4">
              <h2 className="text-lg sm:text-xl font-bold text-content-main">
                Descripción del Servicio
              </h2>
              <p className="text-sm sm:text-base text-content-main/90 leading-relaxed whitespace-pre-line">
                {publication.description}
              </p>
            </section>

            {/* Especificaciones Técnicas (Grid 2x2 como en el mockup) */}
            <section className="bg-surface-main border border-border-base rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
              <h2 className="text-lg sm:text-xl font-bold text-content-main">
                Especificaciones Técnicas
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {publication.specs.map((spec) => (
                  <div key={spec.label} className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider text-content-muted uppercase">
                      {spec.label}
                    </span>
                    <p className="text-sm sm:text-base font-bold text-content-main">{spec.value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Columna Derecha (4 cols): Sidebar Presupuesto + Info Contacto */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            <PublicationDetailSidebar
              price={publication.price}
              currency={publication.currency}
              priceLabel={publication.priceLabel}
              actionText={publication.actionText}
              onAction={() => setIsApplyModalOpen(true)}
            />

            <PublicationDetailContact
              sellerId={publication.seller.id}
              sellerName={publication.seller.name}
              avatarInitials={publication.seller.avatarInitials}
              rating={publication.seller.rating}
              reviewsCount={publication.seller.reviewsCount}
              verifiedKYC={publication.seller.verifiedKYC}
              responseTime={publication.seller.responseTime}
              completedJobs={publication.seller.completedJobs}
              onSendMessage={() => setIsMessageModalOpen(true)}
            />
          </aside>
        </div>
      </div>

      {/* Modal: Aceptar Trabajo */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title={`Postular a "${publication.title}"`}
        description="Confirma tu interés en realizar este trabajo. El presupuesto está asegurado bajo custodia Escrow."
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => setIsApplyModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirmApplication} isLoading={isSubmitting}>
              Confirmar y Enviar Oferta
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <div className="bg-surface-base border border-border-base rounded-xl p-3 text-xs space-y-1">
            <div className="flex justify-between text-content-muted">
              <span>Monto ofrecido:</span>
              <strong className="text-content-main text-sm">
                ${publication.price.toLocaleString('es-CL')} {publication.currency}
              </strong>
            </div>
            <div className="flex justify-between text-content-muted">
              <span>Protección:</span>
              <span className="text-emerald-800 font-semibold">Garantía Escrow Activa</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="apply-notes" className="block text-xs font-bold text-content-main">
              Nota o disponibilidad (opcional):
            </label>
            <textarea
              id="apply-notes"
              rows={3}
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              placeholder="Ej: Tengo disponibilidad inmediata y vehículo acondicionado..."
              className="w-full text-xs p-3 rounded-xl border border-border-base bg-surface-main text-content-main focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Enviar Mensaje */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title={`Enviar Mensaje a ${publication.seller.name}`}
        description="Pregunta directamente sobre detalles, horarios o condiciones del servicio."
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => setIsMessageModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSendMessage}
              isLoading={isSubmitting}
              disabled={!directMessage.trim()}
            >
              Enviar Mensaje
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2">
          <textarea
            rows={4}
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            placeholder={`Escribe aquí tu consulta para ${publication.seller.name}...`}
            className="w-full text-xs p-3 rounded-xl border border-border-base bg-surface-main text-content-main focus:outline-hidden focus:ring-2 focus:ring-brand"
          />
        </div>
      </Modal>
    </div>
  );
}
