**Handle:** cmichel (Christoph Michel)
**Team:**
**Ethereum Address:** 0x6823636c2462cfdcD8d33fE53fBCD0EdbE2752ad
**Bio:** https://twitter.com/cmichelio

# BUG 1
## Summary
The trades through the module contracts are vulnerable to a sandwich attack if a  `finalAmountMin` allows for slippage.

## Risk Rating
2
## Vulnerability Details

A common attack in DeFi is the "sandwich attack". Upon observing a trade of asset X for asset Y, an attacker frontruns the victim trade by also buying asset Y, lets the victim execute the trade, and then backruns (executes after) the victim by trading back the amount gained in the first trade. Intuitively, one uses the knowledge that someone’s going to buy an asset, and that this trade will increase its price, to make a profit. The attacker’s plan is to buy this asset cheap, let the victim buy at an increased price, and then sell the received amount again at a higher price afterwards. Read more about it [here](https://cmichel.io/de-fi-sandwich-attacks/)

If a `finalAmountMin` is chosen that does not closely reflect the received amount one would get at the market rate (even with just 1% slippage), this could lead to the trade being frontrun and to less tokens than with a tighter slippage amount.
Especially, the `Balancer` and `Curve` modules don't have any slippage protection at all which makes it easy for attackers to profit from such an attack. The min amount returned is hardcoded to `1` for both protocols:

```solidity
// BalancerModule::swap
(uint boughtAmount,) = IBalancerPool(pool).swapExactAmountIn(
    tokenIn,
    totalAmountIn,
    tokenOut,
    1,          // minAmountOut
    uint256(-1) // maxPrice
);

// CurveModule::swap
// notice the uint(1) which is the minOut amount
underlyingTokens
    ? ICurvePool(curvePool).exchange_underlying(i, j, dx, uint(1))
    : ICurvePool(curvePool).exchange(i, j, dx, uint(1));
```

The Sushiswap/Uniswap modules are vulnerable as well, depending on the calldata that is defined by the victim trader:

```solidity
// all parameters are chosen by the victim
IUniswapV2Router02(sushiSwapRouter).swapExactTokensForTokens(
      amount,
      amountOutMin, // can be 0
      path,
      address(this),
      block.timestamp
  );
IUniswapV2Router02(sushiSwapRouter).swapTokensForExactTokens(
    amount,
    amountInMax, // can be -1
    path,
    address(this),
    block.timestamp
);
```

## Impact
The attacker's profit is the victim trader's loss. This can lead to trading at a very bad rate, much lower than the market rate. Sandwich attacks are especially common when trading large quantities in low liquidity pools.

## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
Disallow a `finalAmountMin` value of `0` or `1` and/or educate the trader to use a tight slippage value.
Also, allow the trader to define slippage also for the Balancer and Curve modules.

# BUG 2
## Summary
Anyone can steal stuck funds in the `Slingshot` contract.
Essentially, an attacker can achieve the same as the admin-only `rescueTokens` function.

## Risk Rating
3

## Vulnerability Details
Any tokens in the `Slingshot` contract can be stolen by creating a fake token and a Uniswap pair for the stuck token and this fake token.
Consider 10 WETH being stuck in the `Slingshot` contract.
One can create a fake ERC20 token contract `FAKE` and a `WETH <> FAKE` Uniswap pair. The attacker provides a tiny amount of initial WETH liquidity (for example, 1 gwei) and some amount of `FAKE` tokens.
The attacker then executes `executeTrades` action such that the `Slingshot` contract uses its `Uniswap` module to trade the 10 WETH into this pair.

This works by calling the `executeTrades` action with the following parameters:

```solidity
function executeTrades(
    address fromToken=WETH_TOKEN,
    address toToken=FAKE_TOKEN,
    uint fromAmount=0,
    TradeFormat[] calldata trades=[{
      moduleAddress: UNISWAP,
      callData: IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
            amount=10ether,
            amountOutMin=0,
            path=[WETH, FAKE],
            address(this),
            block.timestamp
        );
    }],
    uint finalAmountMin=0,
    address recipient=attacker
)
```

> Notice, how this functions only checks the difference of the `toToken` (`FAKE` token) balances, but no checks on the `WETH` are performed.

Afterwards, there are 10 WETH in the pool and the attacker can withdraw the liquidity from the fake pool again, netting them 10 WETH.

## Impact
Anyone can steal stuck funds in the `Slingshot` contract. While usually no funds should become stuck in there, wrong user interactions or wrong future module implementations may lead to this scenario.
## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
This is hard to mitigate with the current way the module system works because the trades' calldata is opaque and is completely independent of the from/toToken address parameters. One would need to make the trades' calldata less opaque and define the from/toToken addresses there. Then, before doing the trades in `executeTrades`, check all token balances that will be involved in this trade and sweep any funds to a secure admin-controlled address for further processing.

# BUG 3
## Summary
Anyone can steal stuck funds in the module contracts.
## Risk Rating
1
## Vulnerability Details
Any tokens in the module contracts that allow custom pairs to be added can be stolen by creating a fake token and a pool pair for the stuck token and this fake token. The attacker provides a tiny amount of liquidity to this pool.

Then one can directly call the `swap` function **on the module contract** to swap the stuck tokens in the pool for useless tokens.

Afterwards, the stuck tokens are in the pool and can be withdrawn by withdrawing liquidity.

A similar attack is even possible for modules where no custom pairs can be created by providing lots of liquidity first using flash loans, then trading in the pool and withdrawing liquidity again (which essentially makes this similar to a sandwich attack.)

## Impact
Anyone can steal stuck funds in the module contracts. While usually, no funds should end up in this contract at all because these modules are only used with delegatecall, wrong, direct user interactions with these contracts could still lead to unrecoverable losses.
## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
Make these functions only callable by the Slingshot contract, for example by checking `msg.sender == SLINGSHOT` because it's a delegatecall. Then add another way to rescue those funds.

# BUG 4
## Summary
Setting the admin in `initialize` or `postUpgrade` can be frontrun by a malicious attacker.
## Risk Rating
1
## Vulnerability Details
These functions can be called by anyone the first time which allows an attacker to set the owner of the contract to themselves.

## Impact
This leads to a denial of service attack whenever the project party tries to deploy these contracts on their own.
## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
Call the `initialize` function in the same transaction as the contract deployment. Use a factory contract facilitating this.

# BUG 5
## Summary
Wrong event is emitted in `ModuleRegistry::unregisterSwapModule`.
## Risk Rating
1
## Vulnerability Details
It emits the `ModuleRegistered` event but should emit the `ModuleUnregistered` event.

## Impact
This might break some off-chain functionality that relies on the `ModuleUnregistered` event.
## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
Use the correct `ModuleUnregistered` event instead.

# BUG 6
## Summary
The `ModuleRegistry::slingshot` storage variable is never read.
## Risk Rating
1
## Vulnerability Details
It's not read and can therefore be removed unless it's planned to be used in the future.

## Impact

## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
Remove it along with the `setSlingshot` function.

# BUG 7
## Summary
The `ETH_ADDRESS, WETH` storage variables in `Slingshot` should be made constant to save on gas.
## Risk Rating
1
## Vulnerability Details
These storage variables are read several times in the contract and reading from storage is expensive.

## Impact

## Proof of Concept

## Tools Used

## Recommended Mitigation Steps
Make them constant instead of storing them in storage.

