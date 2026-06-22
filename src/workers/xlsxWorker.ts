import * as XLSX from 'xlsx'
import type { MergedResultItem } from '../types'

type WorkerRequest =
  | {
      id: number
      action: 'parseOutput'
      payload: ArrayBuffer
    }
  | {
      id: number
      action: 'parseAnalysis'
      payload: ArrayBuffer
    }

type WorkerResponse =
  | {
      id: number
      ok: true
      result: unknown
    }
  | {
      id: number
      ok: false
      error: string
    }

interface OutputParseResult {
  uids: string[]
  txids: string[]
  addresses: string[]
  results: MergedResultItem[]
}

function parseOutputPayload(buffer: ArrayBuffer): OutputParseResult {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  const uids = new Set<string>()
  const txids = new Set<string>()
  const addresses = new Set<string>()
  const results: MergedResultItem[] = []

  jsonData.forEach(row => {
    const rawUid = (row['UID Matching Results'] || row['匹配UID结果'] || '').toString().trim()
    const infoType = (row['Information Type'] || row['信息类型'] || '').toString().trim()
    const infoDetail = (row['Investigation Information'] || row['调证信息'] || '').toString().trim()

    if (!rawUid || rawUid === 'None') return
    uids.add(rawUid)

    if (infoType === 'TXID') {
      txids.add(infoDetail)
      results.push({ uid: rawUid, type: 'TXID', info: infoDetail })
    } else if (infoType === 'User Deposit Address' || infoType === '用户充值地址') {
      addresses.add(infoDetail)
      results.push({ uid: rawUid, type: '充值地址', info: infoDetail })
    }
  })

  return {
    uids: Array.from(uids),
    txids: Array.from(txids),
    addresses: Array.from(addresses),
    results
  }
}

function parseAnalysisPayload(buffer: ArrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    const result =
      request.action === 'parseOutput'
        ? parseOutputPayload(request.payload)
        : parseAnalysisPayload(request.payload)

    const response: WorkerResponse = {
      id: request.id,
      ok: true,
      result
    }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : '解析失敗'
    }
    self.postMessage(response)
  }
}

