import type { Transaction, TxType } from './types'

const TYPE_LABEL: Record<TxType, string> = {
  opening: 'はじめのポイント',
  stamp: 'スタンプ',
  spend: 'つかう',
  deposit: 'ちょきん',
  withdraw: 'ひきだし',
  interest: 'りそく',
}

export function describeTx(tx: Transaction, childName: string): string {
  return `${childName}：${tx.memo ? `${tx.memo} ` : ''}${TYPE_LABEL[tx.type]} ${tx.points}pt`
}
