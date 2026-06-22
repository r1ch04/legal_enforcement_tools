import { Upload, BarChart3, Copy, FileText, TrendingUp, Calendar, AlertTriangle, Download } from 'lucide-react'
import { ExcelRow, AnalysisResult } from '../types'
import { filterDataByDate, countCountries, calculateAnalysisResults, fixCountryName, buildTopNRows } from '../utils/analysis'
import { parseAnalysisFileInWorker } from '../utils/xlsxWorkerClient'
import { useFeedback } from './FeedbackProvider'

let pdfDepsPromise: Promise<{
  jsPDF: (typeof import('jspdf'))['default']
  autoTable: (typeof import('jspdf-autotable'))['default']
}> | null = null
function loadPdfDeps() {
  pdfDepsPromise ??= Promise.all([import('jspdf'), import('jspdf-autotable')]).then(
    ([jspdfMod, autoTableMod]) => ({
      jsPDF: jspdfMod.default,
      autoTable: autoTableMod.default
    })
  )
  return pdfDepsPromise
}

interface AnalysisSectionProps {
  excelData: ExcelRow[]
  setExcelData: (value: ExcelRow[]) => void
  startDateA: string
  setStartDateA: (value: string) => void
  endDateA: string
  setEndDateA: (value: string) => void
  startDateB: string
  setStartDateB: (value: string) => void
  endDateB: string
  setEndDateB: (value: string) => void
  triggerPercentage: number
  setTriggerPercentage: (value: number) => void
  topN: number
  setTopN: (value: number) => void
  analysisResults: AnalysisResult[]
  setAnalysisResults: (value: AnalysisResult[]) => void
}

export default function AnalysisSection({
  excelData,
  setExcelData,
  startDateA,
  setStartDateA,
  endDateA,
  setEndDateA,
  startDateB,
  setStartDateB,
  endDateB,
  setEndDateB,
  triggerPercentage,
  setTriggerPercentage,
  topN,
  setTopN,
  analysisResults,
  setAnalysisResults
}: AnalysisSectionProps) {
  const { notify } = useFeedback()

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0]
    if (!file) return

    if (!file.name.includes('客服-执法请求跟进')) {
      notify('上傳失敗：檔案名稱必須包含「客服-执法请求跟进」', 'warning')
      return
    }

    parseAnalysisFileInWorker(file)
      .then(setExcelData)
      .catch((ex: Error) => {
        notify('解析檔案失敗：' + ex.message, 'error')
      })
  }

  const startAnalysis = () => {
    if (!excelData || excelData.length === 0) {
      notify('請先上傳 Excel 文件', 'warning')
      return
    }

    if (!startDateA || !endDateA || !startDateB || !endDateB) {
      notify('請選擇 A/B 區段的開始與結束日期', 'warning')
      return
    }

    if (new Date(startDateA) > new Date(endDateA)) {
      notify('A 區段開始日期不能晚於結束日期', 'warning')
      return
    }
    if (new Date(startDateB) > new Date(endDateB)) {
      notify('B 區段開始日期不能晚於結束日期', 'warning')
      return
    }

    const filteredDataA = filterDataByDate(excelData, startDateA, endDateA)
    const filteredDataB = filterDataByDate(excelData, startDateB, endDateB)

    if (filteredDataA.length === 0 && filteredDataB.length === 0) {
      notify('在指定日期範圍內未找到任何數據，請檢查日期範圍或 Excel 文件格式', 'warning')
    }

    const countryCountA = countCountries(filteredDataA)
    const countryCountB = countCountries(filteredDataB)

    const results = calculateAnalysisResults(countryCountA, countryCountB)
    setAnalysisResults(results)
  }

  const generateAndCopyExceedingReport = () => {
    const reportContent = analysisResults
      .filter(item => item.growthPercentage > 0)
      .map(item => ({
        ...item,
        fixedCountry: fixCountryName(item.country),
        formatted: `${fixCountryName(item.country)}：+${item.growthPercentage.toFixed(2)}% (上週${item.countA}件，本週${item.countB}件)`
      }))
      .sort((a, b) => b.growthPercentage - a.growthPercentage)

    const finalReport = reportContent.map(item => item.formatted).join('\n')

    navigator.clipboard.writeText(finalReport)
      .then(() => notify('超過增長百分比的統計結果已複製到剪貼簿', 'success'))
      .catch(err => notify('複製失敗：' + err, 'error'))
  }

  const generateAndCopyTopNReport = () => {
    const topNRows = buildTopNRows(analysisResults, topN)

    const reportText = topNRows.map(item => `${item[0]}：${item[1]}`).join('\n')
    navigator.clipboard.writeText(reportText)
      .then(() => notify(`前 ${topN} 名案件數量已複製到剪貼簿`, 'success'))
      .catch(err => notify('複製失敗：' + err, 'error'))
  }

  const exportPDFReport = async () => {
    try {
      const { jsPDF, autoTable } = await loadPdfDeps()
      const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4"
      })

      doc.setFontSize(20)
      doc.text("司法協助報告", 105, 15, { align: "center" })

      doc.setFontSize(12)
      let yPos = 25
      doc.text(`A 區段: ${startDateA} ~ ${endDateA}`, 105, yPos, { align: "center" })
      yPos += 7
      doc.text(`B 區段: ${startDateB} ~ ${endDateB}`, 105, yPos, { align: "center" })
      yPos += 10

      const topNRows = buildTopNRows(analysisResults, topN)

      doc.setFontSize(14)
      doc.text(`B 區段案件數排行前 ${topN} 名`, 105, yPos, { align: "center" })
      yPos += 6

      autoTable(doc, {
        head: [["案件數", "國家"]],
        body: topNRows,
        startY: yPos,
        margin: { left: 20, right: 20 },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10

      doc.setFontSize(14)
      doc.text(`案件數異常增量偵測 (閾值：${triggerPercentage}%)`, 105, yPos, { align: "center" })
      yPos += 6

      const reportContent = analysisResults
        .map(item => ({
          country: fixCountryName(item.country),
          aCount: item.countA,
          bCount: item.countB,
          growthPercentage: item.growthPercentage
        }))
        .sort((a, b) => b.growthPercentage - a.growthPercentage)

      autoTable(doc, {
        head: [["國家", "A 區段案件數", "B 區段案件數", "增長百分比"]],
        body: reportContent.map(item => [
          item.country,
          `${item.aCount}`,
          `${item.bCount}`,
          `${item.growthPercentage.toFixed(2)}%`
        ]),
        startY: yPos,
        margin: { left: 20, right: 20 },
        didParseCell: function(data: any) {
          if (data.section === 'body' && data.column.index === 3) {
            let rawVal = data.cell.raw
            let numericVal = parseFloat(rawVal.replace('%', ''))
            if (!isNaN(numericVal) && numericVal >= triggerPercentage) {
              Object.values(data.row.cells).forEach((cell: any) => {
                cell.styles.fillColor = [255, 200, 200]
              })
            }
          }
        }
      })

      const fileName = `${startDateB.replace(/-/g, '')}_${endDateB.replace(/-/g, '')}_report.pdf`
      doc.save(fileName)
    } catch (ex: any) {
      console.error("exportPDFReport => 產生PDF失敗:", ex)
      notify("匯出 PDF 時發生錯誤: " + ex.message, 'error')
    }
  }

  const exceedingCount = analysisResults.filter(r => r.growthPercentage >= triggerPercentage).length

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <h1 className="section-title">案件數據分析</h1>
        {analysisResults.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3">
            {exceedingCount > 0 && (
              <div className="stat-card border-red-200 dark:border-red-800">
                <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{exceedingCount}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">異常增長</div>
              </div>
            )}
            <div className="stat-card">
              <div className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-300">{analysisResults.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">國家數</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        {/* 上傳數據文件 - 左邊 */}
        <div className="card flex flex-col">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <Upload className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold">上傳數據文件</h2>
          </div>
          
          <div className="mb-3 flex-shrink-0">
            <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
              選擇 XLSX 文件
            </label>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileUpload}
              className="input py-1.5 text-sm"
            />
            {excelData.length > 0 && (
              <div className="mt-1.5 text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                已載入 {excelData.length} 筆
              </div>
            )}
          </div>
        </div>

        {/* 時間區段設定 - 中間 */}
        <div className="card flex flex-col">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <Calendar className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold">時間區段設定</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                A 開始
              </label>
              <input
                type="date"
                className="input py-1.5 text-sm"
                value={startDateA}
                onChange={(e) => setStartDateA(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                A 結束
              </label>
              <input
                type="date"
                className="input py-1.5 text-sm"
                value={endDateA}
                onChange={(e) => setEndDateA(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                B 開始
              </label>
              <input
                type="date"
                className="input py-1.5 text-sm"
                value={startDateB}
                onChange={(e) => setStartDateB(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                B 結束
              </label>
              <input
                type="date"
                className="input py-1.5 text-sm"
                value={endDateB}
                onChange={(e) => setEndDateB(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-3 flex-shrink-0">
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
              異常增長觸發百分比
            </label>
            <input
              type="number"
              className="input py-1.5 text-sm"
              min="0"
              max="100"
              step="1"
              value={triggerPercentage}
              onChange={(e) => setTriggerPercentage(parseFloat(e.target.value))}
            />
          </div>

          <button
            onClick={startAnalysis}
            disabled={excelData.length === 0}
            className="btn btn-primary w-full flex items-center justify-center gap-2 py-1.5 text-sm mt-auto flex-shrink-0"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            開始分析
          </button>
        </div>

        {/* 快捷操作 - 右邊 */}
        <div className="card flex flex-col">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300 flex-shrink-0">快捷操作</h3>
          <div className="space-y-2 flex-shrink-0">
            <button
              onClick={generateAndCopyExceedingReport}
              className="quick-action w-full justify-start text-xs py-1.5"
              disabled={exceedingCount === 0}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              複製異常增長
            </button>
            <button
              onClick={exportPDFReport}
              className="quick-action w-full justify-start text-xs py-1.5"
              disabled={analysisResults.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              匯出 PDF
            </button>
          </div>
          
          {/* 前 N 名統計 */}
          <div className="mt-auto pt-3 border-t border-gray-200/50 dark:border-gray-700/50 flex-shrink-0">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">前 N 名統計</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">前</label>
                <input
                  type="number"
                  className="input w-full py-1.5 text-sm"
                  min="1"
                  value={topN}
                  onChange={(e) => setTopN(parseInt(e.target.value) || 5)}
                />
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">名</label>
              </div>
              <button
                onClick={generateAndCopyTopNReport}
                className="btn btn-info w-full flex items-center justify-center gap-2 py-1.5 text-sm"
                disabled={analysisResults.length === 0}
              >
                <Copy className="w-3.5 h-3.5" />
                複製前 {topN} 名
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 分析結果 */}
      {analysisResults.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              分析結果
            </h3>
            {exceedingCount > 0 && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">{exceedingCount} 個異常</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 custom-scrollbar">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="table min-w-full">
                <thead>
                  <tr>
                    <th className="min-w-[80px]">国家</th>
                    <th className="min-w-[100px]">A 區段案件數</th>
                    <th className="min-w-[100px]">B 區段案件數</th>
                    <th className="min-w-[100px]">增長百分比</th>
                  </tr>
                </thead>
              <tbody>
                {analysisResults.map((result, index) => (
                  <tr
                    key={index}
                    className={result.growthPercentage >= triggerPercentage 
                      ? 'bg-red-100/50 dark:bg-red-900/20 border-l-4 border-red-500' 
                      : ''}
                  >
                    <td className="font-medium">{result.country}</td>
                    <td>{result.countA}</td>
                    <td className="font-semibold">{result.countB}</td>
                    <td>
                      <span className={`font-semibold ${
                        result.growthPercentage >= triggerPercentage 
                          ? 'text-red-600 dark:text-red-400' 
                          : result.growthPercentage > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {result.growthPercentage >= 0 ? '+' : ''}{result.growthPercentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {analysisResults.length === 0 && excelData.length === 0 && (
        <div className="card text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">上傳文件並設定時間區段後開始分析</p>
        </div>
      )}
    </div>
  )
}
