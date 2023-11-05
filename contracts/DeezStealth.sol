// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IERC20 {
  function transferFrom(address from, address to, uint value) external returns (bool);
}

contract DeezStealth {

  mapping (address => bytes) public pubKey;

  event NewPubKey(address indexed sender, bytes key);
  event PubKeyRemoved(address indexed sender);
  event Distributed(
    address indexed sender,
    address indexed token,
    uint totalAmount,
    uint totalEthAmount
  );
  event DistributedOne(
    address indexed sender,
    address indexed receiver,
    address indexed token,
    uint amount,
    uint gasPassAmount
  );

  error PubKeyNotProvided();
  error InvalidInput();
  error InvalidValue();

  function setPubKey(bytes memory key) external {
    pubKey[msg.sender] = key;
    emit NewPubKey(msg.sender, key);
  }

  function removePubKey() external {
    if (pubKey[msg.sender].length == 0) {
      revert PubKeyNotProvided();
    }
    delete pubKey[msg.sender];
    emit PubKeyRemoved(msg.sender);
  }

  function getPubKeys(address[] memory a) public view returns (bytes[] memory) {
    uint num = a.length;
    bytes[] memory pubKeys = new bytes[](num);
    for (uint i = 0; i < num; i++) {
      pubKeys[i] = pubKey[a[i]];
    }
    return pubKeys;
  }

  function distribute(
    address[] memory receivers,
    address token,
    uint[] memory amounts,
    uint[] memory gasPassAmounts
  ) public payable {
    if (amounts.length == 0 || receivers.length == 0) {
      revert InvalidInput();
    }
    if (amounts.length > 1 && receivers.length != amounts.length) {
      revert InvalidInput();
    }
    if (gasPassAmounts.length > 1 && receivers.length != gasPassAmounts.length) {
      revert InvalidInput();
    }
    bool manyAmounts = amounts.length > 1;
    bool manyGasPassAmounts = gasPassAmounts.length > 1;
    uint amount = amounts[0];
    uint gasPassAmount = gasPassAmounts.length > 0 ? gasPassAmounts[0] : 0;
    uint totalEthSent;
    uint totalSent;
    for (uint i = 0; i < receivers.length; i++) {
      if (i > 0) {
        if (manyAmounts) {
          amount = amounts[i];
        }
        if (manyGasPassAmounts) {
          gasPassAmount = gasPassAmounts[i];
        }
      }
      if (token != address(0)) { // ERC20
        IERC20(token).transferFrom(msg.sender, receivers[i], amount);
        totalSent += amount;
        if (gasPassAmount > 0) {
          payable(receivers[i]).transfer(gasPassAmount);
          totalEthSent += gasPassAmount;
        }
      } else { // ETH
        uint totalAmount = amount + gasPassAmount;
        payable(receivers[i]).transfer(totalAmount);
        totalEthSent += totalAmount;
      }
      emit DistributedOne(msg.sender, receivers[i], token, amount, gasPassAmount);
    }
    if (msg.value > totalEthSent) {
      payable(msg.sender).transfer(msg.value - totalEthSent);
    }
    emit Distributed(msg.sender, token, totalSent, totalEthSent);
  }
}
