import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import AdrIndex from './AdrIndex.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AdrIndex', AdrIndex)
  },
} satisfies Theme
