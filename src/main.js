import { createApp } from 'vue'
import App from './App.vue'

// 全局样式引入（顺序重要）
import '@/styles/reset.scss'
import '@/styles/global.scss'
import '@/styles/transitions.scss'

createApp(App).mount('#app')
