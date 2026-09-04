import { Controller, Get, Post, Body, ValidationPipe, UsePipes } from '@nestjs/common';
import { IamService } from './iam.service';
import { CreateUsuarioTestDto } from './dto/create-usuario-test.dto';

@Controller('usuarios')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  // Diagnóstico de conectividad para desarrollo
  @Get('health-db')
  async healthDb() {
    return await this.iamService.testDatabaseConnection();
  }

  @Post()
  async create(@Body() createUsuarioDto: CreateUsuarioTestDto) {
    return await this.iamService.createUsuario(createUsuarioDto);
  }

  @Get()
  async findAll(@Query() filtros: FilterUsuarioDto) {
    return await this.iamService.findUsuarios(filtros);
  }

  @Post('usuarios-test')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() createUsuarioDto: CreateUsuarioTestDto) {
    return await this.iamService.createUsuarioTest(createUsuarioDto);
  }

  @Get('usuarios-test')
  async findAll() {
    return await this.iamService.getUsuariosTest();
  }
}