import type { WordPair } from '../types/game'

/**
 * 内置词库（30+ 组经典词对，MVP 够用）
 * 后续扩展到 300+ 词对
 */
export const builtinWords: WordPair[] = [
  // === 简单 Easy (12组) ===
  { id: 'w001', wordA: '苹果', wordB: '梨子', category: '水果', difficulty: 'easy' },
  { id: 'w002', wordA: '红烧肉', wordB: '糖醋排骨', category: '食物', difficulty: 'easy' },
  { id: 'w003', wordA: '小狗', wordB: '小猫', category: '动物', difficulty: 'easy' },
  { id: 'w004', wordA: '手机', wordB: '平板', category: '数码', difficulty: 'easy' },
  { id: 'w005', wordA: '篮球', wordB: '足球', category: '运动', difficulty: 'easy' },
  { id: 'w006', wordA: '奶茶', wordB: '咖啡', category: '饮品', difficulty: 'easy' },
  { id: 'w007', wordA: '饺子', wordB: '包子', category: '食物', difficulty: 'easy' },
  { id: 'w008', wordA: '夏天', wordB: '冬天', category: '季节', difficulty: 'easy' },
  { id: 'w009', wordA: '近视镜', wordB: '墨镜', category: '配饰', difficulty: 'easy' },
  { id: 'w010', wordA: '电梯', wordB: '楼梯', category: '建筑', difficulty: 'easy' },
  { id: 'w011', wordA: '洗发水', wordB: '沐浴露', category: '日用品', difficulty: 'easy' },
  { id: 'w012', wordA: '回形针', wordB: '订书机', category: '文具', difficulty: 'easy' },

  // === 中等 Medium (12组) ===
  { id: 'w013', wordA: '孙悟空', wordB: '哪吒', category: '神话', difficulty: 'medium' },
  { id: 'w014', wordA: '刘备', wordB: '曹操', category: '三国', difficulty: 'medium' },
  { id: 'w015', wordA: '雪花', wordB: '冰雹', category: '自然', difficulty: 'medium' },
  { id: 'w016', wordA: '奥特曼', wordB: '假面骑士', category: '特摄', difficulty: 'medium' },
  { id: 'w017', wordA: '心跳', wordB: '脉搏', category: '医学', difficulty: 'medium' },
  { id: 'w018', wordA: '初恋', wordB: '暗恋', category: '情感', difficulty: 'medium' },
  { id: 'w019', wordA: '保安', wordB: '保姆', category: '职业', difficulty: 'medium' },
  { id: 'w020', wordA: '麻将', wordB: '扑克', category: '游戏', difficulty: 'medium' },
  { id: 'w021', wordA: '高考', wordB: '考研', category: '考试', difficulty: 'medium' },
  { id: 'w022', wordA: '眉毛', wordB: '睫毛', category: '身体', difficulty: 'medium' },
  { id: 'w023', wordA: '牛肉面', wordB: '兰州拉面', category: '食物', difficulty: 'medium' },
  { id: 'w024', wordA: '无线路由器', wordB: '猫（调制解调器）', category: '网络设备', difficulty: 'medium' },

  // === 困难 Hard (10组) ===
  { id: 'w025', wordA: '量子计算', wordB: '区块链', category: '科技', difficulty: 'hard' },
  { id: 'w026', wordA: '存在主义', wordB: '虚无主义', category: '哲学', difficulty: 'hard' },
  { id: 'w027', wordA: '莫扎特', wordB: '贝多芬', category: '音乐', difficulty: 'hard' },
  { id: 'w028', wordA: '释迦牟尼', wordB: '耶稣', category: '宗教', difficulty: 'hard' },
  { id: 'w029', wordA: 'RNA', wordB: 'DNA', category: '生物', difficulty: 'hard' },
  { id: 'w030', wordA: '量子纠缠', wordB: '引力波', category: '物理', difficulty: 'hard' },
  { id: 'w031', wordA: '后现代主义', wordB: '结构主义', category: '艺术', difficulty: 'hard' },
  { id: 'w032', wordA: '形而上', wordB: '形而下', category: '哲学', difficulty: 'hard' },
  { id: 'w033', wordA: '包豪斯', wordB: '装饰艺术', category: '设计', difficulty: 'hard' },
  { id: 'w034', wordA: '印象派', wordB: '野兽派', category: '绘画', difficulty: 'hard' },
]

/**
 * 按难度筛选词对
 */
export function getWordsByDifficulty(
  difficulty: 'random' | 'easy' | 'medium' | 'hard'
): WordPair[] {
  if (difficulty === 'random') return builtinWords
  return builtinWords.filter((w) => w.difficulty === difficulty)
}

/**
 * 随机获取一组词对
 */
export function getRandomWordPair(
  difficulty: 'random' | 'easy' | 'medium' | 'hard' = 'random'
): WordPair {
  const pool = getWordsByDifficulty(difficulty)
  if (pool.length === 0) {
    // 兜底：返回第一个 easy 词对
    return builtinWords[0]!
  }
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]!
}
