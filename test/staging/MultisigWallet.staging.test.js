const { assert } = require("chai")
const { network, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { web3StringToBytes32 } = require("../../utils/web3StringToBytes")
require("dotenv").config()

const PRIVATE_KEY_2 = process.env.PRIVATE_KEY_2

developmentChains.includes(network.name)
    ? describe.skip
    : describe("MultisigWallet Staging Tests", function() {
          let deployer
          let multisigWallet

          const sendValue = ethers.utils.parseEther("0.01")

          const bytesTxData = web3StringToBytes32("")

          const txAddressToSend = "0x0e5Ba7643b84B12fa643F3169A3D221B3eC96491"

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              multisigWallet = await ethers.getContract(
                  "MultisigWallet",
                  deployer
              )
          })

          it("General scenario", async function() {
              // for test on real testnets we run general scenario
              // (disclaimer: it could take a while)
              // 1. Submit transaction
              const transactions = await multisigWallet.getTransactions()

              const txId = transactions.length

              let submitTxResponse = await multisigWallet.submitTx(
                  txAddressToSend,
                  sendValue,
                  bytesTxData
              )

              await submitTxResponse.wait(1)

              // 2. Sign transaction with min required signatures
              let signTxResponse = await multisigWallet.signTx(txId)

              await signTxResponse.wait(1)

              let secondSignatorySigner = new ethers.Wallet(
                  PRIVATE_KEY_2,
                  multisigWallet.provider
              )
              secondSignatorySigner = await multisigWallet.provider.getSigner(
                  secondSignatorySigner.address
              )
              const secondSignatoryConnectedContract = await multisigWallet.connect(
                  secondSignatorySigner
              )

              signTxResponse = await secondSignatoryConnectedContract.signTx(
                  txId
              )

              await signTxResponse.wait(1)

              // 3. Execute transaction

              let executeTxResponse = await multisigWallet.executeTx(txId)

              await executeTxResponse.wait(1)

              // check updated transaction data structure
              const transaction = await multisigWallet.getTransaction(txId)

              assert(transaction.executed)
          })
      })
