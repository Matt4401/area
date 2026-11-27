import { readAdrs } from '../adr'

export default {
  watch: ['../../src/adr/*.md'],
  load: () => readAdrs(),
}
