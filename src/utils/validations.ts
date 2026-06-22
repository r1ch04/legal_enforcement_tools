// validations.ts - 驗證函數

// ====================
// BTC 地址與 TxID 驗證
// ====================
export function isValidBTCAddress(address: string): boolean {
	const legacyPattern			= /^[1][a-km-zA-HJ-NP-Z1-9]{24,33}$/;
	const nestedSegwitPattern	= /^[3][a-km-zA-HJ-NP-Z1-9]{24,33}$/;
	const nativeSegwitPattern	= /^bc1q[a-z0-9]{8,87}$/;
	const taprootPattern		= /^bc1p[a-z0-9]{8,87}$/;
	const lowerAddress			= address.toLowerCase();
	
	return (
		legacyPattern.test(address) ||
		nestedSegwitPattern.test(address) ||
		nativeSegwitPattern.test(lowerAddress) ||
		taprootPattern.test(lowerAddress)
	);
}

export function isValidBTCTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// EVM 地址與 TxID 驗證
// ====================
export function isValidEVMAddress(address: string): boolean {
	const evmPattern = /^0x[a-fA-F0-9]{40}$/;
	return evmPattern.test(address);
}

export function isValidEVMTxID(txid: string): boolean {
	const evmTxPattern = /^0x[a-fA-F0-9]{64}$/;
	return evmTxPattern.test(txid);
}

// ====================
// LTC 地址與 TxID 驗證
// ====================
export function isValidLTCAddress(address: string): boolean {
	const p2pkhPattern	= /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/;
	const bech32Pattern	= /^ltc1[a-zA-HJ-NP-Z0-9]{39,59}$/;
	return p2pkhPattern.test(address) || bech32Pattern.test(address);
}

export function isValidLTCTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// TRON 地址與 TxID 驗證
// ====================
export function isValidTRONAddress(address: string): boolean {
	const tronPattern = /^T[a-zA-Z0-9]{33}$/;
	return tronPattern.test(address);
}

export function isValidTRONTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// SOL 地址與 TxID 驗證
// ====================
export function isValidSOLAddress(address: string): boolean {
	const solPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
	return solPattern.test(address);
}

export function isValidSOLTxID(txid: string): boolean {
	return /^[A-Za-z0-9]{87,88}$/.test(txid);
}

// ====================
// XMR 地址與 TxID 驗證
// ====================
export function isValidXMRAddress(address: string): boolean {
	const standardPattern	= /^[48][0-9A-Za-z]{94}$/;
	const integratedPattern	= /^[48][0-9A-Za-z]{105}$/;
	return standardPattern.test(address) || integratedPattern.test(address);
}

export function isValidXMRTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// Kaspa 地址與 TxID 驗證
// ====================
export function isValidKaspaAddress(address: string): boolean {
	const lowerAddr		= address.toLowerCase();
	const kaspaPattern	= /^kaspa:[a-z0-9]{50,}$/;
	return kaspaPattern.test(lowerAddr);
}

export function isValidKaspaTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// Sui 地址與 TxID 驗證
// ====================
export function isValidSuiAddress(address: string): boolean {
	const suiPattern = /^0x[a-fA-F0-9]{64}$/;
	return suiPattern.test(address);
}

export function isValidSuiTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// Aptos 地址與 TxID 驗證
// ====================
export function isValidAptosAddress(address: string): boolean {
	const aptosPattern = /^0x[a-fA-F0-9]{1,64}$/;
	return aptosPattern.test(address);
}

export function isValidAptosTxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// ADA 地址與 TxID 驗證
// ====================
export function isValidADAAddress(address: string): boolean {
	const shelleyPattern	= /^addr1[0-9a-z]{50,120}$/;
	const byronPattern		= /^DdzFF[1-9A-HJ-NP-Za-km-z]{50,}$/;
	return shelleyPattern.test(address) || byronPattern.test(address);
}

export function isValidADATxID(txid: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(txid);
}

// ====================
// 統合驗證：依據 infoType 來檢查 infoDetail
// ====================
export function isValidInfo(infoType: string, infoDetail: string): boolean {
	switch (infoType) {
		case "充值地址":
			return (
				isValidBTCAddress(infoDetail) ||
				isValidEVMAddress(infoDetail) ||
				isValidLTCAddress(infoDetail) ||
				isValidTRONAddress(infoDetail) ||
				isValidSOLAddress(infoDetail) ||
				isValidXMRAddress(infoDetail) ||
				isValidKaspaAddress(infoDetail) ||
				isValidSuiAddress(infoDetail) ||
				isValidAptosAddress(infoDetail) ||
				isValidADAAddress(infoDetail)
			);
		case "TXID":
			return (
				isValidBTCTxID(infoDetail) ||
				isValidEVMTxID(infoDetail) ||
				isValidLTCTxID(infoDetail) ||
				isValidTRONTxID(infoDetail) ||
				isValidSOLTxID(infoDetail) ||
				isValidXMRTxID(infoDetail) ||
				isValidKaspaTxID(infoDetail) ||
				isValidSuiTxID(infoDetail) ||
				isValidAptosTxID(infoDetail) ||
				isValidADATxID(infoDetail)
			);
		default:
			return true;
	}
}

// 檢測信息類型
export function detectInfoType(infoDetail: string): string | null {
	// 先檢查 TXID 格式
	if (
		isValidBTCTxID(infoDetail) ||
		isValidEVMTxID(infoDetail) ||
		isValidLTCTxID(infoDetail) ||
		isValidTRONTxID(infoDetail) ||
		isValidSOLTxID(infoDetail) ||
		isValidXMRTxID(infoDetail) ||
		isValidKaspaTxID(infoDetail) ||
		isValidSuiTxID(infoDetail) ||
		isValidAptosTxID(infoDetail) ||
		isValidADATxID(infoDetail)
	) {
		return "TXID";
	}
	// 再檢查地址格式
	if (
		isValidBTCAddress(infoDetail) ||
		isValidEVMAddress(infoDetail) ||
		isValidLTCAddress(infoDetail) ||
		isValidTRONAddress(infoDetail) ||
		isValidSOLAddress(infoDetail) ||
		isValidXMRAddress(infoDetail) ||
		isValidKaspaAddress(infoDetail) ||
		isValidSuiAddress(infoDetail) ||
		isValidAptosAddress(infoDetail) ||
		isValidADAAddress(infoDetail)
	) {
		return "充值地址";
	}
	return null;
}
