import { ChangeEvent, useMemo, useState } from 'react'
import { Archive, Copy, FileText, Plus, Trash2, Upload, X } from 'lucide-react'
import { CasePackItem } from '../types'
import { useFeedback } from './FeedbackProvider'
import {
  buildCasePackZipFiles,
  downloadBlob,
  extractWorkOrderDate,
  validateCasePackItems
} from '../utils/casePack'

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'

function createCaseId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function createEmptyCase(): CasePackItem {
  return {
    id: createCaseId(),
    workOrderNo: '',
    agencyEmail: '',
    agencyName: '',
    agencyPhone: '',
    documentNumber: '',
    uploadedFiles: []
  }
}

export default function CasePackSection() {
  const { notify } = useFeedback()
  const initialCase = createEmptyCase()
  const [caseItems, setCaseItems] = useState<CasePackItem[]>([initialCase])
  const [activeCaseId, setActiveCaseId] = useState(initialCase.id)
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({})
  const [isPacking, setIsPacking] = useState(false)

  const totalFiles = useMemo(
    () => caseItems.reduce((sum, item) => sum + item.uploadedFiles.length, 0),
    [caseItems]
  )

  const activeCase = useMemo(
    () => caseItems.find(item => item.id === activeCaseId) || caseItems[0],
    [activeCaseId, caseItems]
  )

  const activeCaseErrors = activeCase ? validationErrors[activeCase.id] || [] : []

  const updateCaseField = (
    id: string,
    field: keyof Omit<CasePackItem, 'id' | 'uploadedFiles'>,
    value: string
  ) => {
    setCaseItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    )
    setValidationErrors(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleFilesChange = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const incoming = Array.from(files)
    setCaseItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const nextFiles = [...item.uploadedFiles]
        incoming.forEach(file => {
          const exists = nextFiles.some(
            f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
          )
          if (!exists) nextFiles.push(file)
        })
        return {
          ...item,
          uploadedFiles: nextFiles
        }
      })
    )
  }

  const removeFile = (id: string, fileIndex: number) => {
    setCaseItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              uploadedFiles: item.uploadedFiles.filter((_, idx) => idx !== fileIndex)
            }
          : item
      )
    )
  }

  const addCase = () => {
    const newCase = createEmptyCase()
    setCaseItems(prev => [...prev, newCase])
    setActiveCaseId(newCase.id)
  }

  const duplicateCase = (id: string) => {
    const source = caseItems.find(item => item.id === id)
    if (!source) return

    const duplicated: CasePackItem = {
      ...source,
      id: createCaseId(),
      uploadedFiles: [...source.uploadedFiles]
    }

    setCaseItems(prev => [...prev, duplicated])
    setActiveCaseId(duplicated.id)
  }

  const removeCase = (id: string) => {
    setCaseItems(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter(item => item.id !== id)
      if (activeCaseId === id && next.length > 0) {
        setActiveCaseId(next[0].id)
      }
      return next
    })
    setValidationErrors(prev => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const resetForm = () => {
    const newCase = createEmptyCase()
    setCaseItems([newCase])
    setActiveCaseId(newCase.id)
    setValidationErrors({})
  }

  const handlePack = async () => {
    const validation = validateCasePackItems(caseItems)
    const invalid = validation.filter(item => item.errors.length > 0)

    if (invalid.length > 0) {
      const nextErrors: Record<string, string[]> = {}
      invalid.forEach(item => {
        nextErrors[item.id] = item.errors
      })
      setValidationErrors(nextErrors)
      setActiveCaseId(invalid[0].id)
      notify(`共有 ${invalid.length} 件案件資料不完整，請先修正後再打包`, 'warning')
      return
    }

    setValidationErrors({})
    setIsPacking(true)
    try {
      const zipFiles = await buildCasePackZipFiles(caseItems)
      for (const output of zipFiles) {
        downloadBlob(output.blob, output.fileName)
        await new Promise(resolve => setTimeout(resolve, 120))
      }
      notify(`案件整理打包完成，已下載 ${zipFiles.length} 個案件 ZIP`, 'success')
    } catch (error) {
      console.error('打包失敗:', error)
      notify('打包失敗，請稍後再試', 'error')
    } finally {
      setIsPacking(false)
    }
  }

  if (!activeCase) return null

  const activeWorkOrderDate = extractWorkOrderDate(activeCase.workOrderNo)

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <h1 className="section-title">案件整理打包（批量）</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
        <div className="card-compact space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">案件 Tabs</h3>
            <button
              onClick={addCase}
              disabled={isPacking}
              className="btn btn-ghost !px-2 !py-1.5 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
            {caseItems.map((item, idx) => {
              const isActive = item.id === activeCase.id
              const label = item.agencyName || item.workOrderNo || `案件 #${idx + 1}`
              const errorCount = (validationErrors[item.id] || []).length

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveCaseId(item.id)}
                  className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                    isActive
                      ? 'border-slate-400 bg-slate-100/70 dark:bg-slate-800/60'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">案件 #{idx + 1}</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={label}>
                    {label}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    附件 {item.uploadedFiles.length} {errorCount > 0 ? `| 錯誤 ${errorCount}` : ''}
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={handlePack}
            disabled={isPacking}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <Archive className="w-4 h-4" />
            {isPacking ? '打包中...' : `下載每案 ZIP（${caseItems.length} 件）`}
          </button>
          <button
            onClick={resetForm}
            disabled={isPacking}
            className="btn btn-ghost w-full"
          >
            清空全部
          </button>
        </div>

        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">
              目前編輯：案件 #{caseItems.findIndex(item => item.id === activeCase.id) + 1}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => duplicateCase(activeCase.id)}
                disabled={isPacking}
                className="btn btn-ghost !px-3 !py-2 flex items-center gap-1"
                title="複製這筆案件"
              >
                <Copy className="w-4 h-4" />
                複製
              </button>
              <button
                onClick={() => removeCase(activeCase.id)}
                disabled={isPacking || caseItems.length <= 1}
                className="btn btn-ghost !px-3 !py-2 flex items-center gap-1 text-red-500"
                title="刪除這筆案件"
              >
                <Trash2 className="w-4 h-4" />
                刪除
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                执法请求-工单号（司法案件编号）
              </label>
              <input
                type="text"
                value={activeCase.workOrderNo}
                onChange={(e) => updateCaseField(activeCase.id, 'workOrderNo', e.target.value)}
                placeholder="請輸入工單號 / 案件編號"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                工单日期（從工单号自動提取）
              </label>
              <input
                type="text"
                value={activeWorkOrderDate}
                readOnly
                placeholder="例如：20260119"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                司法机构-邮箱
              </label>
              <input
                type="email"
                value={activeCase.agencyEmail}
                onChange={(e) => updateCaseField(activeCase.id, 'agencyEmail', e.target.value)}
                placeholder="example@agency.gov"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                司法机构-名称
              </label>
              <input
                type="text"
                value={activeCase.agencyName}
                onChange={(e) => updateCaseField(activeCase.id, 'agencyName', e.target.value)}
                placeholder="請輸入司法机构名稱"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                司法机构-电话
              </label>
              <input
                type="text"
                value={activeCase.agencyPhone}
                onChange={(e) => updateCaseField(activeCase.id, 'agencyPhone', e.target.value)}
                placeholder="請輸入聯絡電話"
                className="input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                司法/执法文书-编号
              </label>
              <input
                type="text"
                value={activeCase.documentNumber}
                onChange={(e) => updateCaseField(activeCase.id, 'documentNumber', e.target.value)}
                placeholder="請輸入文書編號"
                className="input"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-5 h-5 text-slate-500" />
              <h3 className="text-base font-semibold">上傳檔案</h3>
            </div>
            <input
              type="file"
              accept={ACCEPT_TYPES}
              multiple
              onChange={(e) => handleFilesChange(activeCase.id, e)}
              className="input"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              支援多選：pdf、doc/docx、xls/xlsx、png、jpg
            </p>
          </div>

          {activeCase.uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                已上傳 {activeCase.uploadedFiles.length} 個檔案
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {activeCase.uploadedFiles.map((file, fileIndex) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${fileIndex}`}
                    className="flex items-center justify-between glass rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(activeCase.id, fileIndex)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeCaseErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-3">
              <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                此案件有 {activeCaseErrors.length} 項資料需修正
              </div>
              <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                {activeCaseErrors.map((error, errorIndex) => (
                  <p key={`${activeCase.id}-error-${errorIndex}`}>- {error}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card-compact">
            <h3 className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">批量摘要</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              目前共 {caseItems.length} 件案件，附件總數 {totalFiles} 個。
            </p>
          </div>

          <div className="card-compact space-y-2">
            <h3 className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">輸出規則</h3>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <p>左側小卡可快速切換案件（Tabs 模式）。</p>
              <p>工单日期會從工单号自動提取前 8 碼（YYYYMMDD）。</p>
              <p>資料夾名稱：`司法机构-名称 + 工单日期 + 调证`。</p>
              <p>每案會下載一個 ZIP，內含該案 DOCX 與附件。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
