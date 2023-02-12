// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

error MultisigWallet__NotValidSignatory();
error MultisigWallet__NotValidTxId();
error MultisigWallet__TxAlreadySigned();
error MultisigWallet__TxAlreadyExecuted();
error MultisigWallet__NotEnoughFunded();
error MultisigWallet__InvalidAdress();
error MultisigWallet__NonExistentSignatory();
error MultisigWallet__SignatoryAlreadyExists();
error MultisigWallet__SignatoryAlreadyUpvotedCandidate();
error MultisigWallet__SignatoryAlreadyDownvotedCandidate();

/** @title A MultiSigWallet contract
 * @notice This contract is to demo a sample multisig contract.
 * It can:
 * 1. Define the number of signatories required to execute a transaction.
 * 2. Define the list of signatories and their addresses.
 * 3. Add/remove signatories.
 * 4. Execute a transaction after the required number of signatures have been obtained.
 * 5. Cancel a transaction before it has been executed.
 */
contract MultisigWallet {
    event Submit(uint indexed txId);
    event Sign(address indexed owner, uint indexed txId);
    event Revoke(address indexed owner, uint indexed txId);
    event Execute(uint indexed txId);
    event Fund();
    event Upvote(address indexed signatoryCandidate);
    event AddSignatory(address indexed signatoryCandidate);
    event Downvote(address indexed signatory);
    event RemoveSignatory(address indexed signatory);

    uint256 public constant MIN_ETH_TO_FUND = 10 ** 17; // 0.1 ETH
    uint256 private requiredSignatures;
    address[] private signatories;
    uint256 private contractBalance;

    /// @notice Mapping representing whether the address is signatory
    mapping(address => bool) public isSignatory;

    /// @notice Structure representing transaction
    struct Transaction {
        uint256 txId;
        address to;
        uint256 value;
        bytes data;
        uint256 numOfApprovals;
        bool executed;
    }

    /// @notice Array of transactions
    Transaction[] private transactions;

    /// @notice Mapping representing whether transaction is signed by signatory
    //  (signatory address => txId => bool)
    mapping(address => mapping(uint256 => bool)) public isSignedTxByAddress;

    /// @notice Mapping representing whether the signatory upvoted the signatory
    /// candidate (signatory address => signatoryCandidate address => bool)
    mapping(address => mapping(address => bool))
        public approvedCandidateBySignatory;

    /// @notice Array of signatory candidates addresses to add
    address[] private candidatesToAdd;

    /// @notice Mapping representing whether the signatory downvoted the signatory
    /// (signatory address => signatoryToRemove address => bool)
    mapping(address => mapping(address => bool))
        public approvedSignatoryRemovalBySignatory;

    /// @notice Array of signatory addresses to remove
    address[] private signatoriesToRemove;

    modifier onlySignatory() {
        if (!isSignatory[msg.sender])
            revert MultisigWallet__NotValidSignatory();
        _;
    }

    modifier txExists(uint _txId) {
        if (_txId >= transactions.length) revert MultisigWallet__NotValidTxId();
        _;
    }

    modifier notSignedTx(uint _txId) {
        if (isSignedTxByAddress[msg.sender][_txId])
            revert MultisigWallet__TxAlreadySigned();
        _;
    }

    modifier notExecutedTx(uint _txId) {
        if (transactions[_txId].executed)
            revert MultisigWallet__TxAlreadyExecuted();
        _;
    }

    modifier isEnoughFunded(uint _txId) {
        if (transactions[_txId].value >= contractBalance)
            revert MultisigWallet__NotEnoughFunded();
        _;
    }

    modifier notNullAddress(address _address) {
        if (_address == address(0)) revert MultisigWallet__InvalidAdress();
        _;
    }

    modifier signatoryExists(address _signatory) {
        if (!isSignatory[_signatory])
            revert MultisigWallet__NonExistentSignatory();
        _;
    }

    modifier signatoryNonExistent(address _signatoryCandidate) {
        if (isSignatory[_signatoryCandidate])
            revert MultisigWallet__SignatoryAlreadyExists();
        _;
    }
    modifier notUpvotedForCandidate(address _signatoryCandidate) {
        if (approvedCandidateBySignatory[msg.sender][_signatoryCandidate])
            revert MultisigWallet__SignatoryAlreadyUpvotedCandidate();
        _;
    }

    modifier notDownvotedForSignatory(address _signatory) {
        if (approvedSignatoryRemovalBySignatory[msg.sender][_signatory])
            revert MultisigWallet__SignatoryAlreadyDownvotedCandidate();
        _;
    }

    /// @notice Contract Constructor
    /// @param _requiredSignatures - Minimum number of Signatories to execute tx
    /// @param _signatories - Array of Signatories addresses
    constructor(
        uint256 _requiredSignatures,
        address[] memory _signatories
    ) payable {
        require(_signatories.length > 0, "signatories required");
        require(
            _requiredSignatures > 0 &&
                _requiredSignatures <= _signatories.length,
            "invalid value of required signatories"
        );
        require(msg.value >= MIN_ETH_TO_FUND, "You should send more ETH!");

        requiredSignatures = _requiredSignatures;
        for (uint256 i; i < _signatories.length; i++) {
            address signatory = _signatories[i];
            require(signatory != address(0), "invalid signatory");
            require(!isSignatory[signatory], "signatory is already added");
            isSignatory[signatory] = true;
            signatories.push(signatory);
        }

        contractBalance = msg.value;
    }

    receive() external payable {
        fund();
    }

    fallback() external payable {
        fund();
    }

    /// @notice Function to submit the transaction
    /// @param _to - Address to send ETH
    /// @param _value - Amount to send (in wei)
    /// @param _data - Transaction data
    function submitTx(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlySignatory {
        uint256 txId = transactions.length;

        transactions.push(
            Transaction({
                txId: txId,
                to: _to,
                value: _value,
                data: _data,
                numOfApprovals: 0,
                executed: false
            })
        );
        emit Submit(txId);
    }

    /// @notice Function to sign the transaction
    /// @param _txId - Transaction Id from Transaction data structure
    function signTx(
        uint256 _txId
    )
        external
        onlySignatory
        txExists(_txId)
        notSignedTx(_txId)
        notExecutedTx(_txId)
    {
        isSignedTxByAddress[msg.sender][_txId] = true;
        transactions[_txId].numOfApprovals += 1;
        emit Sign(msg.sender, _txId);
    }

    /// @notice Function to execute the transaction
    /// @param _txId - Transaction Id from Transaction data structure
    function executeTx(
        uint256 _txId
    )
        external
        onlySignatory
        txExists(_txId)
        notExecutedTx(_txId)
        isEnoughFunded(_txId)
    {
        require(
            transactions[_txId].numOfApprovals >= requiredSignatures,
            "not enough signatures"
        );
        Transaction storage transaction = transactions[_txId];
        transaction.executed = true;

        (bool success, ) = payable(transaction.to).call{
            value: transaction.value
        }(transaction.data);

        require(success, "tx failed");

        emit Execute(_txId);
    }

    /// @notice Function to revoke the transaction
    /// @param _txId - Transaction Id from Transaction data structure
    function revokeTx(
        uint256 _txId
    ) external txExists(_txId) notExecutedTx(_txId) {
        require(
            isSignedTxByAddress[msg.sender][_txId],
            "tx not signed by this address"
        );
        isSignedTxByAddress[msg.sender][_txId] = false;
        transactions[_txId].numOfApprovals -= 1;
        emit Revoke(msg.sender, _txId);
    }

    /// @notice Function to upvote signatory candidate before adding it to signatories
    /// @param _signatoryCandidate - Signatory candidate address
    function upvoteSignatoryCandidate(
        address _signatoryCandidate
    )
        external
        onlySignatory
        notNullAddress(_signatoryCandidate)
        signatoryNonExistent(_signatoryCandidate)
        notUpvotedForCandidate(_signatoryCandidate)
    {
        approvedCandidateBySignatory[msg.sender][_signatoryCandidate] = true;

        candidatesToAdd.push(_signatoryCandidate);

        emit Upvote(_signatoryCandidate);
    }

    /// @notice Function to downvote signatory before removing it from signatories
    /// @param _signatory - Signatory address
    function downvoteSignatory(
        address _signatory
    )
        external
        onlySignatory
        signatoryExists(_signatory)
        notDownvotedForSignatory(_signatory)
    {
        approvedSignatoryRemovalBySignatory[msg.sender][_signatory] = true;

        signatoriesToRemove.push(_signatory);

        emit Downvote(_signatory);
    }

    /// @notice Function to add signatory candidate to signatories once collected required
    /// signatories amount
    /// @param _signatoryCandidate - Signatory candidate address
    function addSignatory(
        address _signatoryCandidate
    ) external onlySignatory signatoryNonExistent(_signatoryCandidate) {
        require(
            _getUpvoteCandidateCount(_signatoryCandidate) >= requiredSignatures,
            "not enough signatures"
        );
        isSignatory[_signatoryCandidate] = true;
        signatories.push(_signatoryCandidate);
        requiredSignatures += 1;

        emit AddSignatory(_signatoryCandidate);
    }

    /// @notice Function to remove signatory from signatories once collected required
    /// signatories amount
    /// @param _signatory - Signatory address
    function removeSignatory(
        address _signatory
    ) external onlySignatory signatoryExists(_signatory) {
        require(
            _getDownvoteCandidateCount(_signatory) >= requiredSignatures,
            "not enough signatures"
        );

        address[] memory m_candidatesToAdd = candidatesToAdd;

        // Reset all upvotes/downvotes and signed tx done by this signatory
        for (uint256 i; i < m_candidatesToAdd.length; i++) {
            if (
                approvedCandidateBySignatory[_signatory][m_candidatesToAdd[i]]
            ) {
                approvedCandidateBySignatory[_signatory][
                    m_candidatesToAdd[i]
                ] = false;
            }
        }

        address[] memory m_signatoriesToRemove = signatoriesToRemove;

        for (uint256 i; i < m_signatoriesToRemove.length; i++) {
            if (
                approvedSignatoryRemovalBySignatory[_signatory][
                    m_signatoriesToRemove[i]
                ]
            ) {
                approvedSignatoryRemovalBySignatory[_signatory][
                    m_signatoriesToRemove[i]
                ] = false;
            }
        }

        Transaction[] memory m_transactions = transactions;

        for (uint256 i; i < m_transactions.length; i++) {
            if (isSignedTxByAddress[_signatory][m_transactions[i].txId]) {
                isSignedTxByAddress[_signatory][m_transactions[i].txId] = false;
                transactions[i].numOfApprovals -= 1;
            }
        }

        // Remove signatory from signatories
        address[] memory m_signatories = signatories;

        uint256 signatoryIndex = 0;
        for (uint256 i = 0; i < m_signatories.length; i++) {
            if (m_signatories[i] == _signatory) {
                signatoryIndex = i;
                break;
            }
        }

        for (uint i = signatoryIndex; i < signatories.length - 1; i++) {
            signatories[i] = signatories[i + 1];
        }

        signatories.pop();

        isSignatory[_signatory] = false;
        requiredSignatures -= 1;

        emit RemoveSignatory(_signatory);
    }

    /// @notice Function used to fund additionally the contract
    function fund() public payable {
        require(msg.value >= MIN_ETH_TO_FUND, "You should send more ETH!");
        contractBalance += msg.value;

        emit Fund();
    }

    /// @notice Returns the number of required signatories
    /// @return requiredSignatures - Number of required signatories
    function getRequiredSignatories() public view returns (uint256) {
        return requiredSignatures;
    }

    /// @notice Returns the array of signatories' addresses
    /// @return signatories - Array of signatories' addresses
    function getSignatories() public view returns (address[] memory) {
        return signatories;
    }

    /// @notice Returns Transaction data structure by given index
    /// @param index - Transaction index
    /// @return transaction - Transaction data structure
    function getTransaction(
        uint256 index
    ) public view returns (Transaction memory) {
        return transactions[index];
    }

    /// @notice Returns the array of transactions
    /// @return signatories - Array of transactions
    function getTransactions() public view returns (Transaction[] memory) {
        return transactions;
    }

    /// @notice Returns the array of signatory candidates' addresses to add
    /// @return signatories - Array of signatory candidates' addresses
    function getCandidatesToAdd() public view returns (address[] memory) {
        return candidatesToAdd;
    }

    /// @notice Returns the array of signatories' addresses to remove
    /// @return signatories - Array of signatories' addresses
    function getSignatoriesToRemove() public view returns (address[] memory) {
        return signatoriesToRemove;
    }

    /// @notice Returns the number of upvotes for this signatory candidate
    /// @param _signatoryCandidate - Signatory candidate address
    /// @return count - Number of upvotes
    function _getUpvoteCandidateCount(
        address _signatoryCandidate
    ) private view returns (uint256 count) {
        for (uint256 i; i < signatories.length; i++) {
            if (
                approvedCandidateBySignatory[signatories[i]][
                    _signatoryCandidate
                ]
            ) {
                count += 1;
            }
        }
    }

    /// @notice Returns the number of downvotes for this signatory
    /// @param _signatory - Signatory address
    /// @return count - Number of downvotes
    function _getDownvoteCandidateCount(
        address _signatory
    ) private view returns (uint256 count) {
        for (uint256 i; i < signatories.length; i++) {
            if (
                approvedSignatoryRemovalBySignatory[signatories[i]][_signatory]
            ) {
                count += 1;
            }
        }
    }
}
