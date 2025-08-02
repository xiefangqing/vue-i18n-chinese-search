const vscode = require('vscode');
const { ensureI18nPathAndLoad } = require('./utils');
const path = require('path');

let globalEntries = {};
let i18nFilePath = '';

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
  try {
    // 等待词条加载完成再注册命令
    const result = await ensureI18nPathAndLoad();
    globalEntries = result.entries;
    i18nFilePath = result.path;

    if (Object.keys(globalEntries).length) {
      vscode.window.showInformationMessage(`已加载 ${Object.keys(globalEntries).length} 个词条。`);
    }

    // 在当前文件内搜索词条并跳转到使用位置
    const disposable1 = vscode.commands.registerCommand('vue-i18n-chinese-search.searchInCurrentFile', async () => {
      await performSearch(false);
    });

    context.subscriptions.push(disposable1);
  } catch (error) {
    vscode.window.showErrorMessage(`插件激活失败: ${error.message}`);
    console.error('插件激活失败:', error);
  }
}

async function performSearch() {
  if (Object.keys(globalEntries).length === 0) {
    vscode.window.showWarningMessage('i18n 词条尚未加载，请重启 VSCode 激活插件。');
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个文件');
    return;
  }

  const text = editor.document.getText();
  // 简单字符串匹配，可能的误匹配：如果某个词作为另一个词的一部分出现（例如 "name" 出现在 "username" 中）
  // const usedKeys = Object.keys(globalEntries).filter((k) => text.includes(k));
  // 更精确的匹配模式，匹配 $t('key') 或 $t("key") 形式
  const usedKeys = Object.keys(globalEntries).filter((k) => {
    const regex = new RegExp(`\\$t\\(['"]${escapeRegExp(k)}['"]\\)`, 'g');
    return regex.test(text);
  });

  // 词条按实际代码位置的先后排序
  usedKeys.sort((a, b) => {
    // 分别获取两个key的首次出现位置
    const regexA = new RegExp(`\\$t\\(['"]${escapeRegExp(a)}['"]\\)`);
    const regexB = new RegExp(`\\$t\\(['"]${escapeRegExp(b)}['"]\\)`);
    const matchA = text.match(regexA);
    const matchB = text.match(regexB);

    // 按首次出现的索引位置排序
    return (matchA?.index || Infinity) - (matchB?.index || Infinity);
  });

  if (usedKeys.length === 0) {
    vscode.window.showInformationMessage('当前文件中未使用任何 i18n 词条');
    return;
  }

  const items = usedKeys.map((key) => ({
    label: globalEntries[key],
    description: key,
  }));

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: `输入中文过滤当前文件词条，回车跳转到使用位置（共 ${usedKeys.length} 个词条）`,
    matchOnDescription: true, // 允许通过键名搜索
  });

  if (!pick) return;

  await jumpToCurrentFile(pick.description);
}

async function jumpToCurrentFile(key) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const text = document.getText();
  // 构建全局匹配正则（匹配被单/双引号包裹的key，添加g标志全局搜索）
  const regex = new RegExp(`'${escapeRegExp(key)}'|"${escapeRegExp(key)}"`, 'g');

  // 收集所有匹配的位置及上下文
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const index = match.index;
    const pos = document.positionAt(index);
    const lineNumber = pos.line;
    const lineText = document.lineAt(lineNumber).text;

    matches.push({
      index,
      pos,
      lineNumber,
      lineText,
    });
  }

  if (matches.length === 0) {
    vscode.window.showInformationMessage(`未在当前文件中找到词条: ${key}`);
    return;
  }

  // 单个匹配直接跳转
  if (matches.length === 1) {
    const { pos } = matches[0];
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    return;
  }

  // 多个匹配时，创建带实时跳转的选择列表
  const items = matches.map((item, i) => {
    // 处理超长文本：trim后如果超过80字符则截断并添加省略号
    const trimLineText = item.lineText.trim();
    const lineText = trimLineText.length > 80 ? `${trimLineText.slice(0, 80)}...` : trimLineText;
    return {
      label: `行 ${item.lineNumber + 1}`,
      description: lineText,
      index: item.index,
      lineNumber: item.lineNumber,
    };
  });

  // 实时跳转的处理函数
  const onSelect = (item) => {
    if (!item) return;
    const pos = document.positionAt(item.index);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  };

  // 显示选择列表并监听选择变化
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: `找到 ${matches.length} 个匹配，上下键切换位置`,
    matchOnDescription: true,
    onDidSelectItem: onSelect, // 关键：选中项变化时触发跳转
  });

  if (pick) {
    const pos = document.positionAt(pick.index);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }
}

/**
 * 对 key 进行转义，防止 key 中包含正则特殊字符（如 *、?）导致匹配错误
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
