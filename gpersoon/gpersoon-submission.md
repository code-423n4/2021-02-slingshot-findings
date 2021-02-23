Handle: gpersoon
Bio: Teacher blockchains at The Hague University of Applied Sciences in The Netherlands

# BUG 1
## Summary
`postUpgrade` can be called by anyone if not initialized.

## Risk Rating
1 (low)

## Vulnerability Details
`postUpgrade` can be called by anyone if not initialized, both in `Slingshot.sol` and `ModuleRegistry.sol`.

This is only relevant when the contracts are deployed directly (so without `deployProxy`).

## Impact
There could be a timewindow before the deployers call postUpgrade.
During that time a hacker could call postUpgrade taking ownership of the contract.
Even if this is detected, the contract has to be deployed again, which uses gas.

## Proof of Concept
The only check is `onlyAdminIfInitialized`.

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L55

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/ModuleRegistry.sol#L24

Which allows everyone when not initialized:
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Adminable.sol#L37

## Tools Used
Deployed Remix and tried to call `postUpgrade`

## Recommended Mitigation Steps
Remove the code for `postUpgrade` or add additional security checks.

# BUG 2
## Summary
Unlimited ERC20 allowances are set

## Risk Rating
1 (low)

## Vulnerability Details
Unlimited ERC20 allowances are set in LibERC20Token.sol
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/LibERC20Token.sol

## Impact
In case of a bug in an exchange combined with excess funds/tokens under ownership of the slingshot contract, the excess funds could be drained.

## Proof of Concept
With allowances a compromised exchange could retrieve these tokens.

## Tools Used
Remix

## Recommended Mitigation Steps
Only apply minimum allowance.

# BUG 3
## Summary
 The function swap in the module files have the same name but different parameters.

## Risk Rating
1 (low)

## Vulnerability Details
 
The function swap in the module files have the same name but different parameters.
https://github.com/code-423n4/code-contests/tree/main/contests/01-slingshot/contracts/module

See the different interfaces below:
```
BalancerModule.sol
UniswapModule.sol
UniswapModule.sol
CurveModule.sol
function swap(
  address pool,
  address tokenIn,
  address tokenOut,
  uint totalAmountIn,
  bool tradeAll
function swap(
 uint amount,
 address[] memory path,
 uint amountOutMin,
 uint amountInMax,
 bool swapExactTokensForTokens,
 bool tradeAll
function swap(
  uint amount,
  address[] memory path,
  uint amountOutMin,
  uint amountInMax,
  bool swapExactTokensForTokens,
  bool tradeAll
function swap(
  address curvePool,
  address iToken,
  address jToken,
  int128 i,
  int128 j,
  uint256 dx,
  bool tradeAll,
  bool underlyingTokens
```
## Impact
Mistakes could be made calling the functions, for example when copy pasting code from one exchange to another. 
## Proof of Concept
N/A 
## Tools Used
Remix
## Recommended Mitigation Steps
Make the interfaces the same or use different function names.


# BUG 4
## Summary
Curve underlying_coins perhaps not ok

## Risk Rating
1 (low)

## Vulnerability Details
In the CurveModule.sol code, the function exchange_underlying in called:
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/CurveModule.sol#L58

In other pieces of code I have seen that the appove of the `underlying_coins` is called:
```
IERC20(ICurvePool(curvePool).underlying_coins(…)).approve(..);
IERC20(ICurvePool(_curvePool).exchange_underlying(...);
IERC20(ICurvePool(curvePool).underlying_coins(…)).balanceOf(address(this));
```
Perhaps that is also relevant here, depending on the calling code.

## Impact
The exchange could fail or coins could be lost (to the Slingshot contract, although they could be recovered)

## Proof of Concept
 N/A

## Tools Used
Remix

## Recommended Mitigation Steps
 
Verify the use of `underlying_coins` 

# BUG 5
## Summary
 `amountInMax` not updated when `tradeAll=true` in `SushiSwapModule.sol` and `UniswapModule.sol`

## Risk Rating
1 (low)

## Vulnerability Details
Based on the documentation of `SushiSwapModule.sol` and `UniswapModule.sol`:
/// @param tradeAll If true, it overrides totalAmountIn with current token balance

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/UniswapModule.sol#L26

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/SushiSwapModule.sol#L27

I would think that `amountInMax` has to be updated when `tradeAll==true`, however it isn’t.

## Impact
A lower trade could be performed than expected.
 
## Proof of Concept
 N/A

## Tools Used
Remix

## Recommended Mitigation Steps
 
Update documentation or update code.


# BUG 6
## Summary
 Anyone can call then function executeTrades in the contract Slingshot.

## Risk Rating
1 (low)

## Vulnerability Details
Anyone can call executeTrades, as there is no access control for this function.

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L76

Very specific input parameters are required to let this function work properly.

Also there is no check for the following:
```
toToken == token of the last trade 
fromToken == token of the last trade 
```

## Impact
As very specific input parameters are required, unpredictable situations can occur when everyone can call the function executeTrades.
At the very least the event log could be spammed by calling the function executeTrades with an empy array for trades.

## Proof of Concept
N/A

## Tools Used
Remix

## Recommended Mitigation Steps
Add access control to the executeTrades function or make the function more robust by adding more explicit checks.

# BUG 7
## Summary
Before/after balance not calculated for all modules. 

## Risk Rating
1 (low)

## Vulnerability Details
Before/after balance is calculated in CurveModule.sol:

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/CurveModule.sol#L55

```
   uint256 beforeBalance = IERC20(jToken).balanceOf(address(this));
        return IERC20(jToken).balanceOf(address(this)).sub(beforeBalance);
```
However this is not done at the other modules.

## Impact
In case traces of token balances are still present in the Slingshot contract, the users who happen to trade with this coin get some extra balance. 
This is only relevant for intermediary trades, as a similar mechanism is present in the Slingshot contract:
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L84

By the way the return value of the function Save is not really used, only for event logs, so it doesn’t really make a difference.
 
## Proof of Concept
N/A

## Tools Used
Remix

## Recommended Mitigation Steps
Implement the same code in all modules and also use the return value of the save function.

Alternatively verify that the balances of the tokens of Slingshot are zero when calling executeTrades and/or in the beginning of the modules.

# BUG 8
## Summary
The ModuleRegistry function registerSwapModule doesn’t really check contracts.

## Risk Rating
1 (low)

## Vulnerability Details
The ModuleRegistry function registerSwapModule does not checking the addresses when adding them:
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/ModuleRegistry.sol#L44

However the Slingshot contract expects them to be correct:
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L86
//Checks to make sure that module exists and is correct

## Impact
Mistakes with addresses might not be detected immediately. 

## Proof of Concept
N/A

## Tools Used
Remix

## Recommended Mitigation Steps
In `registerSwapModule` verify that the address isn’t `0x0` and is indeed a contract address.

# BUG 9
## Summary
 The contracts only supports solidity 0.7.x, which isn’t clear from the pragma’s.

## Risk Rating
1 (low)

## Vulnerability Details
 
The contracts contains
pragma solidity >=0.7.5 
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L2

However it doesn’t compile with solidity 8, due to the used openzeppelin libraries.

## Impact
 Time could be lost trying to compile with higher solidity versions.

## Proof of Concept
 
## Tools Used
Remix

## Recommended Mitigation Steps
 
Change the sources to use:
pragma solidity >=0.7.5 <0.8.0;

Or update the code to support solidity 8. In that case the following can be removed:
pragma abicoder v2;
Safemath

# BUG 10
## Summary
Several  documentation errors

## Risk Rating
1 (low)
Vulnerability Details
 
The documentation of the Swap function of CurveModule refers to `totalAmountIn`, which is not present in the Swap function:
    /// @param tradeAll If true, it overrides totalAmountIn with current token balance
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/CurveModule.sol#L40

The parameter `underlyingTokens` of the swap function of CurveModule is not documented:
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/CurveModule.sol#L50
The function executeTrades has a typo in: delagatecall
         // delagatecall message is made on module contract, which is trusted
 https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L89

## Impact
Documentation could be confusing.

## Proof of Concept
N/A

## Tools Used
Remix

## Recommended Mitigation Steps
Update the documentation within the smartcontracts.

# BUG 11
## Summary
String function only work with numbers 0 to 9.

## Risk Rating
1 (low)

## Vulnerability Details
The string functions `prependNumber` and `appendNumber` use the following code to convert a number to string, which on works for single digits (0..9): 
i+uint(48)

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/Strings.sol#L21
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/Strings.sol#L29

## Impact
The functions are only used for event/logs. The logs would show unexpected characters when a long list of trades (>9) would done. This is also unlikely.
 
## Proof of Concept
N/A 

## Tools Used
Remix

## Recommended Mitigation Steps
 
Document the fact that the string function prependNumber and appendNumber only support 0..9 and make sure that no trades of more than 9 subtrades are done.


# BUG 12
## Summary
No emit is done for rescueTokens in the Slingshot contract.
 
## Risk Rating
1 (low)

## Vulnerability Details
No emit is done for rescueTokens, while an emit is done for the other external functions in the Slingshot contract.
 https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L120

## Impact
The event logs for the Slingshot contract do not contain all relevant info. This could be inconvenient for example when creating a subgraph for the Graph protocol or for debugging problems.

## Proof of Concept
N/A 

## Tools Used
Remix

## Recommended Mitigation Steps
Add an emit event to rescuetokens.

# BUG 13
## Summary
No explicit way to rescue WETH tokens.

## Risk Rating
1 (low)

## Vulnerability Details
There is a function rescueTokens to rescue tokens that might have gotten stuck in the contract:

https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L120

However there is no explicit way to rescue WETH tokens, even though a lot of code is present to interact with WETH tokens.

## Impact
It is possible to retrieve these tokens by giving the WETH contract address to rescueTokens but then the event logs might not be easy to understand. This could be inconvenient for example when creating a subgraph for the Graph protocol or for debugging problems.
 
## Proof of Concept
N/A
## Tools Used
Remix

## Recommended Mitigation Steps
Make an explicit way to recover WETH tokens.

Safe gas 1
Remove the following code (unless absolutely necessary) in CurveModule because it doesn’t seem to add any value.
    uint256 beforeBalance = IERC20(jToken).balanceOf(address(this));
…
     return IERC20(jToken).balanceOf(address(this)).sub(beforeBalance);


Perhaps  replace with the following if the logging info is important.
return IERC20(jToken).balanceOf(address(this)).

Safe gas 2

Separate the different paths in the modules to separate modules.
This saves a bit of gas, because the “if” is no longer necessary and also makes the code easier to read.

This is relevant for the following ifs:
underlyingTokens?  In CurveModule
if (swapExactTokensForTokens) in UniswapModule 
if (swapExactTokensForTokens) in SushiSwapModule.sol

For example:
```
function swapExactTokensForTokens (
    uint amount,
    address[] memory path,
    uint amountOutMin,
    bool tradeAll
    ) public payable returns (uint256){
        require(path.length > 0, "UniswapModule: path length must be >0");
        if (tradeAll) amount = IERC20(path[0]).balanceOf(address(this));
        IERC20(path[0]).approveIfBelow(uniswapRouter, amount);
        amountOutMin = amountOutMin == 0 ? 1 : amountOutMin;
        uint256[] memory amounts =
            IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
                amount,
                amountOutMin,
                path,
                address(this),
                block.timestamp
            );
        return amounts[amounts.length - 1];
}
function swapTokensForExactTokens (
    uint amount,
    address[] memory path,
    uint amountInMax,
    bool tradeAll
    ) public payable returns (uint256){
        require(path.length > 0, "UniswapModule: path length must be >0");
        if (tradeAll) amount = IERC20(path[0]).balanceOf(address(this));
        IERC20(path[0]).approveIfBelow(uniswapRouter, amount);
        amountInMax = amountInMax == 0 ? uint(-1) : amountInMax;
        uint256[] memory amounts =
            IUniswapV2Router02(uniswapRouter).swapTokensForExactTokens(
                amount,
                amountInMax,
                path,
                address(this),
                block.timestamp
            );
        return amounts[amounts.length - 1];
    }    
}
```
 

Safe gas 3

Change approveIfBelow of LibERC20Token
https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/LibERC20Token.sol#L15

To
```
mapping(IERC20 => bool) public approved;
function approveIfBelow(IERC20 token, address spender, uint256 amount) internal {
   if (approved[token]) return;
   approved[token]=true;
   token.safeApprove(spender, uint256(0));
   token.safeApprove(spender, uint256(-1));
}
```

The allowance is usually set to uint256(-1) frequently anyway so you might as well always do that. Once that is done if doesn’t have to be done again.
Perhaps change the function name approveIfBelow to something like: checkAndUpdateApproval
