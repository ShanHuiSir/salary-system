import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 可选的 fallback UI */
  fallback?: ReactNode;
  /** 是否在恢复时强制刷新页面（默认 false，只重渲染子组件） */
  hardReset?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] 捕获渲染错误:', error);
    console.error('[ErrorBoundary] 组件堆栈:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleRetry = (): void => {
    if (this.props.hardReset) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  handleResetData = (): void => {
    // 清除可能损坏的 localStorage 数据并刷新
    try {
      // 保留数据操作记录，清除可能损坏的数据
      const backupKey = 'salary-admin-data-backup';
      const currentData = localStorage.getItem('salary-admin-data');
      if (currentData) {
        localStorage.setItem(backupKey, currentData);
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message ?? '未知错误';
      const stack = this.state.error?.stack ?? '';
      const componentStack = this.state.errorInfo?.componentStack ?? '';

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <Card className="w-full max-w-lg shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <CardTitle className="text-xl">页面渲染异常</CardTitle>
              <CardDescription>
                页面组件遇到了意外错误，已自动捕获。数据不会丢失，您可以通过以下方式恢复。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 错误信息直接展示 */}
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                <p className="font-semibold">错误信息：</p>
                <p className="mt-1 font-mono break-all">{errorMessage}</p>
              </div>

              <details className="rounded-md bg-muted/50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  堆栈详情（点击展开）
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs text-muted-foreground">
                  {stack && <div className="mb-2 text-destructive">{stack}</div>}
                  {componentStack && <div className="text-amber-600">{componentStack}</div>}
                </pre>
              </details>

              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-medium">数据安全说明</p>
                <p className="mt-1 text-xs">
                  业务数据存储在服务器数据库中。点击"尝试恢复"通常可重新渲染页面；
                  如反复出现，请截图上方的错误信息并提供给开发。
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="default"
                className="w-full sm:w-auto"
                onClick={this.handleRetry}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                尝试恢复
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={this.handleResetData}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重置并刷新
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
