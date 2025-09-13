const fs = require('fs').promises;
const path = require('path');
const vscode = require('vscode');

/**
 * 递归扁平化 i18n 嵌套对象，支持引用解析
 * 如 { a: { b: '文本' } } ⇒ { 'a.b': '文本' }
 * 支持 Vue I18n 引用格式如 "@:Global.25"
 */
function flattenI18n(obj, prefix = '', result = {}) {
  // 先收集所有键值对，但不处理引用（确保所有基础值都先被收集）
  const tempResult = {};
  
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof val === 'string') {
      tempResult[newKey] = val;
    } else if (typeof val === 'object' && val !== null) {
      flattenI18n(val, newKey, tempResult);
    }
  }
  
  // 第二次遍历处理引用解析
  for (const [key, value] of Object.entries(tempResult)) {
    if (typeof value === 'string' && value.startsWith('@:')) {
      const refKey = value.substring(2); // 去掉"@:"前缀
      // 在整个扁平化结果中查找引用目标
      const refValue = tempResult[refKey];
      if (refValue !== undefined && typeof refValue === 'string' && !refValue.startsWith('@:')) {
        result[key] = refValue;
      } else {
        // 无效引用，保持原样
        result[key] = value;
      }
    } else {
      // 普通字符串值或非引用值
      result[key] = value;
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
    // 抛出具体错误，让调用方决定如何处理
    throw new Error(`加载i18n文件失败: ${error.message}`);
  }
}

async function ensureI18nPathAndLoad() {
  // 获取插件配置
  const config = vscode.workspace.getConfiguration('vue-i18n-chinese-search');
  let savedPath = config.get('i18nFilePath');

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage('请先打开一个文件夹。');
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
      prompt: '请输入 i18n 的中文 JSON 路径（可输入绝对路径或相对路径）',
      value: savedPath || '',
      ignoreFocusOut: true,
    });

    if (!input) {
      vscode.window.showErrorMessage('未设置有效的路径，无法使用插件。');
      return { entries: {}, path: '' };
    }

    // 检查是否为绝对路径
    absPath = path.isAbsolute(input) ? input : path.join(rootPath, input);
    savedPath = input;

    if (!(await fileExists(absPath))) {
      vscode.window.showErrorMessage(`路径无效或文件不存在: ${absPath}`);
    }
  }

  try {
    // 保存用户输入的原始路径（可能是绝对路径或相对路径）
    await config.update('i18nFilePath', savedPath, vscode.ConfigurationTarget.Workspace);
  } catch (error) {
    vscode.window.showErrorMessage(`保存配置失败: ${error.message}`);
    console.error('保存配置失败:', error);
  }

  try {
    // 读取并扁平化
    const entries = await loadI18nEntries(absPath);
    return { entries, path: absPath };
  } catch (error) {
    vscode.window.showErrorMessage(error.message);
    console.error(error.message);
    return { entries: {}, path: absPath };
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

module.exports = { flattenI18n, loadI18nEntries, ensureI18nPathAndLoad, fileExists };
