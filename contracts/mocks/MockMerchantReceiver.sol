// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IAegis402StatusView {
    function paymentStatus(bytes32 paymentId) external view returns (uint8);
}

contract MockMerchantReceiver {
    event CallbackObserved(address indexed hook, bytes32 indexed paymentId, uint8 observedStatus, address caller);

    uint8 public lastObservedStatus;

    function observePaymentStatus(address hook, bytes32 paymentId) external {
        lastObservedStatus = IAegis402StatusView(hook).paymentStatus(paymentId);
        emit CallbackObserved(hook, paymentId, lastObservedStatus, msg.sender);
    }
}
