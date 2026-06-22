import { ExcelRow, CountryCount, AnalysisResult } from '../types'

export function filterDataByDate(data: ExcelRow[], startDate: string, endDate: string): ExcelRow[] {
  try {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const caseNumberKeys = ['申请编号', '申請編號', '申请編號', '申請编号']
    
    return data.filter((row) => {
      let caseNumber: string | null = null
      for (const key of caseNumberKeys) {
        if (row.hasOwnProperty(key) && row[key]) {
          caseNumber = String(row[key]).trim()
          break
        }
      }

      if (!caseNumber) return false

      let dateStr: string | null = null
      let date: Date | null = null

      const dateMatch = caseNumber.match(/^(\d{4})(\d{2})(\d{2})/)
      if (dateMatch) {
        const year = dateMatch[1]
        const month = dateMatch[2]
        const day = dateMatch[3]
        dateStr = `${year}-${month}-${day}`
        date = new Date(dateStr)
      } else {
        const standardDateMatch = caseNumber.match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
        if (standardDateMatch) {
          dateStr = `${standardDateMatch[1]}-${standardDateMatch[2]}-${standardDateMatch[3]}`
          date = new Date(dateStr)
        }
      }

      if (!date || isNaN(date.getTime())) return false

      return date >= start && date <= end
    })
  } catch (ex) {
    console.error("filterDataByDate => 發生錯誤:", ex)
    return []
  }
}

export function countCountries(data: ExcelRow[]): CountryCount {
  try {
    let countryCounter: CountryCount = {}

    const isCNKeys = ['司法机构-是否属于中国大陆', '司法機構-是否屬於中國大陸', '是否属于中国大陆', '是否屬於中國大陸']
    const countryKeys = ['司法机构-所在国家', '司法機構-所在國家', '所在国家', '所在國家']

    const normalizeChinaName = (name: string): string | null => {
      if (!name) return null
      const chinaVariants = ['中国大陆', '中國大陸', '中国', '中國', 'china', 'chinese mainland']
      const normalized = name.trim()
      for (const variant of chinaVariants) {
        if (normalized === variant || normalized.toLowerCase() === variant.toLowerCase()) {
          return '中國'
        }
      }
      return normalized
    }

    data.forEach((row) => {
      let isCN: any = null
      for (const key of isCNKeys) {
        if (row.hasOwnProperty(key)) {
          isCN = row[key]
          break
        }
      }

      let nat: any = null
      for (const key of countryKeys) {
        if (row.hasOwnProperty(key)) {
          nat = row[key]
          break
        }
      }

      if (isCN !== null && isCN !== undefined) {
        isCN = String(isCN).trim()
      }
      if (nat !== null && nat !== undefined) {
        nat = String(nat).trim()
      }

      let country: string | null = null

      if (isCN === '中国大陆' || isCN === '中國大陸' || isCN === '是' || isCN === 'Yes' || isCN === 'YES') {
        country = '中國'
      } else if ((isCN === '否' || isCN === 'No' || isCN === 'NO' || isCN === '') && nat && nat.length > 0) {
        let normalizedNat = nat.replace(/\s+/g, ' ').trim()
        country = normalizeChinaName(normalizedNat)
        if (!country) {
          country = normalizedNat.toLowerCase()
        }
      } else if ((!isCN || isCN === '') && nat && nat.length > 0) {
        let normalizedNat = nat.replace(/\s+/g, ' ').trim()
        country = normalizeChinaName(normalizedNat)
        if (!country) {
          country = normalizedNat.toLowerCase()
        }
      }

      if (country) {
        countryCounter[country] = (countryCounter[country] || 0) + 1
      }
    })

    return countryCounter
  } catch (ex) {
    console.error("countCountries => 發生錯誤:", ex)
    return {}
  }
}

export function calculateAnalysisResults(
  countA: CountryCount,
  countB: CountryCount
): AnalysisResult[] {
  const countries = new Set([...Object.keys(countA), ...Object.keys(countB)])
  const results: AnalysisResult[] = []

  countries.forEach(country => {
    const countAValue = countA[country] || 0
    const countBValue = countB[country] || 0
    let growthPercentage = 0

    if (countAValue > 0) {
      growthPercentage = ((countBValue - countAValue) / countAValue) * 100
    } else if (countBValue > 0) {
      growthPercentage = 100
    }

    results.push({
      country,
      countA: countAValue,
      countB: countBValue,
      growthPercentage
    })
  })

  return results
}

export function fixCountryName(country: string): string {
  const countryMap: Record<string, string> = {
    "USA": "美國",
    "美国": "美國",
    "中国大陆": "中國",
    "中國大陸": "中國",
    "中国": "中國",
    "中國": "中國",
    "中國臺灣": "台灣",
    "dubai": "杜拜",
  }
  return countryMap[country] || country
}

export function buildTopNRows(analysisResults: AnalysisResult[], topN: number): Array<[string, string]> {
  const countryCount: Record<string, number> = {}
  analysisResults.forEach(item => {
    const country = fixCountryName(item.country)
    if (item.countB > 0) {
      countryCount[country] = (countryCount[country] || 0) + item.countB
    }
  })

  const sortedCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1])

  const topNRows: Array<[string, string]> = []
  let currentRankValue = -1
  let rankGroups: string[] = []
  let outputRankCount = 0

  for (let i = 0; i < sortedCountries.length; i++) {
    const [country, count] = sortedCountries[i]

    if (currentRankValue !== count) {
      if (rankGroups.length > 0) {
        topNRows.push([`${currentRankValue}件`, rankGroups.join('、')])
        rankGroups = []
        outputRankCount++
      }
      if (outputRankCount >= topN) break
      currentRankValue = count
    }
    rankGroups.push(country)
  }

  if (rankGroups.length > 0 && outputRankCount < topN) {
    topNRows.push([`${currentRankValue}件`, rankGroups.join('、')])
  }

  return topNRows
}
