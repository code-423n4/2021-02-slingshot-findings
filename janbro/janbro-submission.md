**Handle:** janbro

**Bio:** Smart contract bug hunter, occasional auditor, and developer.

# BUG 1
## Summary
If tokens are accidently sent to Slingshot, arbitrary trades can be executed and those funds can be stolen by anyone. This attack can also be utilized as a front running attack on `rescueTokens()`.

## Risk Rating
2: Medium
## Vulnerability Details
Attack vector:

Note: Uniswap and WETH are used as examples in the attack vector, however any module or token can be utilized in this attack

1. Monitor Slingshot contract for rescueTokens(address token, address to, uint amount) to be called. In this example token will be `WETH` and amount will be `y`
2. Front run the transaction with `executeTrades(address fromToken, address toToken, uint fromAmount, TradeFormat[] calldata trades, uint finalAmountMin, address recipient)` with the token to be rescued as `fromToken` and `toToken` with a token of preffered payout, say `DAI`. The `fromAmount` here will be 0, however any arbitrary value under the rescued amount will be profitable. Point the TradeFormat moduleAddress to the preferred module (Uniswap in this example). Craft the calldata as the following: swap(0, [`WETH`, `DAI`], 0, uint256(-1), true, true). Since there are no checks the amount the user deposited is equivalent to the amount passed to `swap()` and `tradeAll` is true, `approveIfBelow(...)` gives Uniswap approval to trade all wrapped ether in `Slingshot.sol` for the token specified in the respective liquidity pool.

Any funds from token or eth accidentally sent to the contract can be used in a trade with tradeAll, rendering them unable to be rescued.

## Impact
This vulnerability impacts the rescueToken functionality and any funds which are trapped in Slingshots contract. Tokens and/or ether have a higher likelihood of becoming trapped in Slingshot if finalAmountMin is not utilized properly.

## Proof of Concept
- Monitor for and extract values from eg. rescueTokens(`WETH`, to, `AMOUNT`);
- Front run transaction with: executeTrades(`WETH`, `DAI`, 0, [[0, [`WETH`, `DAI`], 0, uint256(-1), true, true], 0, me]);

## Tools Used
Manual code review

## Recommended Mitigation Steps
Validate the parameters in the calldata passed to modules. Ensure that the fromToken and amount parameter from executeTrades is equivalent to the token being swapped and amount passed to `swap()`. Additionally, approval values can be limited to value being traded and cleared after trades are executed.


# BUG 2
## Summary
Gas Optimization

## Risk Rating
1: Low
## Vulnerability Details
Gas inneficiency in line 87 of Slingshot.sol, trades.length reads from storage multiple times
## Impact
Minor increased gas cost
## Tools Used
Manual code review
## Recommended Mitigation Steps
Hoist trades.length to save on gas fees
eg.
```
...
uint tradeLength = trades.length;
for(uint i = 0; i < tradeLength; i++) {
...
```
