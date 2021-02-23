require("@nomiclabs/hardhat-waffle");
require('@openzeppelin/hardhat-upgrades');

module.exports = {
  solidity: "0.7.5",

  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/sUiZsY3BSTYXjSHIvPc9rGDipR7lAlT4",
        blockNumber: 11877100
      }
    }
  }
};
