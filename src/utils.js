const fs = require('fs').promises;
const path = require('path');
const vscode = require('vscode');

/**
 * 递归扁平化 i18n 嵌套对象
 * 如 { a: { b: '文本' } } ⇒ { 'a.b': '文本' }
 */
function flattenI18n(obj, prefix = '', result = {}) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      result[newKey] = val;
    } else if (typeof val === 'object' && val !== null) {
      flattenI18n(val, newKey, result);
    }
  }
  return result;
}

/**
 * 从配置中读取 i18n JSON 并扁平化
 */
async function loadI18nEntries(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(text);
    return flattenI18n(json);
  } catch (error) {
    vscode.window.showErrorMessage(`加载i18n文件失败: ${error.message}`);
    console.error('加载i18n文件失败:', error);
    return {};
  }
}

async function ensureI18nPathAndLoad() {
  try {
    // 获取插件配置
    const config = vscode.workspace.getConfiguration('vue-i18n-chinese-search');
    let savedPath = config.get('i18nFilePath');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('请先打开一个工作区。');
      return { entries: {}, path: '' };
    }

    const rootPath = workspaceFolder.uri.fsPath;
    let absPath;

    // 处理已保存的路径
    if (savedPath) {
      absPath = path.isAbsolute(savedPath) ? savedPath : path.join(rootPath, savedPath);
    }

    // 如果路径为空或文件不存在，提示用户输入路径（支持绝对路径）
    while (!absPath || !(await fileExists(absPath))) {
      const input = await vscode.window.showInputBox({
        prompt: '请输入 i18n 中文 JSON 路径（可输入绝对路径或相对于工作区的相对路径）',
        value: savedPath || './src/i18n/zh-CN.json',
        ignoreFocusOut: true,
      });

      if (!input) {
        vscode.window.showWarningMessage('未设置有效的路径，插件功能将无法使用。');
        return { entries: {}, path: '' };
      }

      // 检查是否为绝对路径
      absPath = path.isAbsolute(input) ? input : path.join(rootPath, input);
      savedPath = input;

      if (!(await fileExists(absPath))) {
        vscode.window.showWarningMessage(`路径无效或文件不存在: ${absPath}\n请重新输入，可使用绝对路径`);
      }
    }

    try {
      // 保存用户输入的原始路径（可能是绝对路径或相对路径）
      await config.update('i18nFilePath', savedPath, vscode.ConfigurationTarget.Workspace);
    } catch (error) {
      vscode.window.showErrorMessage(`保存配置失败: ${error.message}`);
      console.error('保存配置失败:', error);
    }

    // 读取并扁平化
    const entries = await loadI18nEntries(absPath);
    return { entries, path: absPath };
  } catch (error) {
    vscode.window.showErrorMessage(`处理i18n路径失败: ${error.message}`);
    console.error('处理i18n路径失败:', error);
    return { entries: {}, path: '' };
  }
}

// 检查文件是否存在
async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

module.exports = { flattenI18n, loadI18nEntries, ensureI18nPathAndLoad };
