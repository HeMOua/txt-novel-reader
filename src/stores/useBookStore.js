import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getBooks, saveBook as storeBook, deleteBook as removeBook, getSortedBooks, updateProgress, flushProgress } from '@/utils/bookStore.js'

export const useBookStore = defineStore('books', () => {
  const books = ref(getBooks())
  const sortBy = ref('lastRead')

  const sortedBooks = computed(() => getSortedBooks(sortBy.value))

  function addBook(bookData) {
    storeBook(bookData)
    books.value = getBooks()
  }

  function remove(filePath) {
    removeBook(filePath)
    books.value = getBooks()
  }

  function saveProgress(filePath, chapterIndex, scrollRatio, progress) {
    updateProgress(filePath, chapterIndex, scrollRatio, progress)
  }

  function flushAllProgress() {
    flushProgress()
  }

  function getBook(filePath) {
    return books.value[filePath] || null
  }

  return {
    books,
    sortBy,
    sortedBooks,
    addBook,
    remove,
    saveProgress,
    flushAllProgress,
    getBook,
  }
})
