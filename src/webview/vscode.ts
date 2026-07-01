interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// acquireVsCodeApi() must be called exactly once. Falls back to a console
// mock when running outside the VS Code webview (e.g. Vite dev server).
export const vscode: VsCodeApi =
  typeof acquireVsCodeApi !== 'undefined'
    ? acquireVsCodeApi()
    : {
        postMessage: (msg) => console.log('[vscode.mock]', msg),
        getState: () => null,
        setState: () => {},
      };
