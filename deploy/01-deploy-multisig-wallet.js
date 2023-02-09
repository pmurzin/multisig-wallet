const { network } = require("hardhat")

const { networkConfig, developmentChains } = require("../helper-hardhat-config")

const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const minSigAmount = 2

    let initialAddressSet = []

    if (developmentChains.includes(network.name)) {
        const accounts = await ethers.getSigners()
        for (let i = 0; i < 3; i++) {
            initialAddressSet.push(accounts[i].address)
        }
    } else {
        initialAddressSet = [
            "0x36AbaF94Dd60A2DC89B9b16506695026eDE428fd",
            "0x3444f1d6457f1c39CB1c0f7C4783a4D6A1046d69",
            "0x6e057Aab036b43489AD4882f6D701CF83772fF7b"
        ]
    }

    console.log(initialAddressSet)

    const args = [minSigAmount, initialAddressSet]
    const multisigWallet = await deploy("MultisigWallet", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })

    // if (
    //     !developmentChains.includes(network.name) &&
    //     process.env.ETHERSCAN_API_KEY
    // ) {
    //     await verify(MultisigWallet.address, args)
    // }

    log("--------------------------------------------------------------------")
}

module.exports.tags = ["all", "multisigwallet"]
