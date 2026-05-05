<template>
  <div class="app-root">
    <!-- 书架页面 -->
    <Bookshelf
      v-if="currentView === 'shelf'"
      :nightMode="settings.nightMode"
      @add-book="onAddBook"
      @open-book="onOpenBook"
    />

    <!-- 阅读页面 -->
    <Reader
      v-else-if="currentView === 'reader'"
      :book="currentBook"
      @back="backToShelf"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Bookshelf from './components/Bookshelf.vue'
import Reader from './components/Reader.vue'
import { getSettings, saveBook as storeBook, getBooks, saveSettings } from './utils/bookStore.js'

const currentView = ref('shelf') // shelf | reader
const currentBook = ref(null)
const settings = ref(getSettings())

// 添加书籍
async function onAddBook() {
  if (!window.electronAPI) {
    alert('Electron API 不可用，请确保在 Electron 环境中运行')
    return
  }

  try {
    const results = await window.electronAPI.openFiles()
    if (!results || results.length === 0) return

    for (const result of results) {
      if (result.error) {
        alert(`读取 ${result.filePath} 失败: ${result.error}`)
        continue
      }
      // 存储到本地
      storeBook({
        filePath: result.filePath,
        fileName: result.fileName,
        content: result.content,
        encoding: result.encoding,
        currentChapterIndex: 0,
        currentScrollTop: 0,
        progress: 0,
      })
    }

    // 如果只选了一本书，直接打开
    if (results.length === 1 && !results[0].error) {
      onOpenBookFromResult(results[0])
    }
  } catch (err) {
    alert('添加书籍出错: ' + err.message)
  }
}

// 从书架打开已保存的书籍
function onOpenBook(book) {
  // 书籍数据可能已过期（content 较大不存 localStorage），需要从文件重新读取
  // 优先使用 localStorage 中的 content，如果没有则从文件读取
  const stored = getBooks()[book.filePath]
  if (stored && stored.content) {
    currentBook.value = stored
    currentView.value = 'reader'
    return
  }

  // 从文件重新读取
  if (window.electronAPI) {
    window.electronAPI.readFile(book.filePath).then(result => {
      if (result.error) {
        alert('读取文件失败: ' + result.error)
        return
      }
      onOpenBookFromResult({ ...result, currentChapterIndex: book.currentChapterIndex, currentScrollTop: book.currentScrollTop, progress: book.progress })
    })
  }
}

// 从文件读取结果打开
function onOpenBookFromResult(fileResult) {
  const stored = getBooks()[fileResult.filePath]
  currentBook.value = {
    ...fileResult,
    currentChapterIndex: stored?.currentChapterIndex || 0,
    currentScrollTop: stored?.currentScrollTop || 0,
    progress: stored?.progress || 0,
  }
  // 更新存储
  storeBook(currentBook.value)
  currentView.value = 'reader'
}

function backToShelf() {
  currentView.value = 'shelf'
  currentBook.value = null
}
</script>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

#app {
  height: 100%;
}

.app-root {
  height: 100%;
}

/* 全局滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.12);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.2);
}
</style>
