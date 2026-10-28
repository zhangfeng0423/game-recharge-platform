/**
 * React 错误边界组件
 * 提供全局错误捕获、用户友好的错误显示和错误报告机制
 */

"use client";

import React, { Component, type ReactNode, Suspense } from "react";
import {
  EnhancedError,
  ErrorCategory,
  ErrorSeverity,
  handleError,
} from "@/lib/error-handling";
import { Button } from "./Button";
import { Card } from "./Card";

// 错误边界状态接口
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | EnhancedError | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRetrying: boolean;
}

// 错误边界属性接口
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error | EnhancedError, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  showErrorDetails?: boolean;
  enableRetry?: boolean;
  locale?: "en" | "zh";
}

// 默认错误回退组件
const DefaultErrorFallback: React.FC<{
  error: Error | EnhancedError | null;
  retry: () => void;
  reset: () => void;
  retryCount: number;
  maxRetries: number;
  isRetrying: boolean;
  locale: "en" | "zh";
}> = ({ error, retry, reset, retryCount, maxRetries, isRetrying, locale }) => {
  const isEnhancedError = error instanceof EnhancedError;
  const canRetry = retryCount < maxRetries && !isRetrying;

  // 错误消息翻译
  const messages = {
    en: {
      title: "Something went wrong",
      subtitle: "An unexpected error occurred",
      description:
        "We apologize for the inconvenience. The error has been logged and our team will look into it.",
      retryButton: isRetrying ? "Retrying..." : "Try Again",
      resetButton: "Go to Homepage",
      errorDetails: "Error Details",
      errorCode: "Error Code",
      errorCategory: "Category",
      errorSeverity: "Severity",
      timestamp: "Timestamp",
      retryCount: "Retry Attempts",
      reportError: "Report Error",
      contactSupport: "Contact Support",
    },
    zh: {
      title: "出现了问题",
      subtitle: "发生了意外错误",
      description:
        "我们对此造成的不便深表歉意。错误已被记录，我们的团队将进行调查。",
      retryButton: isRetrying ? "重试中..." : "重试",
      resetButton: "返回首页",
      errorDetails: "错误详情",
      errorCode: "错误代码",
      errorCategory: "类别",
      errorSeverity: "严重程度",
      timestamp: "时间戳",
      retryCount: "重试次数",
      reportError: "报告错误",
      contactSupport: "联系客服",
    },
  };

  const t = messages[locale];

  // 获取严重程度的颜色
  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return "text-[#359EFF] bg-[#359EFF]/10 border-[#359EFF]/30";
      case ErrorSeverity.HIGH:
        return "text-[#359EFF] bg-[#359EFF]/10 border-[#359EFF]/30";
      case ErrorSeverity.MEDIUM:
        return "text-[#359EFF] bg-[#359EFF]/10 border-[#359EFF]/30";
      case ErrorSeverity.LOW:
        return "text-[#359EFF] bg-[#359EFF]/10 border-[#359EFF]/30";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // 获取类别的显示名称
  const getCategoryDisplay = (category: ErrorCategory) => {
    const categoryNames = {
      [ErrorCategory.AUTHENTICATION]:
        locale === "en" ? "Authentication" : "身份验证",
      [ErrorCategory.AUTHORIZATION]: locale === "en" ? "Authorization" : "授权",
      [ErrorCategory.SESSION_EXPIRED]:
        locale === "en" ? "Session Expired" : "会话过期",
      [ErrorCategory.DATABASE_CONNECTION]:
        locale === "en" ? "Database Connection" : "数据库连接",
      [ErrorCategory.DATABASE_QUERY]:
        locale === "en" ? "Database Query" : "数据库查询",
      [ErrorCategory.DATABASE_CONSTRAINT]:
        locale === "en" ? "Database Constraint" : "数据库约束",
      [ErrorCategory.DATABASE_TIMEOUT]:
        locale === "en" ? "Database Timeout" : "数据库超时",
      [ErrorCategory.NETWORK_TIMEOUT]:
        locale === "en" ? "Network Timeout" : "网络超时",
      [ErrorCategory.NETWORK_CONNECTION]:
        locale === "en" ? "Network Connection" : "网络连接",
      [ErrorCategory.API_RATE_LIMIT]:
        locale === "en" ? "Rate Limit" : "请求限制",
      [ErrorCategory.PAYMENT_DECLINED]:
        locale === "en" ? "Payment Declined" : "支付被拒绝",
      [ErrorCategory.PAYMENT_PROCESSING]:
        locale === "en" ? "Payment Processing" : "支付处理",
      [ErrorCategory.PAYMENT_TIMEOUT]:
        locale === "en" ? "Payment Timeout" : "支付超时",
      [ErrorCategory.VALIDATION]: locale === "en" ? "Validation" : "验证",
      [ErrorCategory.BUSINESS_LOGIC]:
        locale === "en" ? "Business Logic" : "业务逻辑",
      [ErrorCategory.RESOURCE_NOT_FOUND]:
        locale === "en" ? "Resource Not Found" : "资源未找到",
      [ErrorCategory.SYSTEM_ERROR]:
        locale === "en" ? "System Error" : "系统错误",
      [ErrorCategory.CONFIGURATION_ERROR]:
        locale === "en" ? "Configuration Error" : "配置错误",
      [ErrorCategory.EXTERNAL_SERVICE]:
        locale === "en" ? "External Service" : "外部服务",
      [ErrorCategory.UNKNOWN]: locale === "en" ? "Unknown" : "未知",
    };
    return categoryNames[category] || categoryNames[ErrorCategory.UNKNOWN];
  };

  // 获取严重程度的显示名称
  const getSeverityDisplay = (severity: ErrorSeverity) => {
    const severityNames = {
      [ErrorSeverity.CRITICAL]: locale === "en" ? "Critical" : "严重",
      [ErrorSeverity.HIGH]: locale === "en" ? "High" : "高",
      [ErrorSeverity.MEDIUM]: locale === "en" ? "Medium" : "中",
      [ErrorSeverity.LOW]: locale === "en" ? "Low" : "低",
    };
    return severityNames[severity];
  };

  // 复制错误信息到剪贴板
  const copyErrorDetails = async () => {
    if (!error) return;

    const errorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    if (isEnhancedError) {
      Object.assign(errorDetails, {
        code: error.code,
        category: error.category,
        severity: error.severity,
        context: error.context,
      });
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(errorDetails, null, 2),
      );
      // 这里可以显示一个成功提示
    } catch (err) {
      console.error("Failed to copy error details:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-2xl">
        <div className="p-6 text-center">
          {/* 错误图标 */}
          <div className="w-16 h-16 mx-auto mb-4 bg-[#359EFF]/20 rounded-full flex items-center justify-center">
            <svg
              aria-hidden="true"
              className="w-8 h-8 text-[#359EFF]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* 错误标题 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.title}</h1>
          <p className="text-gray-600 mb-6">{t.subtitle}</p>

          {/* 错误描述 */}
          <p className="text-gray-500 mb-8 text-sm">{t.description}</p>

          {/* 增强错误信息显示 */}
          {isEnhancedError && (
            <div className="mb-6 text-left">
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(error.severity)}`}
              >
                {getSeverityDisplay(error.severity)}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">
                    {t.errorCode}:
                  </span>
                  <span className="text-gray-600">{error.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">
                    {t.errorCategory}:
                  </span>
                  <span className="text-gray-600">
                    {getCategoryDisplay(error.category)}
                  </span>
                </div>
                {error.userMessage && (
                  <div className="mt-2 p-3 bg-[#359EFF]/10 border border-[#359EFF]/30 rounded-md">
                    <p className="text-[#359EFF] text-sm">
                      {error.userMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {canRetry && (
              <Button
                onClick={retry}
                disabled={isRetrying}
                className="w-full sm:w-auto"
              >
                {t.retryButton}
              </Button>
            )}

            <Button
              onClick={reset}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {t.resetButton}
            </Button>

            <Button
              onClick={copyErrorDetails}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {t.reportError}
            </Button>
          </div>

          {/* 重试计数 */}
          {retryCount > 0 && (
            <p className="mt-4 text-sm text-gray-500">
              {t.retryCount}: {retryCount}/{maxRetries}
            </p>
          )}

          {/* 错误详情（可折叠） */}
          {error && (
            <details className="mt-8 text-left">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                {t.errorDetails}
              </summary>
              <div className="mt-2 p-4 bg-gray-100 rounded-md text-xs font-mono overflow-x-auto">
                <div className="mb-2">
                  <strong>{t.errorCode}:</strong>{" "}
                  {isEnhancedError ? error.code : "N/A"}
                </div>
                <div className="mb-2">
                  <strong>Message:</strong> {error.message}
                </div>
                {error.stack && (
                  <div className="mt-2">
                    <strong>Stack Trace:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {isEnhancedError && error.context && (
                  <div className="mt-2">
                    <strong>Context:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {JSON.stringify(error.context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </Card>
    </div>
  );
};

// 主错误边界组件
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // 使用我们的错误处理框架处理错误
    const enhancedError = handleError(error, {
      component: "ErrorBoundary",
      errorInfo: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        timestamp: new Date().toISOString(),
      },
    });

    this.setState({
      error: enhancedError,
      errorInfo,
    });

    // 调用自定义错误处理函数
    if (this.props.onError) {
      this.props.onError(enhancedError, errorInfo);
    }

    // 在生产环境中，可以将错误发送到错误监控服务
    if (process.env.NODE_ENV === "production") {
      this.reportError(enhancedError, errorInfo);
    }
  }

  componentWillUnmount() {
    // 清理重试超时
    this.retryTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
  }

  // 重试函数
  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // 延迟重试，给组件一些时间来恢复
    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
    }, 1000);

    this.retryTimeouts.push(timeout);
  };

  // 重置函数
  handleReset = () => {
    // 清理所有重试超时
    this.retryTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.retryTimeouts = [];

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  // 报告错误到监控服务
  private reportError = (error: EnhancedError, errorInfo: React.ErrorInfo) => {
    try {
      // 这里可以集成错误监控服务，如 Sentry, LogRocket 等
      const errorReport = {
        ...error.toJSON(),
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };

      // 示例：发送到错误监控服务
      // fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // }).catch(err => {
      //   console.error('Failed to report error:', err);
      // });

      console.log("Error report:", errorReport);
    } catch (err) {
      console.error("Failed to report error:", err);
    }
  };

  render() {
    const { hasError, error, retryCount, isRetrying } = this.state;
    const {
      children,
      fallback,
      maxRetries = 3,
      showErrorDetails = false,
      enableRetry = true,
      locale = "en",
    } = this.props;

    if (hasError) {
      // 如果提供了自定义的 fallback，使用它
      if (fallback) {
        return fallback;
      }

      // 使用默认的错误回退组件
      return (
        <Suspense fallback={<div>Loading...</div>}>
          <DefaultErrorFallback
            error={error}
            retry={enableRetry ? this.handleRetry : () => {}}
            reset={this.handleReset}
            retryCount={retryCount}
            maxRetries={maxRetries}
            isRetrying={isRetrying}
            locale={locale}
          />
        </Suspense>
      );
    }

    return children;
  }
}

// 高阶组件：为组件包装错误边界
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Hook：用于在函数组件中处理错误
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | EnhancedError | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error | EnhancedError) => {
    const enhancedError = handleError(error, {
      hook: "useErrorHandler",
      timestamp: new Date().toISOString(),
    });

    setError(enhancedError);
  }, []);

  React.useEffect(() => {
    if (error) {
      // 在生产环境中报告错误
      if (process.env.NODE_ENV === "production") {
        console.error("Error captured by useErrorHandler:", error);
      }
    }
  }, [error]);

  return { error, captureError, resetError };
};

export default ErrorBoundary;
