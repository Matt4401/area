import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { readAdrs } from './adr'

const base = '/area/'

export default withMermaid(
  defineConfig({
    title: 'AREA Developer Docs',
    description: 'Architecture decisions and technical documentation for the AREA project.',
    lang: 'en',
    base,
    srcDir: 'src',
    cleanUrls: true,
    lastUpdated: true,
    // Dead internal links fail the build (VitePress default); never opt out.
    ignoreDeadLinks: false,
    head: [['link', { rel: 'icon', href: `${base}favicon.svg` }]],
    themeConfig: {
      logo: '/favicon.svg',
      search: { provider: 'local' },
      nav: [
        { text: 'MVP scope', link: '/mvp' },
        { text: 'ADRs', link: '/adr/' },
      ],
      sidebar: [
        { text: 'MVP scope', link: '/mvp' },
        {
          text: 'Architecture decisions',
          link: '/adr/',
          items: readAdrs().map((a) => ({ text: `${a.number} ${a.title}`, link: a.url })),
        },
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/Matt4401/area' }],
      editLink: {
        pattern: 'https://github.com/Matt4401/area/edit/main/apps/docs/src/:path',
      },
    },
    markdown: {
      // Docs talk about `{{ key }}` templating: never let Vue interpolate inline code.
      config(md) {
        const fallback = md.renderer.rules.code_inline!
        md.renderer.rules.code_inline = (tokens, idx, opts, env, self) =>
          fallback(tokens, idx, opts, env, self).replace(/^<code/, '<code v-pre')
      },
    },
    // pnpm + mermaid: dev-mode pre-bundling needs elkjs (CJS) listed explicitly.
    vite: { optimizeDeps: { include: ['elkjs/lib/elk.bundled.js'] } },
    mermaid: {},
  }),
)
