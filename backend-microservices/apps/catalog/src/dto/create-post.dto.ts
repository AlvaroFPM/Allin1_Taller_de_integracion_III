export class CreatePostDto {
  idUsuarioVendedor!: number;
  idCategoria!: number;
  titulo!: string;
  descripcion!: string;
  precioBase!: number;
  ciudad!: string;
  region!: string;
  tipoServicio?: 'OFERTA' | 'DEMANDA';
}