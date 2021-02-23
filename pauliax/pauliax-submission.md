**Handle:** paulius.eth  

# BUG 1
A wrong event is emitted.
## Summary
function unregisterSwapModule emits ModuleRegistered when the ModuleUnregistered event is expected.
## Risk Rating
1
## Vulnerability Details
Nothing fancy here, just a wrong event communicated to the outside world.
## Impact
No security impact. It just can confuse the subscriber that is listening for this event.
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/ModuleRegistry.sol#L18-L19

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/ModuleRegistry.sol#L49-L53

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
emit `ModuleUnregistered` event in function unregisterSwapModule.

# BUG 2 
Uniswap and Sushiswap modules approve the wrong amount when `swapTokensForExactTokens` is used
## Summary
Uniswap and Sushiswap modules use the function parameter named amount when approving the router. In the case of swapTokensForExactTokens it should check and approve amountInMax, not amount. 
## Risk Rating
2
## Vulnerability Details
Taken from the Uniswap Router02 documentation (https://uniswap.org/docs/v2/smart-contracts/router02/): "msg.sender should have already given the router an allowance of at least amountInMax on the input token.". However, here swap function when approving uses the amount value, not amountInMax. It makes it even more confusing considering the fact that the first parameter in swapTokensForExactTokens is "amountOut	- the amount of output tokens to receive". So basically in this case it is approving an output token amount, not input.
## Impact
As in this case amount and amountInMax represent different tokens, it cannot be used interchangeably. However, the good news is that function approveIfBelow checks against the amount but approves the maximum amount uint256(-1) when the approval is needed, so such bug will only be triggered when the allowance is greater than amount but less than amountInMax. 
Also, such inaccurate namings and reuse of parameters may confuse users who may use the contracts directly.
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/module/UniswapModule.sol#L39

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/module/UniswapModule.sol#L53-L61

(same with Sushiswap module)

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Probably best would be to split swapExactTokensForTokens and swapTokensForExactTokens into separate functions (as Uniswap did) or refactor the swap function to approve the correct amount and use appropriate naming for the parameters to elegantly handle both cases.



# BUG 3
`swapTokensForExactTokens` does not reimburse leftovers
## Summary
Uniswap and Sushiswap modules do not reimburse the difference of amountInMax and the actual amount used to the sender when swapTokensForExactTokens is used.
## Risk Rating
4
## Vulnerability Details
When swapExactTokensForTokens is false, function swapTokensForExactTokens is used. It uses amountInMax which is the maximum number of input tokens that can be used. swapTokensForExactTokens amounts[0] returns the actual amount of input tokens that were needed. However, the swap function does not reimburse the difference (what is left) to the sender. This difference can be later extracted by a malicious user (tradeAll).
## Impact
It very depends on the slippage of the trade. When the amountInMax is very large (amountInMax = amountInMax == 0 ? uint(-1) : amountInMax;) but the actual amount (amounts[0]) is relatively low, then the difference is huge and it is left as a low hanging fruit in the contract and immediately can be extracted by another malicious user that monitors the activity (e.g. using backrunning technique). 
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/module/UniswapModule.sol#L52-L63

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/module/SushiSwapModule.sol#L53-L64

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Send back leftovers to the user by subtracting amounts[0]; from the input amount in function swapTokensForExactTokens. Theoretically, the input amount should be amountInMax but first, the Bug2 (described above) needs to be fixed.



# BUG 4 
Function swap does not have access restrictions
## Summary
Modules can be called directly by anyone as they do not check who is the sender.
## Risk Rating
1
## Vulnerability Details
Function swap in the module contracts can be called directly but this function does not send swapped tokens to the recipient, it only returns the amount. Thus theoretically naive user can lose his tokens.
## Impact
This is more of a theoretical issue and is only relevant when someone decides to call the module directly (pretty unlikely?).
## Proof of Concept

Look at the swap function of any module, for example, https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/UniswapModule.sol
swap function has no restrictions on the sender.

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Modules are supposed to be invoked only via the Slingshot contract (function executeTrades) so it makes sense to add the caller restrictions. It is unclear what is the best way to achieve this as executeTrades uses delegatecall so probably this needs to be refactored to a standard call and swap should send the swapped amount to the slingshot address.



# BUG 5 
Function swap is payable for no reason
## Summary
function swap in modules is payable although it does not use the msg.value and operates on WETH.
## Risk Rating
1
## Vulnerability Details
Slingshot contract handles all the conversions ETH <-> WETH so modules should only expect WETH. Declaring a function as payable means it can also receive ETH. However, there is no function to later extract ETH which is accidentally sent to this function.
## Impact
This issue is relevant only when someone directly calls the swap function in the module and sends some eth alongside (very unlikely). However, when this happens, ETH will be stuck there forever.
## Proof of Concept

Example in one of the modules: https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/module/UniswapModule.sol#L35

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Remove the payable modifier from the swap functions in the modules.



# BUG 6
Useless fallback function in the Slingshot contract
## Summary
Contract Slingshot has declared a fallback function which is not directly used:
receive() external payable {}
## Risk Rating
1
## Vulnerability Details
There is an empty fallback function which means that the contract can receive ETH. However, I can't find a reason why this was needed. Better not have a fallback function if you don't use it.
## Impact
The Slingshot contract should not accept ETH using a fallback function as in case someone accidentally sends ETH directly to this contract, it then can be swapped by anyone monitoring the contract.
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/Slingshot.sol#L169

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Remove useless fallback function.



# BUG 7
`executeTrades` recipient can be 0x0
## Summary
Function `executeTrades` does not check that the recipient is set.
## Risk Rating
1
## Vulnerability Details
When the recipient is not set, a default address of 0x0 is used. All the swapped tokens will be forwarded to this address.
## Impact
If the recipient is not set (0x0), it means that tokens are burned (sent to an address you can't recover them from). It depends on the intentions. Maybe the user wants to burn his tokens, then 0x0 makes sense.
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/Slingshot.sol#L100-L102

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
In case this was not intended, there are several possibilities to mitigate this issue:
1) add a check: require(recipient != address(0), "Invalid recipient");
2) if the recipient is 0x0, use msg.sender as a recipient.



# BUG 8
Modules do not check that it is the same token
## Summary
Each module separately accepts and uses the addresses of input and output tokens. However, function executeTrades expects that fromToken and toToken are the same in every module.
## Risk Rating
2
## Vulnerability Details
Parameters for each swap module are provided in the bytes encodedCalldata. These modules can not necessarily receive the same values for parameters such as input token and output token. Also, theoretically, they can be different than the ones that are passed to the function executeTrades in the Slingshot contract.
## Impact
If different output tokens are provided as call data for each module, then the user will only receive the toToken that is declared in function executeTrades. All other tokens will be left in the contract.
This is possible, for instance, when UI forms the incorrect call data for the trades and when finalAmountMin is very low (e.g. 0) so the recipient is happy with any amount received.
## Proof of Concept

Slingshot passes encoded data without validating it first: https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/Slingshot.sol#L90

See swap function of every module, they all accept input and output tokens as parameters: https://github.com/code-423n4/code-contests/tree/main/contests/01-slingshot/contracts/module

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Probably would be best to have a generic swap function and then validate the input/output token parameters in the Slingshot contract before passing it to the modules.

# BUG 9
Wrong signature of balanceOf function in the WETH interface
## Summary
Function balanceOf has an invalid signature in the interface IWETH that is declared in the contract Slingshot.
## Risk Rating
1
## Vulnerability Details
The real balanceOf function takes an address as a parameter but here this function is declared with the parameter "uint amount" which is not present in the implementation.
## Impact
Because interface IWETH is IERC20 there is no real harm as the function balanceOf(address) is provided by IERC20.
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/Slingshot.sol#L14

L32: https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2#code

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Remove this function from the interface or replace with: function balanceOf(address _account) external returns (uint);



# BUG 10
A mismatch between the comment and the actual declaration of the contract Strings.
## Summary
Strings is declared as a contract but has a comment that says it is a library.
## Risk Rating
1
## Vulnerability Details
Contract and library are two separate things in Solidity and each has its own keyword. If it says that it is a library then it must be declared so and vice versa.
## Impact
No real impact in this case but the mismatch between the comments and declaration can confuse readers about the real intentions.
## Proof of Concept

https://github.com/code-423n4/code-contests/blob/a13a3bc4649dccbbdc441f14e0d16e4d286437cf/contests/01-slingshot/contracts/lib/Strings.sol#L5-L6

## Tools Used
Just a simple code review using a text editor.
## Recommended Mitigation Steps
Update the comment or refactor Strings to be used as a library if you wish.



# Gas optimizations:
* Modifier onlyRole in contract Adminable is not used, so can be removed.
* If you want to reduce the deployment costs, consider using error codes as error messages. Now on revert, it returns long messages like "Slingshot: result is lower than required min". Longer messages need more space so a possible optimization is to store error codes (e.g. "S-1") and map them with messages on the UI part.
* function appendNumber in contract Strings is not used, so can be removed to save some deployment costs.
* contract UniswapModule and SushiSwapModule do not use SafeMath operations so importing this library is not needed: using SafeMath for uint256;
* Public functions that are never called from within the contracts should be declared external to save gas. Such functions are executeTrades and swap. Functions in the Strings contract can be internal as they are not supposed to be called from the outside.