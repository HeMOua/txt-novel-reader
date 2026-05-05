<template>
  <div class="app-root">
    <Bookshelf
      v-if="currentView === 'shelf'"
      :nightMode="settings.nightMode"
      @add-book="onAddBook"
      @open-book="onOpenBook"
    />
    <Reader
      v-else-if="currentView === 'reader'"
      :book="currentBook"
      @back="backToShelf"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Bookshelf from './components/Bookshelf.vue'
import Reader from './components/Reader.vue'
import { getSettings, saveBook as storeBook, getBooks } from './utils/bookStore.js'

const currentView = ref('shelf')
const currentBook = ref(null)
const settings = ref(getSettings())

// 添加书籍到书架（不自动打开，只注册元信息）
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
      storeBook({
        filePath: result.filePath,
        fileName: result.fileName,
        encoding: result.encoding,
        currentChapterIndex: 0,
        currentScrollRatio: 0,
        progress: 0,
      })
    }

    // 只选了一本就直接打开
    if (results.length === 1 && !results[0].error) {
      await openBookByPath(results[0].filePath)
    }
  } catch (err) {
    alert('添加书籍出错: ' + err.message)
  }
}

// 从书架点击打开
async function onOpenBook(book) {
  await openBookByPath(book.filePath)
}

// 核心：调用主进程 open-book，拿到 fullText + 章节索引
async function openBookByPath(filePath) {
  if (!window.electronAPI) {
    alert('Electron API 不可用')
    return
  }
  try {
    const result = await window.electronAPI.openBook(filePath)
    if (result.error) {
      alert('读取文件失败: ' + result.error)
      return
    }

    const stored = getBooks()[filePath] || {}

    currentBook.value = {
      filePath: result.filePath,
      fileName: result.fileName,
      encoding: result.encoding,
      fullText: result.fullText,      // 原始全文字符串（Reader 用 slice 按需取）
      chapters: result.chapters,      // 轻量索引 [{title, start, end, index}]
      totalChapters: result.totalChapters,
      currentChapterIndex: stored.currentChapterIndex || 0,
      currentScrollRatio: stored.currentScrollRatio || 0,  // 0~1 比例
      progress: stored.progress || 0,
    }

    storeBook({
      filePath: result.filePath,
      fileName: result.fileName,
      encoding: result.encoding,
      currentChapterIndex: currentBook.value.currentChapterIndex,
      currentScrollRatio: currentBook.value.currentScrollRatio,
      progress: currentBook.value.progress,
    })

    currentView.value = 'reader'
  } catch (err) {
    alert('打开书籍出错: ' + err.message)
  }
}

function backToShelf() {
  currentView.value = 'shelf'
  currentBook.value = null
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
#app, .app-root { height: 100%; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
</style>
