  // Oracles for the current gas prices (mainnet)
  const url = "https://www.etherchain.org/api/gasPriceOracle";
  const backupUrl = "https://api.etherscan.io/api?module=gastracker&action=gasoracle";

const _getGasPrice = async () => {
	try {
	  const response = await fetch(url);
	  const json = await response.json();
	  if (json.fast) {
		let price = json.fast;
		return price;
	  } else {
		console.error("First URL failed (invalid response)\nTrying back up...");
	  }
	} catch (error) {
	  // Try backup API.
	  try {
		const responseBackup = await fetch(backupUrl);
		const jsonBackup = await responseBackup.json();
		if (jsonBackup.result && jsonBackup.result.SafeGasPrice) {
		  return jsonBackup.result.SafeGasPrice;
		} else {
		  throw new Error("Etherscan API: bad json response");
		}
	  } catch (errorBackup) {
		throw new Error("Error receiving Gas price - back up failed");
	  }
	}
};

module.exports = { _getGasPrice }