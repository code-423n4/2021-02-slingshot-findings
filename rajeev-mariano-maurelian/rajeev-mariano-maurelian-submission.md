**Handle:** Rajeev, Mariano, Maurelian
**Team:** PocoTiempo

# Finding 1
## Summary
Front-running the initializer function `postUpgrade` in `Slingshot.sol` can make attacker the admin.

## Risk Rating

Impact = High
Likelihood = Low
Risk = 2 (Medium per [OWASP](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology))

## Vulnerability Details

Given the proxy-based upgradeable contract setup, the initializer function [`postUpgrade`](https://github.com/code-423n4/code-contests/blob/7320720d2ab7392c7e2a3b0263135d3db9236994/contests/01-slingshot/contracts/Slingshot.sol#L55-L59) in `Slingshot.sol` should be called as early as possible (as noted in the `Initializable.sol` [comment](https://github.com/code-423n4/code-contests/blob/7320720d2ab7392c7e2a3b0263135d3db9236994/contests/01-slingshot/contracts/Initializable.sol#L13-L14)).

If an attacker front-runs the above initialization, attacker can become the admin.

## Impact

An attacker becoming the admin will compromise the entire protocol functioning.

## Proof of Concept

https://github.com/code-423n4/code-contests/blob/7320720d2ab7392c7e2a3b0263135d3db9236994/contests/01-slingshot/contracts/Slingshot.sol#L55-L59

## Tools Used
Manual review.

## Recommended Mitigation Steps
* The protocol's actual admins can monitor for any such front-running and redeploy the contract if required.
* The ideal solution is to avoid such a front-running scenario is by atomically deploying and initializating the contract as noted in the `Initializable.sol` [comment](https://github.com/code-423n4/code-contests/blob/7320720d2ab7392c7e2a3b0263135d3db9236994/contests/01-slingshot/contracts/Initializable.sol#L13-L14).


# Finding 2
## Summary
Wrong event emitted for module unregistration in `ModuleRegistry.sol`

## Risk Rating
Impact = Medium
Likelihood = High
Risk = 3 (High per [OWASP](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology))

## Vulnerability Details
Instead of emitting event of type `event ModuleUnregistered(address moduleAddress);` in `function unregisterSwapModule()`, event for module registration `emit ModuleRegistered(_moduleAddress);` is emitted.

## Impact
This incorrect event emission will negatively impact any off-chain tools monitoring these critical events.

## Proof of Concept
https://github.com/code-423n4/code-contests/blob/7320720d2ab7392c7e2a3b0263135d3db9236994/contests/01-slingshot/contracts/ModuleRegistry.sol#L49-L53

## Tools Used
Manual review.

## Recommended Mitigation Steps

Use `emit ModuleUnregistered(_moduleAddress);` here https://github.com/code-423n4/code-contests/blob/7320720d2ab7392c7e2a3b0263135d3db9236994/contests/01-slingshot/contracts/ModuleRegistry.sol#L52 instead of `emit ModuleRegistered(_moduleAddress);`

# Finding 3
## Summary
Single-step setting/updating of `admin` role address may irreversibly lock out administrative access if incorrect address is mistakenly used.

## Risk Rating
Impact = High
Likelihood = Low
Risk = 2 (Medium per [OWASP](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology))

## Vulnerability Details
The `initializeAdmin()` function in `Adminable.sol` sets/updates `admin` role address in one-step. If an incorrect address (zero address or other) is mistakenly used then future administrative access or even recovering from this mistake is prevented because all `onlyAdmin` modifier functions (including `postUpgrade()` with `onlyAdminIfInitialized`, which ends up calling `initializeAdmin()`) require `msg.sender` to be the incorrectly used `admin` address (for which private keys may not be available to sign transactions).

## Impact
Future administrative access or even recovering from this mistake is prevented. Contracts will have to be redeployed.

# Proof of Concept
https://github.com/code-423n4/code-contests/blob/4ed1143115a217e26b856a8e12300089445a562a/contests/01-slingshot/contracts/Adminable.sol#L42-L47

## Tools Used
Manual review.

## Recommended Mitigation Steps
Use a two-step process where the new admin address first claims ownership in one transaction and a second transaction from the new admin address takes ownership. A mistake in the first step can be recovered by claiming again from the correct admin address.



# Finding 4
## Summary
Incorrectly encoded arguments to `executeTrades()` can result in tokens being stolen by MEV.

## Risk Rating
Impact = High
Likelihood = Medium
Risk = 3

## Vulnerability Details
This finding combines a couple weaknesses into one attack. The first weakness is a lack of validation on arguments to `executeTrades`, the second is that a pre-existing `fromToken` balance can be used in a trade.

1. Alice wants to convert 1000 DAI to WETH. She calls `executeTrades(DAI, WETH, 1000, [], 0, alice)`.
2. Since `trades` is an empty array, and `finalAmountMin` is 0, the result is that 100 DAI are transferred to the Slingshot contract.
3. Eve (a miner or other 'front runner') may observe this, and immediately call `executeTrades(DAI, WETH, 0, [{TradeData}], 0, eve)`.
4. With a correctly formatted array of `TradeData`, Eve will receive the proceeds of converting Alice's 1000 DAI to WETH.

## Impact

This issue is essentially identical to the one described in [**Ethereum is a Dark Forest**](https://medium.com/@danrobinson/ethereum-is-a-dark-forest-ecc5f0505dff), where locked tokens are available to anyone, and thus recovery is susceptible to front running.

It also provides an unauthorized alternative to `rescueTokens()`, however it is still a useful function to have, as it provides a method to recover the tokens without allowing a front runner to simulate and replay it.

## Proof of Concept
See steps listed above.

## Tools Used
Manual review.
## Recommended Mitigation Steps
While iterating of the `trades` array, track the sum the total amount of `fromToken` swapped. Add a require check to ensure that this amount is less than or equal to the `fromAmount` argument.

