
# my-agent-tool-google-search

这是一个为 VSCode Chat 提供网页搜索能力的仓库，提供类似于 Web search for Copilot 的能力。它分为三个包：

- `packages/bridge-server` - 一个在 vscode 扩展和 chrome 扩展之间建立通信的中转 bridge-server

- `packages/chrome-extension` - 控制浏览器执行 Google 搜索，并将结果通过 bridge-server 返回给 vscode chat

- `packages/vscode-extension` - 与 vscode chat 代码交互的扩展程序，负责将搜索任务通过 bridge-server 下发给 chrome-extension，并通过 bridge-server 将搜索结果返回给 vscode chat。











