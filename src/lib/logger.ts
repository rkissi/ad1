// Production-Grade Logging System
import { createLogger, format, transports } from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = format;

// Custom log format
const customFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'metaverse-ads-api' },
  transports: [
    // Write all logs to console
    new transports.Console({
      format: combine(
        colorize(),
        customFormat
      )
    }),
    // Write all logs to combined.log
    new transports.File({ 
      filename: path.join('logs', 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Write error logs to error.log
    new transports.File({ 
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join('logs', 'exceptions.log') })
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join('logs', 'rejections.log') })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Export logger methods
export const log = {
  info: (message: string, meta?: any) => logger.info(message, meta),
  error: (message: string, error?: Error | any, meta?: any) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
      logger.error(message, { error, ...meta });
    }
  },
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta)
};

// Request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.http('HTTP Request', logData);
    }
  });
  
  next();
};

export default logger;
