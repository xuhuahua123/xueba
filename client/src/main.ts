/**
 * 应用入口
 * Vue 3 + Naive UI
 */
import { createApp } from 'vue'
import naive from 'naive-ui'
import App from './App.vue'

const app = createApp(App)
// 全局注册 Naive UI 组件，模板中可直接用 <n-xxx>
app.use(naive)
app.mount('#app')
