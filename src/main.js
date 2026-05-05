import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// 全局样式引入（顺序重要）
import '@/styles/reset.scss'
import '@/styles/global.scss'
import '@/styles/transitions.scss'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
