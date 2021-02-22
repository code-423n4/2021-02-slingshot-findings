**Handle:** ncitron  

## Note:
All accompanying tests have been shared to @zscole on GitHub at ncitron/slingshot-audit.

# BUG 1
## Summary
Setting `tradeAll` to true and `swapExactTokensForTokens` to false in the `swap` function of UniswapModule or SushiSwapModule will cause the trade size to be incorrect.

## Risk Rating
2

## Vulnerability Details
If `tradeAll` is true, then line 38 of `UniswapModule.sol` causes the `amount` variable to be equal to the contracts balance of the input token. When `swapExactTokensForTokens` is set to false, the contract will supply this `amount` variable for `UniswapV2Router02.swapTokensForExactTokens` function as the `amountOut` parameter. This is incorrect, since the contracts balance of the input token should not be equivelent to the output size of the trade.

## Impact
This can cause tokens to get stuck inside of the slinshot contract if a trade is executed with these paramets, and the input token is worth more than the output token. For example, if you attempted to swap 1 WETH to DAI like this, you would receive just 1 DAI, with the excess 0.999 ETH left inside the Uniswap/Sushiswap module.

## Proof of Concept
A test showcasing this error is under `test/bug1.js` in my github repository.

## Tools Used
I used a hardhat to provide a test environment.

## Recommended Mitigation Steps
First, the `amount` parameter in the modules `swap` function should be documented better, since it does not correctly reflect that this parameter will either refer to the input amount or output amount depending on the the value of `swapExactTokensForTokens`. To ensure that this error does not happen even if the contract use misunderstands the meaning of `amount`, move the if statement on line 38 of `UniswapModule.sol` to be inside of the first branch of the if statement on line 41. The same should be done for `SushiSwapModule.sol` (although the line numbers are different).


# BUG 2
## Summary
Funds that have been locked in the contract acccidentally can be stolen by a non-priviledged user.

## Risk Rating
3

## Vulnerability Details
If 10 ERC20 is locked in the contract. Execute a swap using any of the trade modules from ERC20 -> DAI with an input amount of 0.0001 ERC20 and an output amount of 10 * ERC20_PRICE DAI, and pass in a uniswap trade that swaps the full 10 ERC20 to DAI. This allows the user to withdraw the 10 ERC20 as DAI that was locked in the contract while spending just 0.0001 ERC20.

## Impact
This bug allows an attacker to steal funds in the contract. The contact only accumulates funds from accidental transfers and from executing trades that result in dust being left behind. This is not detrimental, since when used correctly, the contract should not accumulate funds. Since the authors of these contracts have chosen to include a `rescueTokens` function in `Slingshot.sol`, implying that they intend to send lost funds back to their owners, this fix may be prudent.

## Proof of Concept
A test showcasing this error is under `test/bug2.js` in my github repository.

## Tools Used
I used a hardhat to provide a test environment.

## Recommended Mitigation Steps
In order to mitigate this bug, the for loop in `Slingshot.sol` that executes each trade needs to properly keep track of the input and output amounts for each trade. The `tradeAll` parameter present in all of the modules should then not simply use the contracts full balance of an asset, but instead the output amount of the prvious trade that can be tracked in `Slingshot.sol`.

# BUG 3
## Summary
Curve module does not validate that the i and j index are associated with the iToken and jToken addresses.

## Risk Rating
1

## Vulnerability Details
The input paramets `i` and `j` are not validated to be the ones correlated to addresses `iToken` and `jToken`. Some simple input validation could prevent loss of funds from malformed inputs.

## Proof of Concept
None

## Tools Used
None

## Recommended Mitigation Steps
Validate that the  `i` and `j` indicies match up with the `iToken` and `jToken` addresses. This can be done by using the `curvePool.coins()` method. In fact, you can remove the need for passing in the `iToken` and `jToken` paramets by replacing them with:  
`address iToken = curvePool.coins()[i]`  
and  
`address jToken = curvePool.coins()[j]`.

# BUG 4
## Summary
Dust can be left behind in the slingshot contract if intermediate trades do not set the `tradeAll` parameter to true.

## Risk Rating
1

## Vulnerability Details
An intermediate trade should always use the full balance of the input token left inside of the contract. Although the Slinshot frontend almost certainly enforces this, the contract should as well to prevent loss of funds.

## Proof of Concept
None

## Tools Used
None

# Recommended Mitigation Steps
The slinshot contracts should require that the all but the first trade in the `trades` array have `tradeAll` set to true. If it is not, revert.
