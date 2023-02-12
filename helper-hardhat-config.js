require("dotenv").config()

const networkConfig = {
    5: {
        name: "goerli"
    },
    137: {
        name: "polygon"
    }
}

const developmentChains = ["hardhat", "localhost"]

const MIN_SIG_AMOUNT = process.env.MIN_SIG_AMOUNT
const ADDRESSES_MULTISIG = process.env.ADDRESSES_MULTISIG
const INITIAL_ACCOUNT_BALANCE = process.env.INITIAL_ACCOUNT_BALANCE

module.exports = {
    networkConfig,
    developmentChains,
    MIN_SIG_AMOUNT,
    ADDRESSES_MULTISIG,
    INITIAL_ACCOUNT_BALANCE
}
