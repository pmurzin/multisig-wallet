const { network } = require("hardhat")

const { developmentChains } = require("../helper-hardhat-config")

const { verify } = require("../utils/verify")

require("dotenv").config()

const MIN_SIG_AMOUNT = process.env.MIN_SIG_AMOUNT
const ADDRESSES_MULTISIG = process.env.ADDRESSES_MULTISIG

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const minSigAmount = MIN_SIG_AMOUNT

    let initialAddressSet = []

    if (developmentChains.includes(network.name)) {
        const accounts = await ethers.getSigners()
        for (let i = 0; i < 3; i++) {
            initialAddressSet.push(accounts[i].address)
        }
    } else {
        initialAddressSet = ADDRESSES_MULTISIG.split(",")
    }

    console.log(initialAddressSet)

    const args = [minSigAmount, initialAddressSet]
    const multisigWallet = await deploy("MultisigWallet", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        await verify(multisigWallet.address, args)
    }

    log(
        "----------------------------------------------------------------------"
    )
}

module.exports.tags = ["all", "multisigwallet"]
