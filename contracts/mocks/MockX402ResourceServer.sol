// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MockX402ResourceServer {
    struct PaymentRequirement {
        address merchant;
        address payTo;
        address asset;
        uint256 amount;
        uint256 validUntil;
        string resource;
    }

    event PaymentRequired(
        address indexed merchant,
        address indexed payTo,
        address indexed asset,
        uint256 amount,
        uint256 validUntil,
        string resource
    );

    function quotePayment(address payTo, address asset, uint256 amount, uint256 ttl, string calldata resource)
        external
        returns (PaymentRequirement memory requirement)
    {
        requirement = PaymentRequirement({
            merchant: msg.sender,
            payTo: payTo,
            asset: asset,
            amount: amount,
            validUntil: block.timestamp + ttl,
            resource: resource
        });

        emit PaymentRequired(msg.sender, payTo, asset, amount, requirement.validUntil, resource);
    }
}
