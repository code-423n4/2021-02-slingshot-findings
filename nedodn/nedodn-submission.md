Handle: nedodn

# BUG 1 - Infinite Approval Issue

## Summary

This bug may or may not count as I saw that technically a malicious owner is out of scope but I do think that it is something to be taken seriously and fixed. Due to the contract requiring a user to approve the `Slingshot.sol` address before trading, if a user sets an infinite or large allowance, the admin of the Slingshot contract can add a module that transfers all of a user’s token that they have set an allowance for by calling `executeTrades` and having that call the malicious module. 

## Risk Rating

3 

## Vulnerability Details

Infinite or very large approvals are very common in this space in order to save gas and time however there are dangers to setting them as it gives an address/contract access to do whatever it wants with the tokens you hold. Normally there are mitigations in a contract that prevent a contract from freely accessing the user’s funds however currently in the Slingshot contract the only mitigation for this is the module registry which is controlled by an Admin. This means anyone who uses the slingshot contract and sets an infinite or large approval is granting the Slingshot admin permission to do whatever they want with their funds at any time while the approval exists. This is very similar to previous bugs found in other dex aggregator contracts where this was also not handled correctly. I believe this should be considered as after the initial approval, this exploit requires no other action by the user, whereas other exploits involving a malicious module would still require the user to call `executeTrades` themselves. While I understand this is operating under the assumption of an honest admin, this seems like an unnecessary risk for the user without any mitigation as it requires them to trust the admin at all times after they use the contract, not just while they are using the contract. 

## Impact

The impact of this could be very large as theoretically every user that uses Slingshot would be at risk unless they only ever set exactly the amount of tokens they trade for every trade. 

## POC

An example malicious module would be something that looks like this:

contract BadModule {
    using IERC20 for IERC20;
    function takeUserFunds(
        address user,
        address receiver,
        uint amount,
    ) public {
	IERC20.transferFrom(user, receiver, amount)
    }
}

## Recommended Mitigation Steps

Other dex aggregators handle this by using a secondary contract to handle approvals, that cannot be called except when a user executes the trade. This means the user is not required to approve the actual Slingshot contract so that a malicious module would not have access to the user’s allowance. This would be my recommendation. Another way would be to require users to only approve however much they are trading at a time, however that is not really something you can control. Another mitigation would be to add a time period before a newly added module can be activated. This would allow users to see what modules are currently active and if a malicious module was added, they would have time to unset allowances before the module could take their funds.


## GAS Optimization

Instead of using the Uniswap/Sushiswap Router contracts for their modules, you could swap directly with the Uniswap/Sushiswap pool which would remove the need to approve the Router or pool contract (you can just send the funds to the Uni/Sushi pool and call `swap`) as well as save on gas as you would be skipping having to call the router and the steps it does (finding the pair for the tokens pool, sorting the token addresses, internal safety checks that are already covered in Slingshot.sol).


## MISC

In the function _transferFromOrWrap there is a check that prevents sending ETH if the token being traded is not ETH. There is nothing wrong with this but it may prevent certain dex integrations that require sending ETH with a trade, for example 0xv3 requires a network fee on every trade that is paid in ETH. 

Currently executeTrades makes the assumption that all of the fromToken will be used in a trade. In the case that this is not true due to slippage, the extra fromToken will be stuck in the contract unless the admin rescues it. You may want to add a check that checks for this and sends it back to the user, or make sure that all the dex trade modules use up all of the fromToken in a trade (for example swapTokensForExactTokens that is used by Uni/Sushiswap may not use all of the fromToken)

It seems strange that all the dex integration modules for trading are marked as payable however Slingshot is set to exclusively use WETH for ETH trades. I believe the payable modifier is unnecessary in this case however it is not really an issue or anything.

You may want to add a check to the receive function to prevent users from accidentally sending ETH to the contract without calling a function. This can be done by checking that msg.sender != tx.origin. 

