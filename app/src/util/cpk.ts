import CPK, { OperationType } from 'contract-proxy-kit/lib/esm'
import multiSendAbi from 'contract-proxy-kit/lib/esm/abis/MultiSendAbi.json'
import EthersAdapter from 'contract-proxy-kit/lib/esm/ethLibAdapters/EthersAdapter'
import CpkTransactionManager from 'contract-proxy-kit/lib/esm/transactionManagers/CpkTransactionManager'
import { getHexDataLength, joinHexData } from 'contract-proxy-kit/lib/esm/utils/hexData'
import { ethers } from 'ethers'
import { Web3Provider } from 'ethers/providers'

import { proxyFactoryAbi } from '../abi/proxy_factory'
import { BiconomyService } from '../services/biconomy'
import { SafeService } from '../services/safe'

import { getCPKAddresses, getRelayProxyFactory } from './networks'

type Address = string

interface StandardTransaction {
  operation: OperationType
  to: Address
  value: string
  data: string
}

export interface Transaction {
  operation?: OperationType
  to: Address
  value?: string
  data?: string
}

interface TransactionResult {
  hash?: string
  safeTxHash?: string
}

const defaultTxOperation = OperationType.Call
const defaultTxValue = '0'
const defaultTxData = '0x'

function standardizeTransaction(tx: Transaction): StandardTransaction {
  return {
    operation: tx.operation ? tx.operation : defaultTxOperation,
    to: tx.to,
    value: tx.value ? tx.value.toString() : defaultTxValue,
    data: tx.data ? tx.data : defaultTxData,
  }
}

// Omen CPK monkey patch
// @ts-expect-error ignore
class OCPK extends CPK {
  transactionManager: any

  constructor(opts?: any) {
    super(opts)
    this.transactionManager = opts.transactionManager
  }

  async execTransactions(transactions: Transaction[], options?: any): Promise<TransactionResult> {
    if (!this.address) {
      throw new Error('CPK address uninitialized')
    }
    if (!this.contract) {
      throw new Error('CPK contract uninitialized')
    }
    if (!this.masterCopyAddress) {
      throw new Error('CPK masterCopyAddress uninitialized')
    }
    if (!this.fallbackHandlerAddress) {
      throw new Error('CPK fallbackHandlerAddress uninitialized')
    }
    if (!this.ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }
    if (!this.transactionManager) {
      throw new Error('CPK transactionManager uninitialized')
    }

    const ownerAccount = await this.getOwnerAccount()
    if (!ownerAccount) {
      throw new Error('CPK ownerAccount uninitialized')
    }

    const safeExecTxParams = this.getSafeExecTxParams(transactions)
    const sendOptions = { ...options, from: ownerAccount } // normalizeGasLimit({ ...options, from: ownerAccount })

    const codeAtAddress = await this.ethLibAdapter.getCode(this.address)
    const isDeployed = codeAtAddress !== '0x'

    const txManager = this.transactionManager

    const cpkContracts = {
      safeContract: this.contract,
      proxyFactory: this.proxyFactory,
      masterCopyAddress: this.masterCopyAddress,
      fallbackHandlerAddress: this.fallbackHandlerAddress,
    }

    return txManager.execTransactions({
      ownerAccount,
      safeExecTxParams,
      transactions,
      contracts: cpkContracts,
      ethLibAdapter: this.ethLibAdapter,
      isDeployed,
      isConnectedToSafe: this.isConnectedToSafe,
      sendOptions,
    })
  }

  private getSafeExecTxParams(transactions: Transaction[]): StandardTransaction {
    if (transactions.length === 1) {
      return standardizeTransaction(transactions[0])
    }

    if (!this.multiSend) {
      throw new Error('CPK MultiSend uninitialized')
    }

    return {
      to: this.multiSend.address,
      value: '0',
      data: this.encodeMultiSendCallData(transactions),
      operation: CPK.DelegateCall,
    }
  }

  encodeMultiSendCallData(transactions: Transaction[]): string {
    if (!this.ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }

    const multiSend = this.multiSend || this.ethLibAdapter.getContract(multiSendAbi)
    const standardizedTxs = transactions.map(standardizeTransaction)
    const ethLibAdapter = this.ethLibAdapter
    return multiSend.encode('multiSend', [
      joinHexData(
        standardizedTxs.map(tx =>
          ethLibAdapter.abiEncodePacked(
            { type: 'uint8', value: tx.operation },
            { type: 'address', value: tx.to },
            { type: 'uint256', value: tx.value },
            { type: 'uint256', value: getHexDataLength(tx.data) },
            { type: 'bytes', value: tx.data },
          ),
        ),
      ),
    ])
  }
}

export const zeroAddress = '0x0000000000000000000000000000000000000000'

class BiconomyTransactionManager {
  get config() {
    return {
      name: 'BiconomyTransactionManager',
    }
  }

  // @ts-expect-error ignore
  async execTransactions({ contracts, ethLibAdapter, isDeployed, ownerAccount, safeExecTxParams }) {
    // build params
    const proxyFactoryAddress = contracts.proxyFactory.address
    const proxyAddress = contracts.safeContract.address
    const masterCopyAddress = contracts.masterCopyAddress
    const { data, operation, to } = safeExecTxParams
    const value = '0'
    const safeTxGas = 0
    const dataGas = 0
    const gasPrice = 0
    const gasToken = zeroAddress
    const refundReceiver = zeroAddress
    const from = ownerAccount

    // get safe transaction nonce
    const safe = new SafeService(proxyAddress, ethLibAdapter.signer)
    const nonce = isDeployed ? await safe.getNonce() : 0

    // get safe transaction hash to sign
    const proxyFactory = new ethers.Contract(proxyFactoryAddress, proxyFactoryAbi, ethLibAdapter.signer)
    const txHash = await proxyFactory.getTransactionHash(
      proxyAddress,
      to,
      value,
      data,
      operation,
      safeTxGas,
      dataGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce,
    )

    // sign transaction hash
    const signature = await this.signTransactionHash(ethLibAdapter, txHash)

    // execute transaction through biconomy
    const biconomy = new BiconomyService()

    // if proxy is already deployed, exec tx directly, otherwise deploy proxy first
    if (isDeployed) {
      return biconomy.execTransaction({
        data,
        dataGas,
        from,
        gasPrice,
        gasToken,
        operation,
        proxyAddress,
        refundReceiver,
        safeTxGas,
        signature,
        to,
        value,
      })
    } else {
      // keccak256(toUtf8Bytes('Contract Proxy Kit'))
      const predeterminedSaltNonce = '0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65'
      return biconomy.createProxyAndExecTransaction({
        data,
        from,
        masterCopyAddress,
        operation,
        predeterminedSaltNonce,
        proxyFactoryAddress,
        signature,
        to,
        value,
      })
    }
  }

  private async signTransactionHash(ethLibAdapter: any, txHash: string) {
    const messageArray = ethers.utils.arrayify(txHash)
    // sign transaction with the real, underlying mainnet signer
    let sig = await ethLibAdapter.signer.signer.signMessage(messageArray)
    let sigV = parseInt(sig.slice(-2), 16)

    switch (sigV) {
      case 0:
      case 1:
        sigV += 31
        break
      case 27:
      case 28:
        sigV += 4
        break
      default:
        throw new Error('Invalid signature')
    }

    sig = sig.slice(0, -2) + sigV.toString(16)
    return sig
  }
}

export const createCPK = async (provider: Web3Provider, relay: boolean) => {
  const signer = provider.getSigner()
  const network = await provider.getNetwork()
  const cpkAddresses = getCPKAddresses(network.chainId)

  const networks = cpkAddresses
    ? {
        [network.chainId]: cpkAddresses,
      }
    : {}

  // update proxy factory if relay is enabled
  if (relay) {
    const relayProxyFactoryAddress = getRelayProxyFactory(network.chainId)
    if (relayProxyFactoryAddress) {
      networks[network.chainId].proxyFactoryAddress = relayProxyFactoryAddress
    }
  }

  const transactionManager = relay ? new BiconomyTransactionManager() : new CpkTransactionManager()
  const cpk = new OCPK({ ethLibAdapter: new EthersAdapter({ ethers, signer }), transactionManager, networks })
  await cpk.init()
  return cpk
}

export default OCPK
