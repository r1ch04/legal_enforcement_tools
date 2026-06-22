import type { ExcelRow, MergedResultItem } from '../types'

type RequestAction = 'parseOutput' | 'parseAnalysis'

type WorkerRequest = {
  id: number
  action: RequestAction
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

let worker: Worker | null = null
let requestId = 0
const pending = new Map<
  number,
  {
    resolve: (value: any) => void
    reject: (reason?: unknown) => void
  }
>()

function getWorker() {
  if (worker) return worker

  worker = new Worker(new URL('../workers/xlsxWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const data = event.data
    const task = pending.get(data.id)
    if (!task) return
    pending.delete(data.id)

    if (data.ok) {
      task.resolve(data.result)
    } else {
      task.reject(new Error(data.error || 'Worker 解析失敗'))
    }
  }

  worker.onerror = (event: ErrorEvent) => {
    pending.forEach(task => task.reject(new Error(event.message || 'Worker 發生錯誤')))
    pending.clear()
  }

  return worker
}

function runWorkerTask<T>(action: RequestAction, payload: ArrayBuffer): Promise<T> {
  const id = ++requestId
  const request: WorkerRequest = { id, action, payload }

  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage(request, [payload])
  })
}

export async function parseOutputFileInWorker(file: File) {
  const buffer = await file.arrayBuffer()
  return runWorkerTask<OutputParseResult>('parseOutput', buffer)
}

export async function parseAnalysisFileInWorker(file: File) {
  const buffer = await file.arrayBuffer()
  return runWorkerTask<ExcelRow[]>('parseAnalysis', buffer)
}
