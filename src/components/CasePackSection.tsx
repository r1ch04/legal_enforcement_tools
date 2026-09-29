import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Archive, ArrowDown, ArrowUp, Copy, FileText, Plus, Settings2, Trash2, Upload, X } from 'lucide-react'
import {
  CasePackDocxFieldConfig,
  CasePackDocxFieldKey,
  CasePackDocxFieldSelection,
  CasePackItem
} from '../types'
import { useFeedback } from './FeedbackProvider'
import {
  buildCasePackZipFiles,
  downloadBlob,
  extractWorkOrderDate,
  getCasePackZipPreviews,
  validateCasePackItems
} from '../utils/casePack'

const ACCEPT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg'
const ALLOWED_EXTENSIONS = new Set(ACCEPT_TYPES.split(','))
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_FILE_SIZE_BYTES = 100 * 1024 * 1024
const DRAFT_STORAGE_KEY = 'legal-enforcement-tools.case-pack-draft'
const DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000

const DEFAULT_DOCX_FIELDS: CasePackDocxFieldConfig[] = [
  { key: 'workOrderNo', label: '执法请求-工单号（司法案件编号）', defaultIncluded: false },
  { key: 'agencyEmail', label: '司法机构-邮箱', defaultIncluded: true },
  { key: 'agencyName', label: '司法机构-名称', defaultIncluded: true },
  { key: 'agencyPhone', label: '司法机构-电话', defaultIncluded: true },
  { key: 'documentNumber', label: '司法/执法文书-编号', defaultIncluded: true },
  { key: 'officerName', label: '警官名', defaultIncluded: true }
]

interface CasePackDraft {
  savedAt: number
  activeCaseId: string
  caseItems: Omit<CasePackItem, 'uploadedFiles'>[]
  docxFields: CasePackDocxFieldConfig[]
}

function createCaseId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function createEmptyCase(docxFields = DEFAULT_DOCX_FIELDS): CasePackItem {
  return {
    id: createCaseId(),
    workOrderNo: '',
    agencyEmail: '',
    agencyName: '',
    agencyPhone: '',
    documentNumber: '',
    officerName: '',
    includedDocxFields: Object.fromEntries(
      docxFields.map(field => [field.key, field.defaultIncluded])
    ) as unknown as CasePackDocxFieldSelection,
    uploadedFiles: []
  }
}

function loadDraft(): CasePackDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as CasePackDraft
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
      return null
    }
    if (!Array.isArray(draft.caseItems) || !Array.isArray(draft.docxFields)) return null
    return draft
  } catch {
    return null
  }
}

function hydrateCase(item: Partial<CasePackItem>, docxFields: CasePackDocxFieldConfig[]): CasePackItem {
  const emptyCase = createEmptyCase(docxFields)
  return {
    ...emptyCase,
    ...item,
    id: typeof item.id === 'string' ? item.id : createCaseId(),
    includedDocxFields: {
      ...emptyCase.includedDocxFields,
      ...item.includedDocxFields
    },
    uploadedFiles: []
  }
}

export default function CasePackSection() {
  const { notify } = useFeedback()
  const [initialDraft] = useState<CasePackDraft | null>(() => loadDraft())
  const [docxFields, setDocxFields] = useState<CasePackDocxFieldConfig[]>(
    initialDraft?.docxFields?.length ? initialDraft.docxFields : DEFAULT_DOCX_FIELDS
  )
  const [caseItems, setCaseItems] = useState<CasePackItem[]>(() => {
    const draftFields = initialDraft?.docxFields?.length ? initialDraft.docxFields : DEFAULT_DOCX_FIELDS
    return initialDraft?.caseItems?.length
      ? initialDraft.caseItems.map(item => hydrateCase(item, draftFields))
      : [createEmptyCase(draftFields)]
  })
  const [activeCaseId, setActiveCaseId] = useState(() => initialDraft?.activeCaseId || '')
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({})
  const [isPacking, setIsPacking] = useState(false)
  const [packProgress, setPackProgress] = useState({ completed: 0, total: 0, phase: '' })

  useEffect(() => {
    if (!activeCaseId && caseItems[0]) setActiveCaseId(caseItems[0].id)
  }, [activeCaseId, caseItems])

  useEffect(() => {
    try {
      const draft: CasePackDraft = {
        savedAt: Date.now(),
        activeCaseId,
        caseItems: caseItems.map(({ uploadedFiles, ...item }) => item),
        docxFields
      }
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } catch {
      // 草稿功能不應影響案件打包。
    }
  }, [activeCaseId, caseItems, docxFields])

  const totalFiles = useMemo(
    () => caseItems.reduce((sum, item) => sum + item.uploadedFiles.length, 0),
    [caseItems]
  )

  const activeCase = useMemo(
    () => caseItems.find(item => item.id === activeCaseId) || caseItems[0],
    [activeCaseId, caseItems]
  )

  const activeCaseErrors = activeCase ? validationErrors[activeCase.id] || [] : []
  const zipPreviews = useMemo(() => getCasePackZipPreviews(caseItems), [caseItems])

  const updateCaseField = (
    id: string,
    field: Exclude<keyof CasePackItem, 'id' | 'uploadedFiles' | 'includedDocxFields'>,
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

  const toggleDocxField = (id: string, field: keyof CasePackDocxFieldSelection) => {
    setCaseItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              includedDocxFields: {
                ...item.includedDocxFields,
                [field]: !item.includedDocxFields[field]
              }
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
    const rejected: string[] = []
    const existingFiles = caseItems.find(item => item.id === id)?.uploadedFiles || []
    const acceptedFiles: File[] = []
    let totalSize = existingFiles.reduce((sum, file) => sum + file.size, 0)
    incoming.forEach(file => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        rejected.push(`${file.name}：不支援的格式`)
        return
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push(`${file.name}：超過單檔 20 MB`)
        return
      }
      const exists = [...existingFiles, ...acceptedFiles].some(
        existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified
      )
      if (exists) {
        rejected.push(`${file.name}：已存在`)
        return
      }
      if (totalSize + file.size > MAX_TOTAL_FILE_SIZE_BYTES) {
        rejected.push(`${file.name}：案件附件總容量不可超過 100 MB`)
        return
      }
      acceptedFiles.push(file)
      totalSize += file.size
    })

    setCaseItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        return {
          ...item,
          uploadedFiles: [...item.uploadedFiles, ...acceptedFiles]
        }
      })
    )
    e.target.value = ''
    if (rejected.length > 0) notify(`未加入 ${rejected.length} 個檔案：${rejected.join('；')}`, 'warning')
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
    const newCase = createEmptyCase(docxFields)
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
    const newCase = createEmptyCase(docxFields)
    setCaseItems([newCase])
    setActiveCaseId(newCase.id)
    setValidationErrors({})
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    notify('表單與本機暫存已清空', 'success')
  }

  const updateDocxFieldConfig = (key: CasePackDocxFieldKey, patch: Partial<CasePackDocxFieldConfig>) => {
    setDocxFields(prev => prev.map(field => (field.key === key ? { ...field, ...patch } : field)))
  }

  const moveDocxField = (key: CasePackDocxFieldKey, direction: -1 | 1) => {
    setDocxFields(prev => {
      const index = prev.findIndex(field => field.key === key)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  const applyDocxDefaults = () => {
    setCaseItems(prev =>
      prev.map(item => ({
        ...item,
        includedDocxFields: Object.fromEntries(
          docxFields.map(field => [field.key, field.defaultIncluded])
        ) as unknown as CasePackDocxFieldSelection
      }))
    )
  }

  const handlePack = async () => {
    const validation = validateCasePackItems(caseItems, docxFields)
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
    setPackProgress({ completed: 0, total: caseItems.length, phase: '建立 ZIP' })
    try {
      const zipFiles = await buildCasePackZipFiles(caseItems, docxFields, (completed, total) => {
        setPackProgress({ completed, total, phase: '建立 ZIP' })
      })
      for (const [index, output] of zipFiles.entries()) {
        setPackProgress({ completed: index, total: zipFiles.length, phase: '下載 ZIP' })
        downloadBlob(output.blob, output.fileName)
        await new Promise(resolve => setTimeout(resolve, 120))
        setPackProgress({ completed: index + 1, total: zipFiles.length, phase: '下載 ZIP' })
      }
      notify(`案件整理打包完成，已下載 ${zipFiles.length} 個案件 ZIP`, 'success')
    } catch (error) {
      console.error('打包失敗:', error)
      notify('打包失敗，請稍後再試', 'error')
    } finally {
      setIsPacking(false)
      setPackProgress({ completed: 0, total: 0, phase: '' })
    }
  }

  if (!activeCase) return null

  const activeWorkOrderDate = extractWorkOrderDate(activeCase.workOrderNo)
  const getFieldLabel = (key: CasePackDocxFieldKey) =>
    docxFields.find(field => field.key === key)?.label || key

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
          {isPacking && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{packProgress.phase}</span>
                <span>{packProgress.completed}/{packProgress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-slate-600 transition-all"
                  style={{ width: `${packProgress.total ? (packProgress.completed / packProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
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

          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">DOCX 輸出內容</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">勾選的欄位會寫入 DOCX；工單號預設不輸出。</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={activeCase.includedDocxFields.workOrderNo}
                  onChange={() => toggleDocxField(activeCase.id, 'workOrderNo')}
                />
                <span>{getFieldLabel('workOrderNo')}</span>
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
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={activeCase.includedDocxFields.agencyEmail}
                  onChange={() => toggleDocxField(activeCase.id, 'agencyEmail')}
                />
                <span>{getFieldLabel('agencyEmail')}</span>
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
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={activeCase.includedDocxFields.agencyName}
                  onChange={() => toggleDocxField(activeCase.id, 'agencyName')}
                />
                <span>{getFieldLabel('agencyName')}</span>
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
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={activeCase.includedDocxFields.agencyPhone}
                  onChange={() => toggleDocxField(activeCase.id, 'agencyPhone')}
                />
                <span>{getFieldLabel('agencyPhone')}</span>
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
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={activeCase.includedDocxFields.documentNumber}
                  onChange={() => toggleDocxField(activeCase.id, 'documentNumber')}
                />
                <span>{getFieldLabel('documentNumber')}</span>
              </label>
              <input
                type="text"
                value={activeCase.documentNumber}
                onChange={(e) => updateCaseField(activeCase.id, 'documentNumber', e.target.value)}
                placeholder="請輸入文書編號"
                className="input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={activeCase.includedDocxFields.officerName}
                  onChange={() => toggleDocxField(activeCase.id, 'officerName')}
                />
                <span>{getFieldLabel('officerName')}</span>
              </label>
              <input
                type="text"
                value={activeCase.officerName}
                onChange={(e) => updateCaseField(activeCase.id, 'officerName', e.target.value)}
                placeholder="請輸入警官姓名"
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
              支援多選：pdf、doc/docx、xls/xlsx、txt、png、jpg
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">草稿僅保留 2 小時，附件不會儲存；可用左側「清空全部」手動清除。</p>
          </div>

          <div className="card-compact space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">DOCX 欄位設定</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">可改名稱、調整輸出順序及新案件的預設勾選。既有案件可套用新預設。</p>
            <div className="space-y-2">
              {docxFields.map((field, index) => (
                <div key={field.key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateDocxFieldConfig(field.key, { label: e.target.value })}
                      aria-label={`${field.label} 欄位名稱`}
                      className="input !py-1.5 text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => moveDocxField(field.key, -1)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                      title="上移"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDocxField(field.key, 1)}
                      disabled={index === docxFields.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                      title="下移"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={field.defaultIncluded}
                      onChange={(e) => updateDocxFieldConfig(field.key, { defaultIncluded: e.target.checked })}
                    />
                    新案件預設寫入 DOCX
                  </label>
                </div>
              ))}
            </div>
            <button onClick={applyDocxDefaults} disabled={isPacking} className="btn btn-ghost w-full !py-2 text-xs">
              套用預設到全部案件
            </button>
          </div>

          <div className="card-compact space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">ZIP 輸出預覽</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar text-xs text-gray-600 dark:text-gray-400">
              {zipPreviews.map((preview, index) => (
                <div key={preview.caseId} className="rounded border border-gray-200 dark:border-gray-700 p-2">
                  <p className="font-medium text-gray-700 dark:text-gray-300">案件 #{index + 1}：{preview.zipFileName}</p>
                  <p className="mt-1">└─ {preview.docxFileName}</p>
                  {preview.attachmentPaths.length > 0 ? preview.attachmentPaths.map(path => <p key={path}>└─ {path}</p>) : <p>└─ （無附件）</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="card-compact space-y-2">
            <h3 className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">輸出規則</h3>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <p>左側小卡可快速切換案件（Tabs 模式）。</p>
              <p>工单日期會從工单号自動提取前 8 碼（YYYYMMDD）。</p>
              <p>資料夾名稱：`司法机构-名称 + 工单日期 + 调证`。</p>
              <p>每案會下載一個 ZIP；DOCX 位於 ZIP 第一層，附件位於案件資料夾內。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
