const { assert, expect } = require("chai")
const { deployments, ethers } = require("hardhat")

const { developmentChains } = require("../../helper-hardhat-config")

const { web3StringToBytes32 } = require("../../utils/web3StringToBytes")

const { constants } = require("@openzeppelin/test-helpers")

!developmentChains.includes(network.name)
    ? describe.skip()
    : describe("MultisigWallet", function() {
          let multisigWallet
          let deployer
          let minSigAmount
          let initialAddressSet = []
          let accounts

          const sendValue = ethers.utils.parseEther("0.01")
          const bytesTxData = web3StringToBytes32("")
          //        "11111111111111111111111111111111"
          //  )

          const txAddressToSend = "0x0e5Ba7643b84B12fa643F3169A3D221B3eC96491"

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              multisigWallet = await ethers.getContract(
                  "MultisigWallet",
                  deployer
              )

              minSigAmount = 2

              accounts = await ethers.getSigners()
              for (let i = 0; i < 3; i++) {
                  initialAddressSet.push(accounts[i].address)
              }
          })

          describe("Constructor", function() {
              it("Check initial deploy (3 addresses, min 2 required to execute tx)", async function() {
                  const requiredSignatures = await multisigWallet.getRequiredSignatories()
                  assert.equal(requiredSignatures.toString(), minSigAmount)
                  const initialSignatories = await multisigWallet.getSignatories()
                  assert.equal(
                      initialAddressSet.toString(),
                      initialSignatories.toString()
                  )
              })
          })

          describe("SubmitTx", async function() {
              it("Only signatory allows to submit tx", async function() {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.submitTx(
                          txAddressToSend,
                          sendValue,
                          bytesTxData
                      )
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              it("Should update transactions array when submit tx", async function() {
                  const transactionResponse = await multisigWallet.submitTx(
                      txAddressToSend,
                      sendValue,
                      bytesTxData
                  )

                  const transactions = await multisigWallet.getTransactions()

                  assert.equal(transactions.length, 1)
              })
          })

          describe("SignTx", async function() {
              beforeEach(async function() {
                  await multisigWallet.submitTx(
                      txAddressToSend,
                      sendValue,
                      bytesTxData
                  )
              })

              it("Only signatory allows to sign tx", async function() {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.signTx(0)
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              it("Transaction should exist before signing", async function() {
                  await expect(multisigWallet.signTx(1)).to.be.revertedWith(
                      "MultisigWallet__NotValidTxId"
                  )
              })

              it("Transaction could be signed only once", async function() {
                  await multisigWallet.signTx(0)

                  await expect(multisigWallet.signTx(0)).to.be.revertedWith(
                      "MultisigWallet__TxAlreadySigned"
                  )
              })

              it("Cannot sign already executed tx", async function() {
                  await multisigWallet.signTx(0)

                  const secondSignatorySigner = multisigWallet.provider.getSigner(
                      initialAddressSet[1]
                  )
                  const secondSignatoryConnectedContract = await multisigWallet.connect(
                      secondSignatorySigner
                  )

                  await secondSignatoryConnectedContract.signTx(0)

                  await multisigWallet.executeTx(0)

                  await expect(multisigWallet.signTx(0)).to.be.reverted
              })
          })

          describe("executeTx", async function() {
              beforeEach(async function() {
                  await multisigWallet.submitTx(
                      txAddressToSend,
                      sendValue,
                      bytesTxData
                  )

                  await multisigWallet.signTx(0)
              })

              it("Should fail if not enough signatures", async function() {
                  await expect(multisigWallet.executeTx(0)).to.be.reverted
              })

              it("Should success if there are enough signatures", async function() {
                  const secondSignatorySigner = multisigWallet.provider.getSigner(
                      initialAddressSet[1]
                  )
                  const secondSignatoryConnectedContract = await multisigWallet.connect(
                      secondSignatorySigner
                  )

                  await secondSignatoryConnectedContract.signTx(0)

                  await expect(multisigWallet.executeTx(0)).not.to.be.reverted

                  const executedTx = await multisigWallet.getTransaction(0)

                  assert(executedTx.executed)
              })

              it("Should revert if tx already executed", async function() {
                  const secondSignatorySigner = multisigWallet.provider.getSigner(
                      initialAddressSet[1]
                  )
                  const secondSignatoryConnectedContract = await multisigWallet.connect(
                      secondSignatorySigner
                  )

                  await secondSignatoryConnectedContract.signTx(0)

                  await multisigWallet.executeTx(0)
                  await expect(multisigWallet.executeTx(0)).to.be.revertedWith(
                      "MultisigWallet__TxAlreadyExecuted"
                  )
              })

              it("Only signatory allows to execute tx", async function() {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.executeTx(0)
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              it("Only allows to execute existing tx", async function() {
                  await expect(multisigWallet.executeTx(1)).to.be.revertedWith(
                      "MultisigWallet__NotValidTxId"
                  )
              })
          })

          describe("revokeTx", async function() {
              let secondSignatoryConnectedContract, secondSignatorySigner
              beforeEach(async function() {
                  await multisigWallet.submitTx(
                      txAddressToSend,
                      sendValue,
                      bytesTxData
                  )

                  await multisigWallet.signTx(0)

                  secondSignatorySigner = await multisigWallet.provider.getSigner(
                      initialAddressSet[1]
                  )
                  secondSignatoryConnectedContract = await multisigWallet.connect(
                      secondSignatorySigner
                  )

                  await secondSignatoryConnectedContract.signTx(0)
              })

              it("Only signatory that signed tx allows to revoke his signature", async function() {
                  const attackerSignatory = multisigWallet.provider.getSigner(
                      initialAddressSet[2]
                  )
                  const attackerSignatoryConnectedContract = await multisigWallet.connect(
                      attackerSignatory
                  )

                  await expect(attackerSignatoryConnectedContract.revokeTx(0))
                      .to.be.reverted
              })

              it("Only allows to revoke existing tx", async function() {
                  await expect(multisigWallet.revokeTx(1)).to.be.revertedWith(
                      "MultisigWallet__NotValidTxId"
                  )
              })

              it("Should only revoke tx not executed", async function() {
                  await multisigWallet.executeTx(0)

                  await expect(multisigWallet.revokeTx(0)).to.be.revertedWith(
                      "MultisigWallet__TxAlreadyExecuted"
                  )
              })

              it("Update signedTxByAddress after tx revoke", async function() {
                  await secondSignatoryConnectedContract.revokeTx(0)

                  const isSignedAfterRevoke = await multisigWallet.isSignedTxByAddress(
                      initialAddressSet[1],
                      0
                  )

                  assert(!isSignedAfterRevoke)
              })

              it("Update numOfApprovals after tx revoke", async function() {
                  const tx = await multisigWallet.getTransaction(0)
                  const startingApprovalsNumber = tx.numOfApprovals

                  await secondSignatoryConnectedContract.revokeTx(0)

                  const tx_revoked = await multisigWallet.getTransaction(0)
                  const endingApprovalsNumber = tx_revoked.numOfApprovals

                  assert.equal(
                      startingApprovalsNumber - endingApprovalsNumber,
                      1
                  )
              })
          })

          describe("upvoteSignatoryCandidate", async function() {
              it("Only signatory can upvote candidate", async function() {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  const randomAccountAddress = await accounts[10].getAddress()

                  await expect(
                      attackerConnectedContract.upvoteSignatoryCandidate(
                          randomAccountAddress
                      )
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              it("Signatory cannot upvote null address", async function() {
                  await expect(
                      multisigWallet.upvoteSignatoryCandidate(
                          constants.ZERO_ADDRESS
                      )
                  ).to.be.revertedWith("MultisigWallet__InvalidAdress")
              })

              it("Existing signatory cannot be upvoted", async function() {
                  await expect(
                      multisigWallet.upvoteSignatoryCandidate(
                          initialAddressSet[1]
                      )
                  ).to.be.revertedWith("MultisigWallet__SignatoryAlreadyExists")
              })

              it("Cannot upvote twice for the same candidate", async function() {
                  const candidateAddress = accounts[15].address

                  await multisigWallet.upvoteSignatoryCandidate(
                      candidateAddress
                  )

                  await expect(
                      multisigWallet.upvoteSignatoryCandidate(candidateAddress)
                  ).to.be.revertedWith(
                      "MultisigWallet__SignatoryAlreadyUpvotedCandidate"
                  )
              })

              it("Updated approvedCandidateBySignatory once upvoted", async function() {
                  const candidateAddress = accounts[15].address

                  await multisigWallet.upvoteSignatoryCandidate(
                      candidateAddress
                  )

                  const isUpdated = await multisigWallet.approvedCandidateBySignatory(
                      initialAddressSet[0],
                      candidateAddress
                  )

                  assert(isUpdated)
              })

              it("Updated candidatesToAdd once upvoted", async function() {
                  const candidateAddress = accounts[15].address

                  await multisigWallet.upvoteSignatoryCandidate(
                      candidateAddress
                  )

                  const isUpdated = await multisigWallet.getCandidatesToAdd()

                  assert.equal(isUpdated.length, 1)
              })
          })

          describe("downvoteSignatory", async function() {
              it("Only signatory can downvote signatory", async function() {
                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  const randomAccountAddress = await accounts[10].getAddress()

                  await expect(
                      attackerConnectedContract.downvoteSignatory(
                          randomAccountAddress
                      )
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              it("Can downvote only existing signatory", async function() {
                  const nonExistentSignatoryAddress = accounts[10].getAddress()
                  await expect(
                      multisigWallet.downvoteSignatory(
                          nonExistentSignatoryAddress
                      )
                  ).to.be.revertedWith("MultisigWallet__NonExistentSignatory")
              })

              it("Cannot downvote twice for the same signatory", async function() {
                  const signatory = initialAddressSet[2]

                  await multisigWallet.downvoteSignatory(signatory)

                  await expect(
                      multisigWallet.downvoteSignatory(signatory)
                  ).to.be.revertedWith(
                      "MultisigWallet__SignatoryAlreadyDownvotedCandidate"
                  )
              })

              it("Updated approvedSignatoryRemovalBySignatory once downvoted", async function() {
                  const signatoryAddress = initialAddressSet[2]

                  await multisigWallet.downvoteSignatory(signatoryAddress)

                  const isUpdated = await multisigWallet.approvedSignatoryRemovalBySignatory(
                      initialAddressSet[0],
                      signatoryAddress
                  )

                  assert(isUpdated)
              })

              it("Updated signatoriesToRemove once downvoted", async function() {
                  const signatoryAddress = initialAddressSet[2]

                  await multisigWallet.downvoteSignatory(signatoryAddress)

                  const isUpdated = await multisigWallet.getSignatoriesToRemove()

                  assert.equal(isUpdated.length, 1)
              })
          })

          describe("addSignatory", async function() {
              it("Cannot add existing signatory", async function() {
                  const signatory = initialAddressSet[2]

                  await expect(
                      multisigWallet.addSignatory(signatory)
                  ).to.be.revertedWith("MultisigWallet__SignatoryAlreadyExists")
              })

              it("Should fail if there is not enough signatures", async function() {
                  const signatoryCandidateAddress = await accounts[10].getAddress()
                  await multisigWallet.upvoteSignatoryCandidate(
                      signatoryCandidateAddress
                  )

                  await expect(
                      multisigWallet.addSignatory(signatoryCandidateAddress)
                  ).to.be.reverted
              })

              it("Only signatory can add signatory", async function() {
                  const signatoryCandidateAddress = await accounts[10].getAddress()
                  await multisigWallet.upvoteSignatoryCandidate(
                      signatoryCandidateAddress
                  )

                  const secondSignatorySigner = multisigWallet.provider.getSigner(
                      initialAddressSet[1]
                  )
                  const secondSignatoryConnectedContract = await multisigWallet.connect(
                      secondSignatorySigner
                  )

                  await secondSignatoryConnectedContract.upvoteSignatoryCandidate(
                      signatoryCandidateAddress
                  )

                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.addSignatory(
                          signatoryCandidateAddress
                      )
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              describe("Updates all values correctly", async function() {
                  let signatoryCandidateAddress
                  let secondSignatorySigner
                  let secondSignatoryConnectedContract
                  let initialSignatories
                  let initialRequiredSignatures
                  beforeEach(async function() {
                      initialSignatories = await multisigWallet.getSignatories()

                      initialRequiredSignatures = await multisigWallet.getRequiredSignatories()

                      signatoryCandidateAddress = await accounts[10].getAddress()
                      await multisigWallet.upvoteSignatoryCandidate(
                          signatoryCandidateAddress
                      )

                      secondSignatorySigner = multisigWallet.provider.getSigner(
                          initialAddressSet[1]
                      )
                      secondSignatoryConnectedContract = await multisigWallet.connect(
                          secondSignatorySigner
                      )

                      await secondSignatoryConnectedContract.upvoteSignatoryCandidate(
                          signatoryCandidateAddress
                      )

                      await multisigWallet.addSignatory(
                          signatoryCandidateAddress
                      )
                  })

                  it("Updates isSignatory mapping", async function() {
                      const isSignatoryUpdated = await multisigWallet.isSignatory(
                          signatoryCandidateAddress
                      )

                      assert(isSignatoryUpdated)
                  })

                  it("Updates signatories array", async function() {
                      const updatedSignatories = await multisigWallet.getSignatories()
                      assert.equal(
                          updatedSignatories.length - initialSignatories.length,
                          1
                      )
                  })

                  it("Updates required signatories amount", async function() {
                      const updatedRequiredSignatories = await multisigWallet.getRequiredSignatories()
                      assert.equal(
                          updatedRequiredSignatories -
                              initialRequiredSignatures,
                          1
                      )
                  })
              })
          })

          describe("removeSignatory", async function() {
              it("Cannot remove non existent signatory", async function() {
                  const nonExistentSignatoryAddress = await accounts[10].getAddress()
                  await expect(
                      multisigWallet.removeSignatory(
                          nonExistentSignatoryAddress
                      )
                  ).to.be.revertedWith("MultisigWallet__NonExistentSignatory")
              })

              it("Should fail if there is not enough signatures", async function() {
                  const signatoryAddress = initialAddressSet[2]
                  await multisigWallet.downvoteSignatory(signatoryAddress)

                  await expect(multisigWallet.removeSignatory(signatoryAddress))
                      .to.be.reverted
              })

              it("Only signatory can remove signatory", async function() {
                  const signatoryAddress = initialAddressSet[2]
                  await multisigWallet.downvoteSignatory(signatoryAddress)

                  const secondSignatorySigner = multisigWallet.provider.getSigner(
                      initialAddressSet[1]
                  )
                  const secondSignatoryConnectedContract = await multisigWallet.connect(
                      secondSignatorySigner
                  )

                  await secondSignatoryConnectedContract.downvoteSignatory(
                      signatoryAddress
                  )

                  const attacker = accounts[6]

                  const attackerConnectedContract = await multisigWallet.connect(
                      attacker
                  )

                  await expect(
                      attackerConnectedContract.removeSignatory(
                          signatoryAddress
                      )
                  ).to.be.revertedWith("MultisigWallet__NotValidSignatory")
              })

              describe("Updates all values correctly", async function() {
                  let signatoryAddress
                  let secondSignatorySigner
                  let secondSignatoryConnectedContract
                  let initialSignatories
                  let initialRequiredSignatures
                  let initialTransactions
                  let txIdsSignedBySignatoryToApprovalsNum = {}

                  beforeEach(async function() {
                      initialSignatories = await multisigWallet.getSignatories()

                      initialRequiredSignatures = await multisigWallet.getRequiredSignatories()

                      // check tx that was signed by this Signatory
                      initialTransactions = await multisigWallet.getTransactions()
                      for (let i = 0; i < initialTransactions.length; i++) {
                          const isSigned = await multisigWallet.isSignedTxByAddress(
                              signatoryAddress,
                              transactions[i]
                          )

                          if (isSigned) {
                              txIdsSignedBySignatoryToApprovalsNum[
                                  initialTransactions[i].txId
                              ] = initialTransactions[i].numOfApprovals
                          }
                      }

                      signatoryAddress = initialAddressSet[2]
                      await multisigWallet.downvoteSignatory(signatoryAddress)

                      secondSignatorySigner = multisigWallet.provider.getSigner(
                          initialAddressSet[1]
                      )
                      secondSignatoryConnectedContract = await multisigWallet.connect(
                          secondSignatorySigner
                      )

                      await secondSignatoryConnectedContract.downvoteSignatory(
                          signatoryAddress
                      )

                      await multisigWallet.removeSignatory(signatoryAddress)
                  })

                  it("Removes signatory from isSignatory mapping", async function() {
                      const isSignatoryUpdated = await multisigWallet.isSignatory(
                          signatoryAddress
                      )

                      assert(!isSignatoryUpdated)
                  })

                  it("Removes signatory from signatories array", async function() {
                      const updatedSignatories = await multisigWallet.getSignatories()
                      assert.equal(
                          initialSignatories.length - updatedSignatories.length,
                          1
                      )
                  })

                  it("Updates required signatories amount", async function() {
                      const updatedRequiredSignatories = await multisigWallet.getRequiredSignatories()
                      assert.equal(
                          initialRequiredSignatures -
                              updatedRequiredSignatories,
                          1
                      )
                  })

                  it("Removes signatory's previous upvotes for other candidates", async function() {
                      const candidateToAdd = await multisigWallet.getCandidatesToAdd()
                      for (let i = 0; i < candidateToAdd.length; i++) {
                          const resp = await multisigWallet.approvedCandidateBySignatory(
                              signatoryAddress,
                              candidateToAdd[i]
                          )
                          assert(!resp)
                      }
                  })

                  it("Removes signatory's previous downvotes for other signatories", async function() {
                      const signatoriesToRemove = await multisigWallet.getSignatoriesToRemove()
                      for (let i = 0; i < signatoriesToRemove.length; i++) {
                          const resp = await multisigWallet.approvedSignatoryRemovalBySignatory(
                              signatoryAddress,
                              signatoriesToRemove[i]
                          )
                          assert(!resp)
                      }
                  })

                  it("Removes signatory's previous signatures for transactions", async function() {
                      let transaction, updatedNumOfApprovals
                      for (var key in txIdsSignedBySignatoryToApprovalsNum) {
                          const resp = await multisigWallet.isSignedTxByAddress(
                              signatoryAddress,
                              key
                          )
                          assert(!resp)
                          transaction = await multisigWallet.getTransaction(key)
                          updatedNumOfApprovals = transaction.numOfApprovals

                          assert.equal(
                              initialTransactions[key].txId -
                                  updatedNumOfApprovals,
                              1
                          )
                      }
                  })
              })
          })
      })
