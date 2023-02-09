# Multisig wallet Demo Project

This project demonstrates a basic Multisig wallet. It comes with a sample contract, a test for that contract, and a script that deploys that contract.
It can:
- Define the number of signatories required to execute a transaction.
- Define the list of signatories and their addresses.
- Implement the functionality to add/remove signatories.
- Implement the functionality to execute a transaction after the required number of signatures have been obtained.
- Implement the functionality to cancel a transaction before it has been executed.

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
