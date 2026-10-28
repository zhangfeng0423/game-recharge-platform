/**
 * 通用错误处理框架
 * 提供统一的错误类型系统、错误处理工具函数和错误恢复策略
 */

// 错误严重程度枚举
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// 错误类别枚举
export enum ErrorCategory {
  // 认证和授权错误
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  SESSION_EXPIRED = "session_expired",

  // 数据库错误
  DATABASE_CONNECTION = "database_connection",
  DATABASE_QUERY = "database_query",
  DATABASE_CONSTRAINT = "database_constraint",
  DATABASE_TIMEOUT = "database_timeout",

  // 网络错误
  NETWORK_TIMEOUT = "network_timeout",
  NETWORK_CONNECTION = "network_connection",
  API_RATE_LIMIT = "api_rate_limit",

  // 支付错误
  PAYMENT_DECLINED = "payment_declined",
  PAYMENT_PROCESSING = "payment_processing",
  PAYMENT_TIMEOUT = "payment_timeout",

  // 业务逻辑错误
  VALIDATION = "validation",
  BUSINESS_LOGIC = "business_logic",
  RESOURCE_NOT_FOUND = "resource_not_found",

  // 系统错误
  SYSTEM_ERROR = "system_error",
  CONFIGURATION_ERROR = "configuration_error",
  EXTERNAL_SERVICE = "external_service",

  // 通用错误
  UNKNOWN = "unknown",
}

// 基础错误接口
export interface BaseError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, any>;
  cause?: Error;
  retryable: boolean;
  userMessage?: string;
}

// 增强的错误类
export class EnhancedError extends Error implements BaseError {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;
  public readonly cause?: Error;
  public readonly retryable: boolean;
  public readonly userMessage?: string;

  constructor(config: {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    context?: Record<string, any>;
    cause?: Error;
    retryable?: boolean;
    userMessage?: string;
  }) {
    super(config.message);
    this.name = "EnhancedError";
    this.code = config.code;
    this.category = config.category;
    this.severity = config.severity;
    this.timestamp = new Date();
    this.context = config.context;
    this.cause = config.cause;
    this.retryable = config.retryable ?? false;
    this.userMessage = config.userMessage;

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnhancedError);
    }
  }

  // 转换为JSON格式
  toJSON(): Omit<BaseError, "cause"> & { cause?: string } {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause?.message,
      retryable: this.retryable,
      userMessage: this.userMessage,
    };
  }

  // 获取用户友好的错误消息
  getUserMessage(locale: "en" | "zh" = "en"): string {
    return this.userMessage || this.getDefaultUserMessage(locale);
  }

  private getDefaultUserMessage(locale: "en" | "zh"): string {
    const messages: Record<ErrorCategory, Record<"en" | "zh", string>> = {
      [ErrorCategory.AUTHENTICATION]: {
        en: "Authentication failed. Please log in again.",
        zh: "身份验证失败。请重新登录。",
      },
      [ErrorCategory.AUTHORIZATION]: {
        en: "You do not have permission to perform this action.",
        zh: "您没有权限执行此操作。",
      },
      [ErrorCategory.SESSION_EXPIRED]: {
        en: "Your session has expired. Please log in again.",
        zh: "您的会话已过期。请重新登录。",
      },
      [ErrorCategory.DATABASE_CONNECTION]: {
        en: "Service temporarily unavailable. Please try again.",
        zh: "服务暂时不可用。请重试。",
      },
      [ErrorCategory.DATABASE_QUERY]: {
        en: "Data processing error. Please try again.",
        zh: "数据处理错误。请重试。",
      },
      [ErrorCategory.DATABASE_CONSTRAINT]: {
        en: "Data constraint violation. Please check your input.",
        zh: "数据约束冲突。请检查您的输入。",
      },
      [ErrorCategory.DATABASE_TIMEOUT]: {
        en: "Database operation timed out. Please try again.",
        zh: "数据库操作超时。请重试。",
      },
      [ErrorCategory.NETWORK_TIMEOUT]: {
        en: "Request timed out. Please check your connection and try again.",
        zh: "请求超时。请检查网络连接并重试。",
      },
      [ErrorCategory.NETWORK_CONNECTION]: {
        en: "Network connection error. Please check your internet connection.",
        zh: "网络连接错误。请检查您的网络连接。",
      },
      [ErrorCategory.API_RATE_LIMIT]: {
        en: "Too many requests. Please wait and try again.",
        zh: "请求过于频繁。请稍后重试。",
      },
      [ErrorCategory.PAYMENT_DECLINED]: {
        en: "Payment was declined. Please try a different payment method.",
        zh: "支付被拒绝。请尝试其他支付方式。",
      },
      [ErrorCategory.PAYMENT_PROCESSING]: {
        en: "Payment processing error. Please try again.",
        zh: "支付处理错误。请重试。",
      },
      [ErrorCategory.PAYMENT_TIMEOUT]: {
        en: "Payment timed out. Please try again.",
        zh: "支付超时。请重试。",
      },
      [ErrorCategory.VALIDATION]: {
        en: "Invalid input. Please check your data and try again.",
        zh: "输入无效。请检查数据后重试。",
      },
      [ErrorCategory.BUSINESS_LOGIC]: {
        en: "Operation not allowed. Please contact support.",
        zh: "操作不被允许。请联系客服。",
      },
      [ErrorCategory.RESOURCE_NOT_FOUND]: {
        en: "Requested resource not found.",
        zh: "请求的资源未找到。",
      },
      [ErrorCategory.SYSTEM_ERROR]: {
        en: "System error occurred. Please try again later.",
        zh: "系统错误。请稍后重试。",
      },
      [ErrorCategory.CONFIGURATION_ERROR]: {
        en: "Service configuration error. Please contact support.",
        zh: "服务配置错误。请联系客服。",
      },
      [ErrorCategory.EXTERNAL_SERVICE]: {
        en: "External service unavailable. Please try again later.",
        zh: "外部服务不可用。请稍后重试。",
      },
      [ErrorCategory.UNKNOWN]: {
        en: "An unexpected error occurred. Please try again.",
        zh: "发生意外错误。请重试。",
      },
    };

    return (
      messages[this.category]?.[locale] ||
      messages[ErrorCategory.UNKNOWN][locale]
    );
  }
}

// 错误工厂函数
export class ErrorFactory {
  // 认证错误
  static authenticationError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "AUTH_001",
      message,
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      context,
      retryable: false,
    });
  }

  static authorizationError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "AUTH_002",
      message,
      category: ErrorCategory.AUTHORIZATION,
      severity: ErrorSeverity.HIGH,
      context,
      retryable: false,
    });
  }

  static sessionExpiredError(context?: Record<string, any>): EnhancedError {
    return new EnhancedError({
      code: "AUTH_003",
      message: "Session has expired",
      category: ErrorCategory.SESSION_EXPIRED,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: false,
      userMessage: "Your session has expired. Please log in again.",
    });
  }

  // 数据库错误
  static databaseConnectionError(
    message: string,
    cause?: Error,
  ): EnhancedError {
    return new EnhancedError({
      code: "DB_001",
      message: `Database connection failed: ${message}`,
      category: ErrorCategory.DATABASE_CONNECTION,
      severity: ErrorSeverity.HIGH,
      cause,
      retryable: true,
    });
  }

  static databaseQueryError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "DB_002",
      message: `Database query error: ${message}`,
      category: ErrorCategory.DATABASE_QUERY,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: true,
    });
  }

  static databaseTimeoutError(context?: Record<string, any>): EnhancedError {
    return new EnhancedError({
      code: "DB_003",
      message: "Database operation timed out",
      category: ErrorCategory.DATABASE_TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: true,
    });
  }

  // 网络错误
  static networkTimeoutError(context?: Record<string, any>): EnhancedError {
    return new EnhancedError({
      code: "NET_001",
      message: "Network request timed out",
      category: ErrorCategory.NETWORK_TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: true,
    });
  }

  static networkConnectionError(context?: Record<string, any>): EnhancedError {
    return new EnhancedError({
      code: "NET_002",
      message: "Network connection failed",
      category: ErrorCategory.NETWORK_CONNECTION,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: true,
    });
  }

  static apiRateLimitError(context?: Record<string, any>): EnhancedError {
    return new EnhancedError({
      code: "NET_003",
      message: "API rate limit exceeded",
      category: ErrorCategory.API_RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      context,
      retryable: true,
    });
  }

  // 支付错误
  static paymentDeclinedError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "PAY_001",
      message: `Payment declined: ${message}`,
      category: ErrorCategory.PAYMENT_DECLINED,
      severity: ErrorSeverity.HIGH,
      context,
      retryable: false,
    });
  }

  static paymentProcessingError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "PAY_002",
      message: `Payment processing error: ${message}`,
      category: ErrorCategory.PAYMENT_PROCESSING,
      severity: ErrorSeverity.HIGH,
      context,
      retryable: true,
    });
  }

  // 业务逻辑错误
  static validationError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "BIZ_001",
      message: `Validation error: ${message}`,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      context,
      retryable: false,
    });
  }

  static resourceNotFoundError(
    resource: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "BIZ_002",
      message: `Resource not found: ${resource}`,
      category: ErrorCategory.RESOURCE_NOT_FOUND,
      severity: ErrorSeverity.LOW,
      context,
      retryable: false,
    });
  }

  // 系统错误
  static systemError(message: string, cause?: Error): EnhancedError {
    return new EnhancedError({
      code: "SYS_001",
      message: `System error: ${message}`,
      category: ErrorCategory.SYSTEM_ERROR,
      severity: ErrorSeverity.CRITICAL,
      cause,
      retryable: true,
    });
  }

  static configurationError(
    message: string,
    context?: Record<string, any>,
  ): EnhancedError {
    return new EnhancedError({
      code: "SYS_002",
      message: `Configuration error: ${message}`,
      category: ErrorCategory.CONFIGURATION_ERROR,
      severity: ErrorSeverity.CRITICAL,
      context,
      retryable: false,
    });
  }

  // 通用错误
  static unknownError(message: string, cause?: Error): EnhancedError {
    return new EnhancedError({
      code: "UNK_001",
      message: `Unknown error: ${message}`,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      cause,
      retryable: true,
    });
  }

  // 从现有错误创建增强错误
  static fromError(
    error: Error,
    category?: ErrorCategory,
    context?: Record<string, any>,
  ): EnhancedError {
    if (error instanceof EnhancedError) {
      return error;
    }

    // 根据错误消息推断错误类别
    const inferredCategory =
      category || ErrorFactory.inferErrorCategory(error.message);

    return new EnhancedError({
      code: "WRAPPED_001",
      message: error.message,
      category: inferredCategory,
      severity: ErrorSeverity.MEDIUM,
      context,
      cause: error,
      retryable: ErrorFactory.isRetryableError(inferredCategory),
    });
  }

  private static inferErrorCategory(message: string): ErrorCategory {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("database") ||
      lowerMessage.includes("connection")
    ) {
      return ErrorCategory.DATABASE_CONNECTION;
    }
    if (lowerMessage.includes("timeout")) {
      return ErrorCategory.NETWORK_TIMEOUT;
    }
    if (lowerMessage.includes("network") || lowerMessage.includes("fetch")) {
      return ErrorCategory.NETWORK_CONNECTION;
    }
    if (
      lowerMessage.includes("unauthorized") ||
      lowerMessage.includes("forbidden")
    ) {
      return ErrorCategory.AUTHORIZATION;
    }
    if (lowerMessage.includes("payment") || lowerMessage.includes("stripe")) {
      return ErrorCategory.PAYMENT_PROCESSING;
    }
    if (
      lowerMessage.includes("validation") ||
      lowerMessage.includes("invalid")
    ) {
      return ErrorCategory.VALIDATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  private static isRetryableError(category: ErrorCategory): boolean {
    const retryableCategories = [
      ErrorCategory.DATABASE_CONNECTION,
      ErrorCategory.DATABASE_QUERY,
      ErrorCategory.DATABASE_TIMEOUT,
      ErrorCategory.NETWORK_TIMEOUT,
      ErrorCategory.NETWORK_CONNECTION,
      ErrorCategory.API_RATE_LIMIT,
      ErrorCategory.PAYMENT_PROCESSING,
      ErrorCategory.SYSTEM_ERROR,
      ErrorCategory.EXTERNAL_SERVICE,
    ];

    return retryableCategories.includes(category);
  }
}

// 错误处理器类
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCallbacks: Map<
    ErrorCategory,
    Array<(error: EnhancedError) => void>
  > = new Map();

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // 注册错误回调
  onError(
    category: ErrorCategory,
    callback: (error: EnhancedError) => void,
  ): void {
    if (!this.errorCallbacks.has(category)) {
      this.errorCallbacks.set(category, []);
    }
    this.errorCallbacks.get(category)?.push(callback);
  }

  // 处理错误
  handle(
    error: Error | EnhancedError,
    context?: Record<string, any>,
  ): EnhancedError {
    const enhancedError =
      error instanceof EnhancedError
        ? error
        : ErrorFactory.fromError(error, undefined, context);

    // 记录错误
    this.logError(enhancedError);

    // 触发回调
    const callbacks = this.errorCallbacks.get(enhancedError.category) || [];
    callbacks.forEach((callback) => {
      try {
        callback(enhancedError);
      } catch (callbackError) {
        console.error("Error in error callback:", callbackError);
      }
    });

    return enhancedError;
  }

  // 记录错误
  private logError(error: EnhancedError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.code}] ${error.message}`;

    const logData = {
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp,
      context: error.context,
      stack: error.stack,
    };

    switch (logLevel) {
      case "error":
        console.error(logMessage, logData);
        break;
      case "warn":
        console.warn(logMessage, logData);
        break;
      case "info":
        console.info(logMessage, logData);
        break;
      default:
        console.log(logMessage, logData);
    }
  }

  private getLogLevel(
    severity: ErrorSeverity,
  ): "error" | "warn" | "info" | "log" {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return "error";
      case ErrorSeverity.MEDIUM:
        return "warn";
      case ErrorSeverity.LOW:
        return "info";
      default:
        return "log";
    }
  }
}

// 重试机制
export class RetryHandler {
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      backoffMultiplier?: number;
      retryCondition?: (error: Error) => boolean;
    } = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 10000,
      backoffMultiplier = 2,
      retryCondition = (error) => {
        const enhancedError =
          error instanceof EnhancedError
            ? error
            : ErrorFactory.fromError(error);
        return enhancedError.retryable;
      },
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // 如果是最后一次尝试，或者错误不可重试，直接抛出
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw ErrorHandler.getInstance().handle(lastError);
        }

        // 计算延迟时间
        const delayMs = Math.min(
          baseDelayMs * backoffMultiplier ** attempt,
          maxDelayMs,
        );

        console.warn(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`,
          {
            error: lastError.message,
            attempt: attempt + 1,
          },
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw ErrorHandler.getInstance().handle(lastError!);
  }
}

// 错误边界工具
export class ErrorBoundaryUtils {
  // 检查是否为可恢复错误
  static isRecoverableError(error: EnhancedError): boolean {
    const recoverableCategories = [
      ErrorCategory.NETWORK_TIMEOUT,
      ErrorCategory.NETWORK_CONNECTION,
      ErrorCategory.API_RATE_LIMIT,
      ErrorCategory.DATABASE_TIMEOUT,
      ErrorCategory.EXTERNAL_SERVICE,
    ];

    return recoverableCategories.includes(error.category) && error.retryable;
  }

  // 获取错误恢复策略
  static getRecoveryStrategy(error: EnhancedError): {
    strategy: "retry" | "fallback" | "redirect" | "refresh";
    config?: any;
  } {
    switch (error.category) {
      case ErrorCategory.SESSION_EXPIRED:
        return {
          strategy: "redirect",
          config: { destination: "/auth" },
        };

      case ErrorCategory.NETWORK_CONNECTION:
      case ErrorCategory.NETWORK_TIMEOUT:
      case ErrorCategory.DATABASE_CONNECTION:
      case ErrorCategory.EXTERNAL_SERVICE:
        return {
          strategy: "retry",
          config: { maxRetries: 3, delayMs: 2000 },
        };

      case ErrorCategory.AUTHENTICATION:
        return {
          strategy: "refresh",
          config: { refreshToken: true },
        };

      default:
        return {
          strategy: "fallback",
        };
    }
  }
}

// 全局错误处理器实例
export const globalErrorHandler = ErrorHandler.getInstance();

// 便捷的错误处理函数
export const handleError = (
  error: Error | EnhancedError,
  context?: Record<string, any>,
): EnhancedError => {
  return globalErrorHandler.handle(error, context);
};

export const createError = (config: {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  cause?: Error;
  retryable?: boolean;
  userMessage?: string;
}): EnhancedError => {
  return new EnhancedError(config);
};
