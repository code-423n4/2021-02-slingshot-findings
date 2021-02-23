const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const erc20ABI =  require("./erc20.json");

const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

describe("Bug 1", function() {
    it("Should lock tokens in contract when swapping with bad parameters", async function() {
      // get accounts
      const [ admin, user ] = await ethers.getSigners();

      // deploy UniswapModule.sol
      const UniswapModule = await ethers.getContractFactory("UniswapModule");
      const uniswapModule = await UniswapModule.deploy();
      await uniswapModule.deployed();

      // deploy Slingshot.sol
      const Slingshot = await ethers.getContractFactory("Slingshot");
      const slingshot = await Slingshot.deploy();
      await slingshot.deployed();
      await slingshot.postUpgrade(admin.address);

      // deploy ModuleRegistry.sol
      const ModuleRegistry = await ethers.getContractFactory("ModuleRegistry");
      const moduleRegistry = await ModuleRegistry.deploy();
      await moduleRegistry.deployed();
      await moduleRegistry.postUpgrade(admin.address);
      await moduleRegistry.setSlingshot(slingshot.address);
      await moduleRegistry.registerSwapModule(uniswapModule.address);
      await slingshot.setModuleRegistry(moduleRegistry.address);

      // do bad swap
      const interface = new ethers.utils.Interface(["function swap(uint amount, address[] memory path, uint amountOutMin, uint amountInMax, bool swapExactTokensForTokens, bool tradeAll ) public payable returns (uint256)"]);
      const calldata = interface.encodeFunctionData("swap", [ethers.utils.parseEther("1"), [wethAddress, daiAddress], 0, 0, false, true]);
      await slingshot.connect(user).executeTrades(
        ethAddress,
        daiAddress,
        ethers.utils.parseEther("1"),
        [{
          moduleAddress: uniswapModule.address,
          encodedCalldata: calldata
        }],
        0,
        user.address,
        { value: ethers.utils.parseEther("1") }
      )

      // get DAI balance of user from swap (would expect it to be ~1800 if there was not bug)
      const dai = new ethers.Contract(daiAddress, erc20ABI, user);
      // oh no we only get back 1 dai instead of 1800!
      expect(ethers.utils.formatEther(await dai.balanceOf(user.address))).to.equal("1.0");
    });
});