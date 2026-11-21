// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProjectedInterest } from '../../domain/interest'
import { Pockets } from './Pockets'

const payAt = new Date('2026-12-01T00:00')

function renderSavings(savings: number, projected: Partial<ProjectedInterest>) {
  render(
    <Pockets
      balances={{ wallet: 25, savings }}
      projected={{ savings, points: 0, blocked: false, payAt, next: null, ...projected }}
    />,
  )
  return within(screen.getByRole('region', { name: 'ふえる ちょきん' }))
}

describe('Pockets の利息の見込み', () => {
  it('いつ何pt 増えるかと、あと何pt ちょきんすれば もっと増えるかを見せる', () => {
    const box = renderSavings(33, { points: 1, next: { more: 7, points: 2 } })
    expect(box.getByText('12/1 に +1pt ふえるよ')).toBeInTheDocument()
    expect(box.getByText('あと 7pt ちょきんすると +2pt に なるよ')).toBeInTheDocument()
    expect(box.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('ふえる ちょきんが 0pt なら、ちょきんすると増えることを見せる', () => {
    const box = renderSavings(0, { next: { more: 1, points: 1 } })
    expect(box.getByText('ちょきんすると、つぎの 1にちに ふえるよ')).toBeInTheDocument()
  })

  it('今月ひきだしていたら、来月1日は増えないことを見せる', () => {
    const box = renderSavings(50, { blocked: true })
    expect(box.getByText('こんげつは ひきだしたので、12/1 は ふえないよ')).toBeInTheDocument()
    expect(box.queryByText(/あと/)).not.toBeInTheDocument()
  })

  it('利率が 0 なら、利息のことは書かない', () => {
    const box = renderSavings(33, {})
    expect(box.queryByText(/ふえるよ|ふえないよ/)).not.toBeInTheDocument()
  })
})
