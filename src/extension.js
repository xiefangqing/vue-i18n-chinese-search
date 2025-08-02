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
  const usedKeys = Object.keys(globalEntries).filter((k) => text.includes(k));

  if (usedKeys.length === 0) {
    vscode.window.showInformationMessage('当前文件中未使用任何 i18n 词条');
    return;
  }

  const items = usedKeys.map((key) => ({
    label: globalEntries[key],
    description: key,
  }));

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: '输入中文过滤当前文件词条',
    matchOnDescription: true, // 允许通过键名搜索
  });

  if (!pick) return;

  await jumpToCurrentFile(pick.description);
}

async function jumpToCurrentFile(key) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const text = editor.document.getText();
  // 匹配被单引号（'key'）或双引号（"key"）包裹的 key
  const regex = new RegExp(`'${escapeRegExp(key)}'|"${escapeRegExp(key)}"`);
  const match = text.match(regex);

  if (match && match.index >= 0) {
    const pos = editor.document.positionAt(match.index);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  } else {
    vscode.window.showInformationMessage(`未在当前文件中找到词条: ${key}`);
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
