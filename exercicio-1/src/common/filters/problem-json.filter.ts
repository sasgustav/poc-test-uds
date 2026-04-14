import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { Request, Response } from 'express';
import { DomainException } from '../../cobranca/domain/exceptions/domain.exceptions';

/**
 * Problem+JSON (RFC 7807) global filter.
 *
 * Traduz exceções de domínio e HTTP para o formato padronizado com Content-Type
 * `application/problem+json`. Inclui traceId quando OpenTelemetry está ativo.
 */
@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemJsonFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, title, detail, code, extra } = this.classify(exception);

    const traceId = trace.getActiveSpan()?.spanContext().traceId;

    const body = {
      type: `https://api.cobranca/errors/${code}`,
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url,
      ...(traceId ? { traceId } : {}),
      ...extra,
    };

    if (status >= 500) {
      this.logger.error({
        msg: 'request.failed',
        status,
        code,
        title,
        err: exception instanceof Error ? exception.stack : String(exception),
      });
    }

    response
      .status(status)
      .type('application/problem+json')
      .json(body);
  }

  private classify(exception: unknown): {
    status: number;
    title: string;
    detail: string;
    code: string;
    extra?: Record<string, unknown>;
  } {
    if (exception instanceof DomainException) {
      const status = this.statusFromCode(exception.code);
      return {
        status,
        title: humanTitle(exception.code),
        detail: exception.message,
        code: exception.code,
        ...(exception.context ? { extra: { context: exception.context } } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const detail = extractHttpDetail(exception, r);
      return {
        status,
        title: exception.name.replace(/Exception$/, ''),
        detail,
        code: `http.${status}`,
        ...(typeof r === 'object' ? { extra: { errors: (r as Record<string, unknown>)['message'] } } : {}),
      };
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: 'Internal Server Error',
      detail: err.message,
      code: 'internal.error',
    };
  }

  private statusFromCode(code: string): number {
    if (code.endsWith('.not_found')) return HttpStatus.NOT_FOUND;
    if (code.includes('invalid') || code.includes('conflict')) {
      return code.includes('conflict') ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}

function humanTitle(code: string): string {
  return code
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function extractHttpDetail(exception: HttpException, r: string | object): string {
  if (typeof r === 'string') return r;
  const rec = r as Record<string, unknown>;
  const msg = rec['message'];
  if (Array.isArray(msg)) return (msg as string[]).join('; ');
  if (typeof msg === 'string') return msg;
  return exception.message;
}
