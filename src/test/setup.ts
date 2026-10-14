import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// globals: false なので Testing Library の自動クリーンアップが効かない。明示的に行う
afterEach(() => cleanup())
