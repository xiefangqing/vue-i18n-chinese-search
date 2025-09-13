# vue-i18n-chinese-search

插件：vue-i18n 中文搜索定位

解决问题：当文件中都是用 `$t('key')` 引用词条时，想通过中文搜索定位就变得很麻烦，需要先在中文 json 中找到对应 key，然后再搜索 key

主要功能：在文件中搜索中文内容，定位到对应的 `$t('key')` 引用位置

> 如果词条在当前文件中只有一次引用，则会直接跳转；如果有多次引用，会再弹出一个匹配列表，通过上下键切换选择。

(New) 支持词条 @:key 链接解析，比如词条是：
"OrderNew": {
"0": "@:Global.25",
}，那么在解析 OrderNew.0 时，就会直接获取 Global.25 对应的中文。

使用流程：

1. 安装完插件后，运行 `vue-i18n-chinese-search.searchInCurrentFile`
2. 配置中文 json 路径，使用相对路径或绝对路径都可以

> 如果配置异常失败，请删除 `.vscode/settings.json` 中的 `vue-i18n-chinese-search.i18nFilePath` 配置，然后重新启动 vscode 激活插件。

命令和默认快捷键配置：

```json
"keybindings": [
  {
    "command": "vue-i18n-chinese-search.searchInCurrentFile",
    "key": "ctrl+shift+i",
    "mac": "cmd+shift+i",
    "when": "editorTextFocus"
  }
],
```

## 另外

如有使用问题，可以用邮箱联系我，389368595@qq.com。
