**Handle:** @onewayfunction

**Ethereum Address:** 0x660f9D529F01DAfF0A7F15213a8fA39F42FCFe62

**Bio:** Mathematician. Security Auditor. Cryptonerd.


# Introduction

Overall the code looks pretty good!

What you end up considering a "bug" is, of course, up to you. As are the risk ratings. I took a stab at it below, but whatever you end up deciding is good with me. Many of these are gas improvements. I shoehorned the gas improvement suggestions into the same "bug template" as the other suggestions, and for "risk rating" I put either a 1 or a 2 depending on how much gas it would save under normal operations.

I left some additional notes at the bottom of this doc for things that I would note but that I don't necessarily consider bugs.

# High level thoughts
The Slingshot contract does not hold user funds, so the only time a user's funds can be lost is when the user initiates a transaction that interacts with Slingshot. This is nice from a security perspective because it makes for a small target to begin with.

Additionally, the only state-mutating function that is not access-controlled is the [`Slingshot.executeTrades` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L76). This means that -- assuming a malicious admin is out-of-scope -- the attack surface here is very small.

Currently, none of the `Slingshot` contract's state variables can be modified via the `executeTrades` contract. The `executeTrades` function does `delegatecall` to approved modules, which means an approved module is capable of modifying the `Slingshot` contract's state. But none of the four modules in this project modify any state when `delegatecall`ed from the `Slingshot` contract.

As a result, after initialization of the `Slingshot` and `ModuleRegistry` contracts, an attacker without admin access cannot do much harm here at the contract level -- beyond the usual frontrunning, backrunning, and sandwiching of publicly broadcasted trades (and the `finalAmountMin` parameter of the `executeTrades` function limits the amount of damage that can be done that way).

If I _had to_ attack this IRL, I would focus primarily on the UI and/or the backend trade-route discovery service in an attempt to trick users into making bad trades in my favor.

Here are my findings:


# BUG 1
## Summary
The [`IWETH` interface](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L14) is incorrect (in two ways) in `Slingshot.sol`.

## Risk Rating
1

## Vulnerability Details
First, the `balanceOf` function on the `WETH` contract accepts an `address` parameter, not a `uint256` parameter (see [line 32 of the `WETH9` contract](https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code)).

Second, the function is not declared `view`, which means calls to the `balanceOf` function on any contract wrapped with this interface could potentially change state. Since the Byzantium hardfork, the EVM can enforce that `view` functions use the `STATICCALL` opcode, ensuring that `view` functions cannot mutate state. (See [here](https://medium.com/blockchannel/state-specifiers-and-staticcall-d50d5b2e4920) for more info.)

(Also see below for why this isn't high impact in this particular case).

## Impact
Very low impact in this case because the `WETH` value is [set once](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L66) to a known-safe address and can never be changed, so the lack of enforcement of `view` on `balanceOf` in the `IWETH` interface cannot be abused to change state unexpectedly.

To be honest, I'm surprised that your compiler didn't catch this [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L149) when `address(this)` is passed in as a parameter to an interface that is expecting a `uint256` value.

## Proof of Concept
N/A.

## Tools Used
Manual code inspection.

## Recommended Mitigation Steps
Change [line 14](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L14) to: `function balanceOf(address _addr) external view returns (uint);`.





# BUG 2
## Summary
Incorrect event emission when unregistering a module

## Risk Rating
1

## Vulnerability Details
The [`ModuleRegistry.unregisterSwapModule` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/ModuleRegistry.sol#L50) emits the `ModuleRegistered` event when it should emit the `ModuleUnregistered` event.

## Impact
The incorrect event emission can make monitoring of registering and unregistering of modules slightly more difficult. Not a huge issue, but could be a small headache for the dapp devs as they have to jump through a few more hoops to keep track of registered modules.

## Proof of Concept
N/A.

## Tools Used
Manual code inspection.

## Recommended Mitigation Steps
Have the `ModuleRegistry.unregisterSwapModule` function emit the `ModuleUnregistered` event rather than the `ModuleRegistered` event.





# BUG 3 (gas usage)
## Summary
Unnecessary reading of contract storage on every call to the [`Slingshot.executeTrades`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L76) function. This results in higher gas costs for every call to `Slingshot.executeTrades` than is necessary.

## Risk Rating
2

## Vulnerability Details
In the [`Slingshot.initialize` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L63), the [`ETH_ADDRESS`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L65) and [`WETH`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L66) contract storage values are set. These can never be updated and are treated as constants in the code.

However, they are _not_ treated as constants at the EVM level. They are treated as storage variables. Which means that every time they are used (for example [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L135) in the `_transferFromOrWrap` function and [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L160) in the `_sendFunds` function, etc) the value has to be read from contract storage (one `SLOAD` opcode for each time it is accessed), which is very expensive, and [is likely to get even more expensive in the future](https://notes.ethereum.org/@vbuterin/BkrNbeAfD)).

Since the `_transferFromOrWrap` and the `_sendFunds` functions are called on every successful call to the `Slingshot.initialize` function, and since the `Slingshot.initialize` function is the most commonly called function in the system, these cost can become significant (in the cumulative sense) over time.

## Impact
The bug results in a more costly user experience than necessary.

## Proof of Concept
N/A (or if you want to verify this you can measure the gas costs doing it with the current implementation vs a variation where the values are hardcoded constants).

## Tools Used
Manual code inspection.

## Recommended Mitigation Steps
Consider hard-coding the values as constants on [lines 33 & 34](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L33-L34) of `Slingshot.sol`. This will cause the compiler to place those values directly in the contract's bytecode (instead of contract storage) so they won't be read from storage when they are used.


# BUG 4 (gas usage)
## Summary
The Uniswap and SushiSwap modules interact with the Uniswap and SushiSwap pairs via the Uniswap and SushiSwap _routers_, rather than interacting with the pair contracts directly. This results in unnecessary gas usage for every trade.

## Risk Rating
2

## Vulnerability Details
The Uniswap and SushiSwap router contracts are not special or privileged in any way. They are simply helper contracts that perform some helpful computations on the user's behalf, and then send tokens to the pair contracts on the user's behalf. But anyone is allowed to bypass the router contract and interact directly with the pair contracts themselves, which saves a lot of gas.

The logic needed to interact with the pair contracts safely can be moved directly into the module contracts themselves, rather than having the modules call out to the Uniswap/SushiSwap router contracts.

By moving this logic into the modules themselves (rather than calling out to third party routers) the `Slingshot` contract would not need to `approve` the router contracts and -- more importantly -- would not need to make a call to the routers when making trades. By bypassing the router contracts you could save gas on every call to `Slingshot.executeTrades`. 

## Impact
The bug results in a more costly user experience than necessary.

## Proof of Concept
N/A

## Tools Used
Manual code inspection.

## Recommended Mitigation Steps
Consider moving the logic from the Uniswap and SushiSwap router contracts into the Uniswap and SushiSwap Slingshot module contracts.



# BUG 5 (gas usage)
## Summary
The [`LibERC20Token.approveIfBelow` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/LibERC20Token.sol#L15) uses an unnecessarily gas-intensive pattern to set a max approval.

## Risk Rating
1

## Vulnerability Details
The `approveIfBelow` function is called in every module's `swap` function, and executes code to increase the `Slingshot` contract's allowance (if needed) to the max possible allowance. In practice, it will execute code the first time any user uses Slingshot with any particular "input currency" (other than ETH) and any particular approved module.

There is a [long known attack](https://blog.smartdec.net/erc20-approve-issue-in-simple-words-a41aaf47bca6) associated with the standard `ERC20.approve` function wherein an attacker that has been approved to spend `X` of a user's tokens, and then later is approved to spend `Y < X` of the user's tokens, can forntrun the second approval tx in order to spend `X + Y` of a user's tokens. OpenZeppelin's `SafeERC20` library mitigates against this by [enforcing](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/SafeERC20.sol#L40) that all calls to the `safeApprove` function either set the `value` to `0` _or_ (if the `value` is set to something non-zero) that the user's current approval is already `0`.

The Slingshot devs are clearly aware of this, as the `LibERC20Token.approveIfBelow` function first [sets the approval to `0`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/LibERC20Token.sol#L17) and then [sets it to `type(uint256).max`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/LibERC20Token.sol#L18).

However, in this particular setting, the Slingshot contract trusts the router contract (e.g., the `uniswapRouter`) to have an approval of `type(uint256).max` (a so-called "infinite approval"), and so the original conditions under which the `ERC20.approve` function is unsafe do not apply here. That is, the `Slingshot` contract never needs to worry about the trusted router frontrunning their approval in an attempt to get a higher approval, because Slinshot already trusts the router with an infinite approval.

In other words, it is safe for the `LibERC20Token.approveIfBelow` function to call the ERC20 token's `approve` function directly (or, alternatively, to use the [`SafeERC20.safeIncreaseAllowance`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/SafeERC20.sol#L46) function) _instead of_ using the `SafeERC20.safeApprove` function twice.

This would save a lot of gas, since it would reduce the number of `CALL`s, `SLOAD`s, and (most importantly) `SSTORE`s when executing the `LibERC20Token.approveIfBelow` function.

## Impact
The bug results in a more costly user experience than necessary.

## Proof of Concept
N/A.

## Tools Used
Manual code inspection.

## Recommended Mitigation Steps
Consider replacing [lines 17 and 18 of `LibERC20Token.sol`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/lib/LibERC20Token.sol#L17-L18) by: `token.approve(spender, type(uint256).max)`.


# Some additional notes

- There are several "benign" reentry opportunities in the `Slingshot.executeTrades` function. I was not able to find a way to use them in any nefarious way, but they are good to be aware of when you are working on the code in the future. They are:

    - The call to the [`_transferFromOrWrap` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L85) can be used by an attacker to gain temporary control of the execution flow. They just need to hook into the `transfer` function of a malicious ERC20 that they control [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L140).

    - On each `delegatecall` to a module [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L90) (especially Uniswap and SushiSwap modules) an attacker can gain temporary control over the execution flow, again by using hooks in the, `transfer`, `approve`, and/or `transferFrom` functions of a malicious ERC20 that they control (for example, [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/UniswapModule.sol#L39), [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/UniswapModule.sol#L44), and [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/module/UniswapModule.sol#L55)).

    - On the call to the `_sendFunds` function [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L102), an attacker can gain temporary control of the execution flow by hooking into the `transfer` funciton of a malicious ERC20 that they control [here](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L165).

All of these provide an opportunity for reentrancy, but as far as I can tell they are benign and nothing to worry about. (If you _really_ wanted to be sure, you could add a `nonReentrant` modifier to the `executeTrades` function, but IMO that would be a waste of gas).

- Silly misspelling in the comment on [line 144 of `Slingshot.sol`](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L144) ("balancer" -> "balance").

- The [`onlyRole` modifier](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Adminable.sol#L20) is never used and can be removed from the `Adminable.sol` file.

- Lack of input validation on some `onlyAdmin` functions may result in unexpected event emissions. For example, the [`registerSwapModule` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/ModuleRegistry.sol#L44) does not check whether the `_moduleAddress` has already been registered, so it possible to register an already-registered module, which allows for several `ModuleRegistered` events being emitted for the same module (without corresponding `ModuleUnregistered` events). Similar situations occur in the [`unregisterSwapModule` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/ModuleRegistry.sol#L50), the [`setSlingshot` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/ModuleRegistry.sol#L56), and the [`setModuleRegistry` function](https://github.com/code-423n4/code-contests/blob/main/contests/01-slingshot/contracts/Slingshot.sol#L109).
