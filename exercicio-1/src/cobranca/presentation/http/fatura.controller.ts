import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import type { Env } from '../../../config/env.schema';
import { AtualizarStatusFaturaUseCase } from '../../application/use-cases/atualizar-status.use-case';
import { BuscarFaturaUseCase } from '../../application/use-cases/buscar-fatura.use-case';
import { CriarFaturaUseCase } from '../../application/use-cases/criar-fatura.use-case';
import { ListarFaturasUseCase } from '../../application/use-cases/listar-faturas.use-case';
import { CreateFaturaDto } from './dtos/create-fatura.dto';
import { FaturaResponseDto } from './dtos/fatura-response.dto';
import { ListFaturasQuery } from './dtos/list-faturas.query';
import { buildPagination } from './dtos/paginated.dto';
import { UpdateFaturaStatusDto } from './dtos/update-fatura-status.dto';

@ApiTags('faturas')
@ApiSecurity('ApiKey')
@ApiHeader({ name: 'X-User-Id', description: 'UUID do tenant autenticado (demo).', required: false })
@Controller({ path: 'faturas', version: '1' })
export class FaturaController {
  constructor(
    private readonly criar: CriarFaturaUseCase,
    private readonly buscar: BuscarFaturaUseCase,
    private readonly listar: ListarFaturasUseCase,
    private readonly atualizarStatus: AtualizarStatusFaturaUseCase,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Cria fatura + agenda régua de lembretes',
    description:
      'Grava fatura, 3 lembretes (D-3, D+1, D+7 às 09:00 no TZ do devedor) e evento outbox na mesma transação. Aceita `Idempotency-Key`.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Chave para retries seguros (até 128 chars).' })
  @ApiCreatedResponse({ type: FaturaResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Validação do domínio falhou (problem+json).' })
  @ApiConflictResponse({ description: 'Idempotency-Key reutilizada com payload diferente.' })
  @ApiUnauthorizedResponse({ description: 'API key ausente ou inválida.' })
  async criarFatura(
    @Body() dto: CreateFaturaDto,
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FaturaResponseDto> {
    const fatura = await this.criar.executar(
      {
        userId,
        nomeDevedor: dto.nomeDevedor,
        emailDevedor: dto.emailDevedor,
        descricao: dto.descricao,
        valor: dto.valor,
        dataVencimento: dto.dataVencimento,
        timezone: dto.timezone,
      },
      this.config.get('DEFAULT_TIMEZONE', { infer: true }),
    );
    res.setHeader('Location', `/v1/faturas/${fatura.id}`);
    res.setHeader('ETag', fatura.etag());
    return FaturaResponseDto.fromDomain(fatura);
  }

  @Get()
  @ApiOperation({ summary: 'Lista faturas do tenant autenticado (paginação offset).' })
  @ApiOkResponse({ description: 'Página de faturas com metadata.' })
  async listarFaturas(
    @CurrentUser('id') userId: string,
    @Query() q: ListFaturasQuery,
  ): Promise<{ data: FaturaResponseDto[]; pagination: ReturnType<typeof buildPagination> }> {
    const { items, total } = await this.listar.executar({
      userId,
      page: q.page,
      pageSize: q.pageSize,
    });
    return {
      data: items.map((f) => FaturaResponseDto.fromDomain(f)),
      pagination: buildPagination(q.page, q.pageSize, total),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca fatura por id (escopada ao tenant). Suporta ETag/If-None-Match.' })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiOkResponse({ type: FaturaResponseDto })
  @ApiNotFoundResponse({ description: 'Fatura inexistente ou pertence a outro tenant.' })
  async buscarFatura(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FaturaResponseDto | undefined> {
    const fatura = await this.buscar.executar(id, userId);
    const etag = fatura.etag();
    res.setHeader('ETag', etag);
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return FaturaResponseDto.fromDomain(fatura);
  }

  @Patch(':id/status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Transição de status validada pela máquina de estados do domínio.',
    description: 'Transições permitidas: PENDENTE→PAGA, PENDENTE→CANCELADA. PAGA/CANCELADA são terminais.',
  })
  @ApiOkResponse({ type: FaturaResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'Transição de status não permitida.' })
  async mudarStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFaturaStatusDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FaturaResponseDto> {
    const fatura = await this.atualizarStatus.executar(id, userId, dto.status);
    res.setHeader('ETag', fatura.etag());
    return FaturaResponseDto.fromDomain(fatura);
  }
}
