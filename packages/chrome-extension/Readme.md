

# google-search-for-agent

接收 Agent 的搜索请求，控制浏览器执行 Chrome 搜索，并将搜索结果通过 bridge-server 返回给 Agent。



# 架构

项目有两个入口点。

一个是 `manifest.json` 中的 `options_page`：

- 入口源文件在 `src/index.html`

- 使用 vite + vue + jsx + ant-design-vue 技术栈

- 在 `manifest.json` 中的 `options_page` 中配置该入口点

- 入口输出文件为 `dist/index.html`

- 该入口在 Chrome 扩展中的本意是作为扩展的配置页面，但是我的扩展需要一个能够持久运行的调试器（负责接收搜索请求、创建新页面进行搜索、将结果送回给请求方），而名义上能够统筹全局的 `service worker` 却存在休眠机制且没有界面，因此配置页面就成了最好的选择

另外一个入口是 `src/content_scripts/baidu.ts`：

- 开发此扩展程序的本意是调用谷歌搜索，但在中国访问 Google 并不是一件简单的事情，所以我就先适配了百度搜索。

- 




