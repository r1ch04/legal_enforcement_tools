import { useState, useEffect } from 'react'
import { Plus, Save, Upload, Copy, Trash2, Layers, FileText, Zap } from 'lucide-react'
import { InfoItem, InfoType } from '../types'
import { detectInfoType } from '../utils/validations'
import { useFeedback } from './FeedbackProvider'

let xlsxModulePromise: Promise<typeof import('xlsx')> | null = null
function loadXlsx() {
  xlsxModulePromise ??= import('xlsx')
  return xlsxModulePromise
}

interface InputSectionProps {
  caseNumber: string
  setCaseNumber: (value: string) => void
  infoType: InfoType
  setInfoType: (value: InfoType) => void
  infoDetail: string
  setInfoDetail: (value: string) => void
  phonePrefix: string
  setPhonePrefix: (value: string) => void
  bulkInput: string
  setBulkInput: (value: string) => void
  infoList: InfoItem[]
  setInfoList: (value: InfoItem[] | ((prev: InfoItem[]) => InfoItem[])) => void
  showSuccess: boolean
  setShowSuccess: (value: boolean) => void
}

export default function InputSection({
  caseNumber,
  setCaseNumber,
  infoType,
  setInfoType,
  infoDetail,
  setInfoDetail,
  phonePrefix,
  setPhonePrefix,
  bulkInput,
  setBulkInput,
  infoList,
  setInfoList,
  showSuccess,
  setShowSuccess
}: InputSectionProps) {
  const infoTypeOptions: InfoType[] = [
    '充值地址',
    'TXID',
    'UID',
    '银行卡号',
    '证件号码',
    '手机号码',
    '邮箱地址'
  ]

  const [showPhonePrefix, setShowPhonePrefix] = useState(false)
  const [invalidBatchItems, setInvalidBatchItems] = useState<string[]>([])
  const { notify, confirm } = useFeedback()

  useEffect(() => {
    setShowPhonePrefix(infoType === '手机号码')
  }, [infoType])

  const saveFile = async () => {
    if (!caseNumber.trim()) {
      notify('请先输入案号', 'warning')
      return
    }

    if (infoList.length === 0) {
      notify('没有要保存的信息', 'warning')
      return
    }

    const XLSX = await loadXlsx()
    const workbook = XLSX.utils.book_new()
    const worksheetData = [['信息类型', '调证信息详情']]
    
    infoList.forEach(item => {
      worksheetData.push([item.type, item.detail])
    })

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, '调证信息')
    XLSX.writeFile(workbook, `调证信息文件${caseNumber}.xlsx`)

    // 重置表單
    setCaseNumber('')
    setInfoList([])
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  // 全局 Ctrl+S 快捷键
  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        await saveFile()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [caseNumber, infoList, setCaseNumber, setInfoList, setShowSuccess])

  const handleSingleInput = () => {
    if (!infoDetail.trim()) {
      notify('信息内容不能为空', 'warning')
      return
    }

    let finalDetail = infoDetail.trim()
    
    if (infoType === '手机号码' && phonePrefix) {
      finalDetail = `${phonePrefix}-${finalDetail}`
    }

    const newItem: InfoItem = {
      id: Date.now().toString(),
      type: infoType,
      detail: finalDetail
    }

    setInfoList(prev => [...prev, newItem])
    setInfoDetail('')
  }

  const handleBulkInput = () => {
    if (!bulkInput.trim()) {
      notify('批量信息不能为空', 'warning')
      return
    }

    const lines = bulkInput.split('\n')
    const newItems: InfoItem[] = []
    const invalidItems: string[] = []
    let invalidCount = 0

    lines.forEach(line => {
      const detail = line.replace(/["'\s]/g, '')
      if (!detail) return

      const detectedType = detectInfoType(detail)
      if (detectedType) {
        newItems.push({
          id: Date.now().toString() + Math.random(),
          type: detectedType,
          detail
        })
      } else {
        invalidItems.push(detail)
        invalidCount += 1
      }
    })

    setInfoList(prev => [...prev, ...newItems])
    setBulkInput('')
    setInvalidBatchItems(Array.from(new Set(invalidItems)))
    if (invalidCount > 0) {
      notify(`有 ${invalidCount} 筆無效地址或 TXID 已略過，可使用下方「查詢」逐筆確認`, 'warning')
    }
  }

  const openOkLinkSearch = (key: string) => {
    const query = key.trim()
    if (!query) {
      notify('查詢內容不可為空', 'warning')
      return
    }
    const url = `https://www.oklink.com/zh-hant/multi-search#key=${encodeURIComponent(query)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const removeItem = (id: string) => {
    setInfoList(prev => prev.filter(item => item.id !== id))
  }

  const updateInfoItem = (id: string, patch: Partial<InfoItem>) => {
    setInfoList(prev =>
      prev.map(item => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const importFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const XLSX = await loadXlsx()
          const data = new Uint8Array((e.target?.result as ArrayBuffer) || new ArrayBuffer(0))
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(firstSheet) as any[]

          const importedItems: InfoItem[] = rows.map((row, index) => ({
            id: Date.now().toString() + index,
            type: row['信息类型'] || '',
            detail: row['调证信息详情'] || ''
          }))

          setInfoList(importedItems)
          
          const caseNumberFromFile = file.name.replace(/^调证信息文件|\.xlsx$/g, '')
          setCaseNumber(caseNumberFromFile)
        } catch (error) {
          notify('導入文件失敗: ' + (error as Error).message, 'error')
        }
      }
      reader.readAsArrayBuffer(file)
    }
    input.click()
  }

  const copyAllData = () => {
    if (infoList.length === 0) {
      notify('沒有可複製的資料', 'warning')
      return
    }

    const text = infoList.map(item => `${item.type}：${item.detail}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      notify('所有資料已複製到剪貼簿', 'success')
    }).catch(err => {
      console.error('複製失敗', err)
      notify('複製失敗，請稍後重試', 'error')
    })
  }

  const deleteAllData = async () => {
    const confirmed = await confirm({
      title: '刪除全部資料',
      message: '確定要刪除全部資料嗎？此操作無法復原。',
      confirmText: '刪除'
    })
    if (confirmed) {
      setInfoList([])
      notify('已清空資料', 'success')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      void saveFile()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSingleInput()
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <h1 className="section-title">調證信息錄入</h1>

      {showSuccess && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 
                      glass-strong px-6 py-4 rounded-2xl shadow-2xl z-50
                      flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-medium text-gray-900 dark:text-white">文件保存成功！</span>
        </div>
      )}

      {/* 快速操作區 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* 主要輸入區 */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <div className="card flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold">快速錄入</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                  案號
                </label>
                <input
                  type="text"
                  className="input py-1.5 text-sm"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="輸入案號"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                  信息類型
                </label>
                <select
                  className="input py-1.5 text-sm"
                  value={infoType}
                  onChange={(e) => setInfoType(e.target.value as InfoType)}
                >
                  <option value="充值地址">充值地址</option>
                  <option value="TXID">TXID</option>
                  <option value="UID">UID</option>
                  <option value="银行卡号">银行卡号</option>
                  <option value="证件号码">证件号码</option>
                  <option value="手机号码">手机号码</option>
                  <option value="邮箱地址">邮箱地址</option>
                </select>
              </div>
            </div>

            {showPhonePrefix && (
              <div className="mt-2">
                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                  電話區碼
                </label>
                <input
                  type="text"
                  className="input py-1.5 text-sm"
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  placeholder="例如：886"
                />
              </div>
            )}

            <div className="mt-2">
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                信息內容 <span className="text-xs text-gray-400">(Enter 添加，Ctrl+S 保存)</span>
              </label>
              <input
                type="text"
                className="input py-1.5 text-sm"
                value={infoDetail}
                onChange={(e) => setInfoDetail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="輸入信息內容"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSingleInput}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 py-1.5 text-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                添加
              </button>
              <button
                onClick={() => void saveFile()}
                className="btn btn-success flex items-center justify-center gap-2 px-4 py-1.5 text-sm"
              >
                <Save className="w-3.5 h-3.5" />
                保存
              </button>
            </div>
          </div>

          {/* 批量輸入 */}
          <div className="card flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <Layers className="w-4 h-4 text-purple-500" />
              <h2 className="text-base font-semibold">批量新增</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">(僅支持地址與TXID)</span>
            </div>
            <textarea
              className="input flex-1 min-h-0 custom-scrollbar text-sm"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="每行一条信息"
            />
            <button
              onClick={handleBulkInput}
              className="btn btn-secondary mt-3 flex items-center gap-2 w-full justify-center py-2 text-sm flex-shrink-0"
            >
              <Layers className="w-4 h-4" />
              批量新增
            </button>

            {invalidBatchItems.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300/40 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-900/10 p-3">
                <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
                  本次無效項（{invalidBatchItems.length}）可直接查詢
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                  {invalidBatchItems.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1.5 truncate" title={item}>
                        {item}
                      </code>
                      <button
                        type="button"
                        onClick={() => openOkLinkSearch(item)}
                        className="btn btn-ghost !px-2.5 !py-1 text-xs whitespace-nowrap"
                        title="前往 OKLink 查詢"
                      >
                        查詢
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 快捷操作面板 */}
        <div className="flex flex-col h-full">
          <div className="card-compact mb-4 flex-shrink-0">
            <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">快捷操作</h3>
            <div className="space-y-2">
              <button 
                onClick={importFile} 
                className="quick-action w-full justify-start"
              >
                <Upload className="w-4 h-4" />
                導入文件
              </button>
              <button 
                onClick={copyAllData} 
                className="quick-action w-full justify-start"
                disabled={infoList.length === 0}
              >
                <Copy className="w-4 h-4" />
                複製全部
              </button>
              <button 
                onClick={() => void deleteAllData()} 
                className="quick-action w-full justify-start text-red-600 dark:text-red-400"
                disabled={infoList.length === 0}
              >
                <Trash2 className="w-4 h-4" />
                清空全部
              </button>
            </div>
          </div>

          {/* 統計信息區 */}
          <div className="card flex-1 min-h-0">
            <h3 className="text-xs font-semibold mb-3 text-gray-700 dark:text-gray-300">統計信息</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600 dark:text-gray-400">總筆數</span>
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{infoList.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600 dark:text-gray-400">案號</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={caseNumber}>
                  {caseNumber || '未設定'}
                </span>
              </div>
              
              {/* 信息類型統計 */}
              <div className="pt-2.5 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">信息類型分布</div>
                <div className="space-y-1.5">
                  {(() => {
                    // 定義所有7種類型
                    const allTypes = infoTypeOptions
                    
                    // 初始化所有類型為0
                    const typeCount: Record<string, number> = {}
                    allTypes.forEach(type => {
                      typeCount[type] = 0
                    })
                    
                    // 統計實際數據
                    infoList.forEach(item => {
                      if (typeCount.hasOwnProperty(item.type)) {
                        typeCount[item.type] = (typeCount[item.type] || 0) + 1
                      }
                    })
                    
                    // 按數量排序，數量相同時按原始順序
                    return Object.entries(typeCount)
                      .sort((a, b) => {
                        if (b[1] !== a[1]) {
                          return b[1] - a[1] // 先按數量降序
                        }
                        // 數量相同時保持原始順序
                        return allTypes.indexOf(a[0] as InfoType) - allTypes.indexOf(b[0] as InfoType)
                      })
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{type}</span>
                          <span className={`text-sm font-semibold ml-2 ${
                            count > 0 
                              ? 'text-slate-700 dark:text-slate-300' 
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {count}
                          </span>
                        </div>
                      ))
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 資料列表 */}
      {infoList.length > 0 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
              已錄入的信息
            </h3>
            <span className="badge">{infoList.length} 筆</span>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 custom-scrollbar">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="table min-w-full">
                <thead>
                  <tr>
                    <th className="w-12 sm:w-14">#</th>
                    <th className="w-20 sm:w-24">操作</th>
                    <th className="w-32 sm:w-40">信息类型</th>
                    <th>调证信息详情</th>
                  </tr>
                </thead>
              <tbody>
                {infoList.map((item, index) => (
                  <tr key={item.id}>
                    <td className="text-center text-xs text-gray-500 dark:text-gray-400">
                      {index + 1}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="btn btn-danger text-xs py-1 px-3"
                        >
                          刪除
                        </button>
                        {(item.type === '充值地址' || item.type === 'TXID') && (
                          <button
                            type="button"
                            onClick={() => openOkLinkSearch(item.detail)}
                            className="btn btn-ghost text-xs py-1 px-3"
                            title="前往 OKLink 查詢"
                          >
                            查詢
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <select
                        className="input py-1 text-sm min-w-[120px]"
                        value={item.type}
                        onChange={(e) => updateInfoItem(item.id, { type: e.target.value as InfoType })}
                      >
                        {infoTypeOptions.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input py-1 text-sm font-mono w-full min-w-[240px]"
                        value={item.detail}
                        onChange={(e) => updateInfoItem(item.id, { detail: e.target.value })}
                        placeholder="輸入調證信息詳情"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {infoList.length === 0 && (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">尚無資料，請開始錄入</p>
        </div>
      )}
    </div>
  )
}
