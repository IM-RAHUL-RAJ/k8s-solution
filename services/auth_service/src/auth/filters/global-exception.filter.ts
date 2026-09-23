import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException, HttpException)
export class GlobalExceptionFilter implements ExceptionFilter {
  private logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: BadRequestException | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any = {
      errorCode: 'UNKNOWN',
      message: 'Internal server error',
    };

    if (exception instanceof BadRequestException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      errorResponse = {
        errorCode: 'VAL-422',
        message: 'Invalid input',
      };
      this.logger.warn(
        `[AUTH_EVENT] validation_error path=${request.url} errors=${JSON.stringify(exception.getResponse())}`
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // If it's already in the format we want (has errorCode), use it as is
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'errorCode' in exceptionResponse
      ) {
        errorResponse = exceptionResponse;
      } else {
        errorResponse = {
          errorCode: `HTTP-${status}`,
          message: exception.message,
        };
      }
    }

    response.status(status).json(errorResponse);
  }
}
