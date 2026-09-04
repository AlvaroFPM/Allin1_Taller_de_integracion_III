import { Controller, Get, Post, Body, ValidationPipe, UsePipes } from '@nestjs/common';
import { IamService } from './iam.service';
import { CreateUsuarioTestDto } from './dto/create-usuario-test.dto';

@Controller()
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get()
  getHello(): string {
    return this.iamService.getHello();
  }

  @Get('test-db')
  async testDb() {
    return await this.iamService.testDatabaseConnection();
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