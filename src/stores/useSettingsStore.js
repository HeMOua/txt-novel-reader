import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { getSettings, saveSettings } from '@/utils/bookStore.js'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref(getSettings())

  function updateSettings(partial) {
    Object.assign(settings.value, partial)
    saveSettings(settings.value)
  }

  function changeFontSize(delta) {
    settings.value.fontSize = Math.max(12, Math.min(36, settings.value.fontSize + delta))
    saveSettings(settings.value)
  }

  function setLineHeight(value) {
    settings.value.lineHeight = value
    saveSettings(settings.value)
  }

  function setTheme(theme) {
    settings.value.theme = theme.id
    settings.value.fontColor = theme.fontColor
    settings.value.bgColor = theme.bgColor
    settings.value.nightMode = theme.id === 'night'
    saveSettings(settings.value)
  }

  function toggleNightMode() {
    settings.value.nightMode = !settings.value.nightMode
    if (settings.value.nightMode) {
      settings.value.theme = 'night'
      settings.value.fontColor = '#888'
      settings.value.bgColor = '#1a1a1a'
    } else {
      settings.value.theme = 'default'
      settings.value.fontColor = '#2c2c2c'
      settings.value.bgColor = '#f5f0e8'
    }
    saveSettings(settings.value)
  }

  function setAutoReadMode(mode) {
    settings.value.autoReadMode = mode
    saveSettings(settings.value)
  }

  return {
    settings,
    updateSettings,
    changeFontSize,
    setLineHeight,
    setTheme,
    toggleNightMode,
    setAutoReadMode,
  }
})
