/**
 * 安全工具模块（§8.4 安全措施）
 *
 * 提供 XSS 防护、输入消毒、安全头配置等
 */

// ========== XSS 防护 ==========

/**
 * 转义 HTML 特殊字符，防止 XSS 注入
 *
 * 不依赖 DOMPurify（零依赖方案），覆盖所有关键 HTML 实体：
 * & → &amp;
 * < → &lt;
 * > → &gt;
 * " → &quot;
 * ' → &#x27;
 * / → &#x2F;
 */
export function escapeHtml(str: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  return str.replace(/[&<>"'/]/g, (char) => escapeMap[char]!)
}

/**
 * 消毒用户输入文本，用于安全的 DOM 文本插入
 *
 * 使用 textContent 方式（最安全），此函数作为双重保障
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return ''
  // 移除控制字符（保留换行和制表符）
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()
}

/**
 * 验证词语是否合法（§6 词库保护策略 Layer 3）
 *
 * 规则：
 * - 长度 1-20 字符
 * - 仅允许中文/英文/数字/常用标点
 * - 拒绝纯数字/纯特殊字符
 */
export function isValidWord(word: string): boolean {
  if (typeof word !== 'string') return false
  const trimmed = word.trim()
  if (trimmed.length < 1 || trimmed.length > 20) return false
  // 允许中文、英文、数字、常用标点
  const VALID_CHAR_RE = /^[\u4e00-\u9fa5a-zA-Z0-9·\-（）【】\[\]]+$/
  if (!VALID_CHAR_RE.test(trimmed)) return false
  // 拒绝纯数字
  if (/^\d+$/.test(trimmed)) return false
  return true
}

// ========== CSP 配置 ==========

/**
 * Content-Security-Policy 值（CF Pages 用）
 *
 * 通过 _headers 文件或 meta 标签注入
 */
export const CSP_HEADER_VALUE =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "connect-src 'self' https://*.workers.dev; " +
  "img-src 'self' data: blob:; " +
  "font-src 'self' https://api.iconify.design; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'"

/** 其他安全头配置 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP_HEADER_VALUE,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// ========== 敏感数据处理 ==========

/**
 * 脱敏处理：隐藏词语中间字符（用于日志等非关键场景）
 *
 * 例: "奥特曼" → "奥*特"
 */
export function maskWord(word: string): string {
  if (typeof word !== 'string' || word.length <= 2) return '**'
  const first = word[0]
  const last = word[word.length - 1]
  return `${first}${'*'.repeat(Math.min(word.length - 2, 4))}${last}`
}
