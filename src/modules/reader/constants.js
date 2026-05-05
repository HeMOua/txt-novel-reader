/**
 * 阅读器常量定义
 */

// 目录标签页
export const CATALOG_TABS = [
  { id: 'catalog', name: '目录' },
  { id: 'notes', name: '笔记' },
  { id: 'bookmarks', name: '书签' },
]

// 翻页方式
export const PAGE_MODES = [
  { id: 'scroll', name: '上下滑动', icon: '<path d="M12 4v16" stroke-linecap="round"/><path d="M7 8l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'cover', name: '左右覆盖', icon: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/><path d="M10 12h4" stroke-linecap="round"/>' },
  { id: 'real', name: '仿真翻页', icon: '<path d="M4 4c4 0 6 2 8 2s4-2 8-2"/><path d="M4 12c4 0 6 2 8 2s4-2 8-2"/><path d="M4 20c4 0 6-2 8-2s4 2 8 2"/>' },
  { id: 'none', name: '无动效', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12h6" stroke-linecap="round"/>' },
  { id: 'slide', name: '平移翻页', icon: '<rect x="3" y="5" width="12" height="14" rx="1"/><path d="M15 12h6M19 9l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/>' },
]
