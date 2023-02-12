const { network } = require("hardhat")
const { assert } = require("chai")

const {
    developmentChains,
    MIN_SIG_AMOUNT,
    ADDRESSES_MULTISIG,
    INITIAL_ACCOUNT_BALANCE
} = require("../helper-hardhat-config")

const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const minSigAmount = MIN_SIG_AMOUNT

    let initialAddressSet = []

    assert(
        INITIAL_ACCOUNT_BALANCE >= 0.1,
        "Please make INITIAL_ACCOUNT_BALANCE at least 0.1 (ETH), in your .env file: \
        INITIAL_ACCOUNT_BALANCE=0.1"
    )

    let initialContractBalance = ethers.utils.parseEther(
        INITIAL_ACCOUNT_BALANCE.toString()
    )

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
        value: initialContractBalance,
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
