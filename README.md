# Multisig wallet Demo Project

This project demonstrates a basic Multisig wallet. It comes with a sample contract, a test for that contract, and a script that deploys that contract.
It can:
- Define the number of signatories required to execute a transaction.
- Define the list of signatories and their addresses.
- Add/remove signatories.
- Execute a transaction after the required number of signatures have been obtained.
- Cancel a transaction before it has been executed.

Populate your .env file with these variables:

```shell
GOERLI_RPC_URL=<your_rpc_url>
ADDRESSES_MULTISIG=<address1>,<address2>,<address3>,...
MIN_SIG_AMOUNT=<min_signatures_required_number>
INITIAL_ACCOUNT_BALANCE=0.1 # at least 0.1 ETH
```

Try running some of the following tasks:

Local network
```shell
yarn hardhat test
yarn hardhat deploy
```

Goerli network
```shell
yarn hardhat test --network goerli
yarn hardhat deploy --network goerli
```
