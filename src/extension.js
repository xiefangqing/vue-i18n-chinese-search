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
    // 显示加载状态
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '正在加载i18n词条...';
    statusBarItem.show();

    // 等待词条加载完成再注册命令
    const result = await ensureI18nPathAndLoad();
    globalEntries = result.entries;
    i18nFilePath = result.path;

    statusBarItem.hide();

    if (Object.keys(globalEntries).length === 0) {
      vscode.window.showWarningMessage('未加载到任何i18n词条，请检查配置的文件是否正确。');
    } else {
      vscode.window.showInformationMessage(`已加载 ${Object.keys(globalEntries).length} 个i18n词条`);
    }

    // 当前文件内搜索
    const disposable1 = vscode.commands.registerCommand('vue-i18n-chinese-search.searchInCurrentFile', async () => {
      await performSearch(false);
    });

    context.subscriptions.push(disposable1, statusBarItem);
  } catch (error) {
    vscode.window.showErrorMessage(`插件激活失败: ${error.message}`);
    console.error('插件激活失败:', error);
  }
}

async function performSearch() {
  if (Object.keys(globalEntries).length === 0) {
    vscode.window.showWarningMessage('i18n 词条尚未加载，请稍候再试。');
    return;
  }

  // 当前文件搜索只使用文件中出现的词条
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('请先打开一个文件');
    return;
  }

  const text = editor.document.getText();
  const usedKeys = Object.keys(globalEntries).filter((k) => text.includes(k));

  if (usedKeys.length === 0) {
    vscode.window.showInformationMessage('当前文件中未使用任何i18n词条');
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

  // 当前文件搜索跳转到当前文件中的位置
  await jumpToCurrentFile(pick.description);
}

async function jumpToCurrentFile(key) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const text = editor.document.getText();
  const regex = new RegExp(`'${escapeRegExp(key)}'|"${escapeRegExp(key)}"`);
  const match = text.match(regex);

  if (match && match.index >= 0) {
    const pos = editor.document.positionAt(match.index);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  } else {
    vscode.window.showInformationMessage(`未在当前文件中找到键名: ${key}`);
  }
}

// 辅助函数：转义正则表达式特殊字符
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
