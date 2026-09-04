import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { IamService } from './iam.service';
import { CreateUsuarioTestDto } from './dto/create-usuario-test.dto';
import { FilterUsuarioDto } from './dto/filter-usuario.dto';

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
}