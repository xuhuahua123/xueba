/**
 * 响应式布局 Hook
 * 使用 window.innerWidth 检测设备类型
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useResponsive() {
  const width = ref(window.innerWidth)
  
  const updateWidth = () => { width.value = window.innerWidth }
  
  onMounted(() => window.addEventListener('resize', updateWidth))
  onUnmounted(() => window.removeEventListener('resize', updateWidth))
  
  return {
    // 手机（< 768px）
    isMobile: computed(() => width.value < 768),
    // 平板（768px ~ 1024px）
    isTablet: computed(() => width.value >= 768 && width.value < 1024),
    // 桌面（>= 1024px）
    isDesktop: computed(() => width.value >= 1024)
  }
}