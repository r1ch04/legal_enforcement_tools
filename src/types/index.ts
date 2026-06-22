// 類型定義

export interface InfoItem {
  id: string;
  type: string;
  detail: string;
}

export interface MergedResultItem {
  uid: string;
  type: string;
  info: string;
}

export interface ExcelRow {
  [key: string]: any;
}

export interface CountryCount {
  [country: string]: number;
}

export interface AnalysisResult {
  country: string;
  countA: number;
  countB: number;
  growthPercentage: number;
}

export interface CasePackItem {
  id: string;
  workOrderNo: string;
  agencyEmail: string;
  agencyName: string;
  agencyPhone: string;
  documentNumber: string;
  uploadedFiles: File[];
}

export type InfoType = 
  | "充值地址"
  | "TXID"
  | "UID"
  | "银行卡号"
  | "证件号码"
  | "手机号码"
  | "邮箱地址";
